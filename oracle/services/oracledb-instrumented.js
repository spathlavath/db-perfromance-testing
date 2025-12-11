/**
 * Instrumented Oracle DB wrapper
 * Adds OpenTelemetry tracing spans for all database operations
 * Following OpenTelemetry Semantic Conventions v1.38.0 for database spans
 * Enhanced for New Relic APM Database Monitoring
 */

const oracledb = require('oracledb');
const { trace, context, SpanStatusCode, SpanKind } = require('@opentelemetry/api');

// Database semantic convention attributes
const ATTR_DB_SYSTEM = 'db.system';
const ATTR_DB_OPERATION = 'db.operation';
const ATTR_DB_STATEMENT = 'db.statement';
const ATTR_DB_NAME = 'db.name';
const ATTR_DB_USER = 'db.user';
const ATTR_DB_CONNECTION_STRING = 'db.connection_string';
const ATTR_SERVER_ADDRESS = 'server.address';
const ATTR_SERVER_PORT = 'server.port';

// New Relic specific attributes for better APM integration
const ATTR_PEER_SERVICE = 'peer.service';
const ATTR_DB_INSTANCE = 'db.instance';

// Get the tracer
const tracer = trace.getTracer('oracledb', '6.4.0');

// Debug flag - set to true to enable detailed logging
const DEBUG = true;

// Store connection metadata
let connectionMetadata = {
  host: null,
  port: null,
  database: null,
  user: null
};

// Store the original methods
const originalExecute = oracledb.Connection.prototype.execute;
const originalExecuteMany = oracledb.Connection.prototype.executeMany;
const originalCreatePool = oracledb.createPool;

if (DEBUG) {
  console.log('🔧 [OTel-DB] Instrumentation module loaded, wrapping oracledb methods');
}

/**
 * Parse Oracle connection string to extract host, port, and database
 */
function parseConnectionString(connectString) {
  try {
    // Format: host:port/service_name or host:port:sid
    const match = connectString.match(/([^:\/]+):(\d+)[\/:]([\w\.]+)/);
    if (match) {
      return {
        host: match[1],
        port: parseInt(match[2]),
        database: match[3]
      };
    }
  } catch (e) {
    if (DEBUG) console.warn('Failed to parse connection string:', e.message);
  }
  return { host: null, port: null, database: null };
}

/**
 * Wrap createPool to capture connection metadata
 */
oracledb.createPool = async function(poolAttrs) {
  if (DEBUG) {
    console.log('🔧 [OTel-DB] Intercepting createPool call');
  }
  
  // Parse connection string
  if (poolAttrs.connectString) {
    const parsed = parseConnectionString(poolAttrs.connectString);
    connectionMetadata = {
      ...parsed,
      user: poolAttrs.user || null
    };
    
    if (DEBUG) {
      console.log('🔧 [OTel-DB] Connection metadata:', connectionMetadata);
    }
  }
  
  return originalCreatePool.call(this, poolAttrs);
};

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
  const spanName = `${operation}${tableName ? ' ' + tableName : ''}`;
  
  // Build span attributes following OpenTelemetry semantic conventions + New Relic requirements
  const attributes = {
    // OpenTelemetry standard attributes
    [ATTR_DB_SYSTEM]: 'oracle',
    [ATTR_DB_OPERATION]: operation.toLowerCase(),
    [ATTR_DB_STATEMENT]: sqlStatement.substring(0, 4095),
    
    // Connection attributes
    [ATTR_DB_USER]: connectionMetadata.user || process.env.ORACLE_USER,
    [ATTR_DB_NAME]: connectionMetadata.database || 'oracle',
    
    // Server attributes
    [ATTR_SERVER_ADDRESS]: connectionMetadata.host,
    [ATTR_SERVER_PORT]: connectionMetadata.port,
    
    // New Relic specific attributes for APM
    [ATTR_PEER_SERVICE]: 'oracle-database',
    [ATTR_DB_INSTANCE]: connectionMetadata.database || process.env.ORACLE_CONNECT_STRING,
  };
  
  // Add table name if available
  if (tableName) {
    attributes['db.sql.table'] = tableName;
  }
  
  // Remove null/undefined attributes
  Object.keys(attributes).forEach(key => {
    if (attributes[key] === null || attributes[key] === undefined) {
      delete attributes[key];
    }
  });
  
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
