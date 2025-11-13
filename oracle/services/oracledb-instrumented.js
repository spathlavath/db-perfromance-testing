/**
 * Instrumented Oracle DB wrapper
 * Adds OpenTelemetry tracing spans for all database operations
 * Following OpenTelemetry Semantic Conventions v1.38.0 for database spans
 */

const oracledb = require('oracledb');
const { trace, context, SpanStatusCode, SpanKind } = require('@opentelemetry/api');

// CRITICAL FIX: Use hardcoded attribute names since semantic-conventions v1.24.0 
// doesn't properly export experimental attributes
// Following OpenTelemetry Database Semantic Conventions v1.27.0
const ATTR_DB_SYSTEM = 'db.system';
const ATTR_DB_OPERATION_NAME = 'db.operation.name';
const ATTR_DB_COLLECTION_NAME = 'db.collection.name'; 
const ATTR_DB_QUERY_TEXT = 'db.query.text';
const ATTR_DB_NAMESPACE = 'db.namespace';

// Get the tracer
const tracer = trace.getTracer('oracledb', '6.4.0');

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

// Store the original execute method
const originalExecute = oracledb.Connection.prototype.execute;
const originalExecuteMany = oracledb.Connection.prototype.executeMany;

if (DEBUG) {
  console.log('🔧 [OTel-DB] Instrumentation module loaded, wrapping oracledb methods');
}

/**
 * Extract operation name from SQL query
 */
function extractOperation(sql) {
  try {
    const trimmed = sql.trim().toUpperCase();
    const operation = trimmed.split(/\s+/)[0];
    // Normalize common operations
    if (['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'MERGE'].includes(operation)) {
      return operation;
    }
    if (trimmed.startsWith('BEGIN') || trimmed.startsWith('DECLARE')) {
      return 'EXECUTE'; // PL/SQL blocks
    }
    return operation || 'QUERY';
  } catch (e) {
    return 'QUERY';
  }
}

/**
 * Extract table/collection name from SQL query
 */
function extractTableName(sql) {
  try {
    const cleanSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();
    
    const patterns = [
      /FROM\s+([A-Z_][A-Z0-9_]*)/i,
      /INTO\s+([A-Z_][A-Z0-9_]*)/i,
      /UPDATE\s+([A-Z_][A-Z0-9_]*)/i,
      /DELETE\s+FROM\s+([A-Z_][A-Z0-9_]*)/i,
      /TABLE\s+([A-Z_][A-Z0-9_]*)/i,
    ];
    
    for (const pattern of patterns) {
      const match = cleanSql.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Generate span name according to OpenTelemetry conventions
 * Format: {db.operation.name} {db.collection.name}
 */
function generateSpanName(operation, tableName) {
  if (tableName) {
    return `${operation} ${tableName}`;
  }
  return operation;
}

/**
 * Wrap connection.execute() with tracing following OpenTelemetry semantic conventions
 */
oracledb.Connection.prototype.execute = function(sql, bindParams, options, callback) {
  const args = Array.from(arguments);
  const hasCallback = typeof args[args.length - 1] === 'function';
  
  // Extract SQL statement
  const sqlStatement = typeof sql === 'string' ? sql : sql.sql || 'UNKNOWN';
  const operation = extractOperation(sqlStatement);
  const tableName = extractTableName(sqlStatement);
  const spanName = generateSpanName(operation, tableName);
  
  // Build span attributes following OpenTelemetry semantic conventions
  const attributes = {
    [ATTR_DB_SYSTEM]: 'oracle', // Required
    [ATTR_DB_OPERATION_NAME]: operation, // Conditionally Required
    [ATTR_DB_QUERY_TEXT]: sqlStatement.substring(0, 2000), // Recommended
  };
  
  // Add collection name if available
  if (tableName) {
    attributes[ATTR_DB_COLLECTION_NAME] = tableName; // Conditionally Required
    // CRITICAL: New Relic APM also needs this legacy attribute for UI display
    attributes['db.sql.table'] = tableName;
  }
  
  // Add namespace (database/schema)
  if (process.env.ORACLE_USER) {
    attributes[ATTR_DB_NAMESPACE] = process.env.ORACLE_USER; // Conditionally Required
  }
  
  // CRITICAL: New Relic APM needs these legacy attributes for proper categorization
  attributes['db.operation'] = operation.toLowerCase();
  attributes['db.statement'] = sqlStatement.substring(0, 2000);
  
  // Add server information (recommended)
  if (process.env.ORACLE_CONNECT_STRING) {
    const connectionStr = process.env.ORACLE_CONNECT_STRING;
    // Try to extract server address and port
    const match = connectionStr.match(/([^:/@]+):(\d+)/);
    if (match) {
      attributes['server.address'] = match[1];
      attributes['server.port'] = parseInt(match[2], 10);
      // New Relic also expects these
      attributes['db.instance'] = connectionStr;
      attributes['peer.hostname'] = match[1];
    }
  }
  
  // CRITICAL: Start span in the active context to ensure it's linked to parent HTTP span
  const activeContext = context.active();
  
  if (DEBUG) {
    const activeSpan = trace.getSpan(activeContext);
    const spanContext = activeSpan ? activeSpan.spanContext() : null;
    console.log(`🔍 [OTel-DB] Executing: ${spanName}`);
    console.log(`   Active context: ${activeContext ? 'EXISTS' : 'NULL'}`);
    console.log(`   Active span: ${activeSpan ? 'EXISTS' : 'NULL'}`);
    if (spanContext) {
      console.log(`   Parent trace: ${spanContext.traceId}`);
      console.log(`   Parent span: ${spanContext.spanId}`);
    }
  }
  
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes
  }, activeContext);
  
  if (DEBUG) {
    const spanCtx = span.spanContext();
    console.log(`   Created span: ${spanCtx.traceId}/${spanCtx.spanId}`);
    console.log(`   Span valid: ${spanCtx.traceFlags === 1 ? 'YES (sampled)' : 'NO (not sampled)'}`);
  }

  // Callback-based API
  if (hasCallback) {
    const originalCallback = args.pop();
    args.push(function(err, result) {
      if (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        // Add error type attribute
        span.setAttribute('error.type', err.code || err.name || 'DatabaseError');
        if (err.errorNum) {
          span.setAttribute('db.response.status_code', `ORA-${err.errorNum}`);
        }
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
        // Add result metrics
        if (result && result.rows) {
          span.setAttribute('db.response.returned_rows', result.rows.length);
        }
        if (result && result.rowsAffected !== undefined) {
          span.setAttribute('db.response.returned_rows', result.rowsAffected);
        }
      }
      
      if (DEBUG) {
        console.log(`✅ [OTel-DB] Span ended: ${spanName} (callback mode)`);
      }
      
      span.end();
      originalCallback(err, result);
    });
    
    // Execute in the span's context
    return context.with(trace.setSpan(activeContext, span), () => {
      return originalExecute.apply(this, args);
    });
  }
  
  // Promise-based API - Execute in span context
  return context.with(trace.setSpan(activeContext, span), () => {
    const promise = originalExecute.apply(this, args);
    return promise
      .then(result => {
        span.setStatus({ code: SpanStatusCode.OK });
        if (result && result.rows) {
          span.setAttribute('db.response.returned_rows', result.rows.length);
        }
        if (result && result.rowsAffected !== undefined) {
          span.setAttribute('db.response.returned_rows', result.rowsAffected);
        }
        
        if (DEBUG) {
          console.log(`✅ [OTel-DB] Span ended: ${spanName} (promise mode - success)`);
        }
        
        span.end();
        return result;
      })
      .catch(err => {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.setAttribute('error.type', err.code || err.name || 'DatabaseError');
        if (err.errorNum) {
          span.setAttribute('db.response.status_code', `ORA-${err.errorNum}`);
        }
        
        if (DEBUG) {
          console.log(`❌ [OTel-DB] Span ended: ${spanName} (promise mode - error): ${err.message}`);
        }
        
        span.end();
        throw err;
      });
  });
};

/**
 * Wrap connection.executeMany() with tracing for batch operations
 */
oracledb.Connection.prototype.executeMany = function(sql, binds, options, callback) {
  const args = Array.from(arguments);
  const hasCallback = typeof args[args.length - 1] === 'function';
  
  const sqlStatement = typeof sql === 'string' ? sql : sql.sql || 'UNKNOWN';
  const operation = extractOperation(sqlStatement);
  const tableName = extractTableName(sqlStatement);
  const spanName = generateSpanName(`BATCH ${operation}`, tableName);
  
  // Build span attributes
  const attributes = {
    [ATTR_DB_SYSTEM]: 'oracle',
    [ATTR_DB_OPERATION_NAME]: `BATCH ${operation}`,
    [ATTR_DB_QUERY_TEXT]: sqlStatement.substring(0, 2000),
    'db.operation.batch.size': Array.isArray(binds) ? binds.length : 0,
  };
  
  if (tableName) {
    attributes[ATTR_DB_COLLECTION_NAME] = tableName;
    // CRITICAL: New Relic APM also needs this legacy attribute for UI display
    attributes['db.sql.table'] = tableName;
  }
  
  if (process.env.ORACLE_USER) {
    attributes[ATTR_DB_NAMESPACE] = process.env.ORACLE_USER;
  }
  
  // CRITICAL: New Relic APM needs these legacy attributes for proper categorization
  attributes['db.operation'] = operation.toLowerCase();
  attributes['db.statement'] = sqlStatement.substring(0, 2000);
  
  if (process.env.ORACLE_CONNECT_STRING) {
    const connectionStr = process.env.ORACLE_CONNECT_STRING;
    const match = connectionStr.match(/([^:/@]+):(\d+)/);
    if (match) {
      attributes['server.address'] = match[1];
      attributes['server.port'] = parseInt(match[2], 10);
      // New Relic also expects these
      attributes['db.instance'] = connectionStr;
      attributes['peer.hostname'] = match[1];
    }
  }
  
  // Start span in active context
  const { context, trace } = require('@opentelemetry/api');
  const activeContext = context.active();
  const span = tracer.startSpan(spanName, {
    kind: SpanKind.CLIENT,
    attributes
  }, activeContext);

  if (hasCallback) {
    const originalCallback = args.pop();
    args.push(function(err, result) {
      if (err) {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.setAttribute('error.type', err.code || err.name || 'DatabaseError');
        if (err.errorNum) {
          span.setAttribute('db.response.status_code', `ORA-${err.errorNum}`);
        }
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
        if (result && result.rowsAffected !== undefined) {
          span.setAttribute('db.response.returned_rows', result.rowsAffected);
        }
      }
      span.end();
      originalCallback(err, result);
    });
    
    // Execute in span context
    return context.with(trace.setSpan(activeContext, span), () => {
      return originalExecuteMany.apply(this, args);
    });
  }
  
  // Promise-based - Execute in span context
  return context.with(trace.setSpan(activeContext, span), () => {
    const promise = originalExecuteMany.apply(this, args);
    return promise
      .then(result => {
        span.setStatus({ code: SpanStatusCode.OK });
        if (result && result.rowsAffected !== undefined) {
          span.setAttribute('db.response.returned_rows', result.rowsAffected);
        }
        span.end();
        return result;
      })
      .catch(err => {
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        span.setAttribute('error.type', err.code || err.name || 'DatabaseError');
        if (err.errorNum) {
          span.setAttribute('db.response.status_code', `ORA-${err.errorNum}`);
        }
        span.end();
        throw err;
      });
  });
};

if (DEBUG) {
  console.log('✅ [OTel-DB] Oracle DB instrumentation enabled - following OpenTelemetry semantic conventions v1.38.0');
  console.log('   Tracer:', tracer ? 'INITIALIZED' : 'NULL');
  console.log('   Original execute method:', originalExecute ? 'SAVED' : 'NULL');
  console.log('   Debug logging: ENABLED');
}

module.exports = oracledb;
