# OpenTelemetry Semantic Conventions Fix - Database Operations Visibility

## Problem
Database operations were not visible in New Relic APM "Top 20 database operations" view despite SQL spans being visible in "Slow SQL Span traces".

## Root Cause Analysis

After reviewing:
1. [New Relic OpenTelemetry APM Documentation](https://docs.newrelic.com/docs/opentelemetry/get-started/apm-monitoring/opentelemetry-apm-intro/)
2. [New Relic OpenTelemetry Examples - JavaScript](https://github.com/newrelic/newrelic-opentelemetry-examples/tree/main/getting-started-guides/javascript)
3. [OpenTelemetry Semantic Conventions for Database Spans v1.38.0](https://opentelemetry.io/docs/specs/semconv/database/database-spans/)

The issue was identified:

### What Was Wrong:
1. ❌ **Custom span naming** (`Datastore/statement/Oracle/{table}/{operation}`) - This is New Relic APM agent convention, not OpenTelemetry
2. ❌ **Incorrect attributes** - Using custom attributes instead of standardized OpenTelemetry semantic conventions
3. ❌ **Missing required attributes** - Not following OpenTelemetry's required/conditional/recommended attribute structure
4. ❌ **Wrong attribute names** - Using `db.rows_affected` instead of `db.response.returned_rows`

### What New Relic Expects:
New Relic's OTLP ingestion endpoint expects **standard OpenTelemetry semantic conventions**, not New Relic APM agent conventions. When you send OpenTelemetry data to New Relic, it automatically translates it to their internal format.

## Solution: Follow OpenTelemetry Semantic Conventions

### Updated Implementation

#### 1. Correct Span Naming (OpenTelemetry v1.38.0 Format)

**Before (Incorrect - New Relic APM Agent Format):**
```javascript
const span = tracer.startSpan(`Datastore/statement/Oracle/${tableName}/${operation}`, {
  kind: 1,
  attributes: { /* custom attributes */ }
});
```

**After (Correct - OpenTelemetry Format):**
```javascript
// Span name format: {db.operation.name} {db.collection.name}
const spanName = tableName ? `${operation} ${tableName}` : operation;
// Examples: "SELECT employees", "INSERT job_history", "UPDATE departments"

const span = tracer.startSpan(spanName, {
  kind: SpanKind.CLIENT,  // Use SpanKind enum, not number
  attributes: { /* semantic convention attributes */ }
});
```

#### 2. Required Attributes (Per OpenTelemetry Spec)

**Status: Stable Attributes**

| Attribute | Requirement | Description | Example |
|-----------|-------------|-------------|---------|
| `db.system` | **Required** | Database management system | `"oracle"` |
| `db.operation.name` | **Conditionally Required** | Operation name | `"SELECT"`, `"INSERT"` |
| `db.collection.name` | **Conditionally Required** | Table/collection name | `"employees"` |
| `db.namespace` | **Conditionally Required** | Database/schema name | `"hr"` |
| `db.query.text` | **Recommended** | The SQL query (truncated) | `"SELECT * FROM employees WHERE..."` |
| `server.address` | **Recommended** | Database server hostname | `"10.0.1.36"` |
| `server.port` | **Conditionally Required** | Database server port | `1521` |
| `db.response.returned_rows` | **Opt-In** | Number of rows returned | `10` |
| `error.type` | **Conditionally Required** | Error classification | `"ORA-00942"` |
| `db.response.status_code` | **Conditionally Required** | Database response code | `"ORA-17002"` |

#### 3. Updated Code Structure

```javascript
const { trace, SpanStatusCode, SpanKind } = require('@opentelemetry/api');
const { 
  ATTR_DB_SYSTEM, 
  ATTR_DB_OPERATION_NAME, 
  ATTR_DB_COLLECTION_NAME, 
  ATTR_DB_QUERY_TEXT, 
  ATTR_DB_NAMESPACE 
} = require('@opentelemetry/semantic-conventions');

// Use semantic convention constants for attribute names
const attributes = {
  [ATTR_DB_SYSTEM]: 'oracle',
  [ATTR_DB_OPERATION_NAME]: operation,
  [ATTR_DB_QUERY_TEXT]: sqlStatement.substring(0, 2000),
};

if (tableName) {
  attributes[ATTR_DB_COLLECTION_NAME] = tableName;
}

if (process.env.ORACLE_USER) {
  attributes[ATTR_DB_NAMESPACE] = process.env.ORACLE_USER;
}

// Extract server.address and server.port from connection string
if (process.env.ORACLE_CONNECT_STRING) {
  const match = process.env.ORACLE_CONNECT_STRING.match(/([^:/@]+):(\d+)/);
  if (match) {
    attributes['server.address'] = match[1];
    attributes['server.port'] = parseInt(match[2], 10);
  }
}

const span = tracer.startSpan(spanName, {
  kind: SpanKind.CLIENT,
  attributes
});
```

#### 4. Updated Result Handling

**Before:**
```javascript
span.setAttribute('db.rows_affected', result.rows.length);
```

**After (OpenTelemetry v1.38.0):**
```javascript
span.setAttribute('db.response.returned_rows', result.rows.length);
```

#### 5. Updated Error Handling

**Before:**
```javascript
span.recordException(err);
span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
```

**After (OpenTelemetry v1.38.0):**
```javascript
span.recordException(err);
span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
span.setAttribute('error.type', err.code || err.name || 'DatabaseError');
if (err.errorNum) {
  span.setAttribute('db.response.status_code', `ORA-${err.errorNum}`);
}
```

## Files Modified

### 1. `/services/oracledb-instrumented.js`
Complete rewrite to follow OpenTelemetry semantic conventions:

**Key Changes:**
- ✅ Import `@opentelemetry/semantic-conventions` constants
- ✅ Use `SpanKind.CLIENT` instead of numeric kind
- ✅ Span names: `{operation} {table}` format (e.g., "SELECT employees")
- ✅ All attributes follow OpenTelemetry naming conventions
- ✅ Added `server.address` and `server.port` extraction
- ✅ Added `db.response.returned_rows` instead of custom attribute
- ✅ Added `error.type` and `db.response.status_code` for errors
- ✅ Added batch operation support with `BATCH {operation}` format

### 2. `/services/package.json`
Added missing dependency:
```json
"@opentelemetry/semantic-conventions": "^1.24.0"
```

### 3. `/services/test-all-features.js`
Removed lock workload (causing stability issues):
- ❌ Commented out `lockWorkload` import and initialization
- ✅ Updated available workload types to: query, transaction, connection, memory

### 4. `/k6/scripts/load-test.js`
Removed lock workload from K6 tests:
```javascript
// Before: const workloadTypes = ['query', 'transaction', 'connection', 'lock', 'memory'];
// After:
const workloadTypes = ['query', 'transaction', 'connection', 'memory'];
```

## Expected Results After Deployment

### In New Relic APM - Databases View

#### Top 20 Database Operations
Will now populate with operations grouped by:
- **Operation Type**: SELECT, INSERT, UPDATE, DELETE, EXECUTE
- **Table Name**: employees, departments, jobs, job_history, etc.

Example entries:
```
Operation                    Avg Duration    Throughput
SELECT employees             5.2ms           45 rpm
SELECT departments           3.1ms           22 rpm
INSERT job_history           8.7ms           8 rpm
UPDATE employees             6.4ms           12 rpm
DELETE job_history           4.2ms           3 rpm
BATCH INSERT job_history     12.1ms          2 rpm
```

#### Top 5 Database Operations (By Time Consumed)
Will show operations consuming the most time.

#### Top Databases (By Query Time)
Will show the Oracle database with query time breakdown.

### In New Relic APM - Transactions View

Transactions will include database operations as child spans:
```
POST /workload/start (57.2%)
  └─ SELECT employees (12ms)
  └─ INSERT job_history (8ms)
  └─ UPDATE employees (6ms)

GET /pool-stats (41.4%)
  └─ SELECT employees (3ms)
```

### In New Relic APM - Distributed Tracing

Each trace will show detailed database spans with:
- ✅ Proper span names: "SELECT employees", "INSERT job_history"
- ✅ All semantic convention attributes visible
- ✅ Query text (truncated to 2000 chars)
- ✅ Server address and port
- ✅ Row counts returned
- ✅ Error details with Oracle error codes

## Deployment Instructions

### 1. Install New Dependencies
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle/services
npm install
```

This will install the new `@opentelemetry/semantic-conventions` package.

### 2. Copy Files to VM
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Copy updated files
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  services/package.json \
  services/oracledb-instrumented.js \
  services/test-all-features.js \
  k6/scripts/load-test.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/

# Copy to services subdirectory
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  services/package.json \
  services/oracledb-instrumented.js \
  services/test-all-features.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/services/

# Copy to k6 subdirectory
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  k6/scripts/load-test.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/k6/scripts/
```

### 3. Rebuild and Restart Containers
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213

cd ~/db-perfromance-testing/oracle

# Stop containers
docker-compose down

# Rebuild with new dependencies
docker-compose build --no-cache oracle-test-app

# Start containers
docker-compose up -d

# Check logs
docker-compose logs -f oracle-test-app
```

### 4. Verify Deployment

Look for this log message:
```
✅ Oracle DB instrumentation enabled - following OpenTelemetry semantic conventions v1.38.0
```

Check health:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/pool-stats
```

### 5. Wait for New Relic Data (5-10 minutes)

New Relic needs time to:
1. Receive OTLP data
2. Process spans with new format
3. Aggregate metrics
4. Update UI views

## Verification Steps

### Step 1: Check Application Logs (Immediate)
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | grep -E "(instrumentation|OTEL|error)"
```

Expected:
```
✅ Oracle DB instrumentation enabled - following OpenTelemetry semantic conventions v1.38.0
OTEL SDK started successfully
Service name: Oracle-HR-Portal
OTLP endpoint: https://staging-otlp.nr-data.net:4318
```

### Step 2: Check New Relic APM (After 5-10 minutes)

#### Databases View
1. Navigate to: **APM & Services → Oracle-HR-Portal → Databases**
2. Verify "Top 20 database operations" is populated
3. Check operations are grouped by table and operation type
4. Verify "Top databases" shows query time metrics

#### Transactions View
1. Navigate to: **APM & Services → Oracle-HR-Portal → Transactions**
2. Filter by transaction type: should show both Web and Database operations
3. Click on any transaction to see distributed trace
4. Verify database spans appear as children of HTTP spans

#### Distributed Tracing
1. Navigate to: **APM & Services → Oracle-HR-Portal → Distributed tracing**
2. Click on any trace
3. Expand database spans
4. Verify span attributes include:
   - `db.system`: oracle
   - `db.operation.name`: SELECT, INSERT, etc.
   - `db.collection.name`: employees, departments, etc.
   - `db.query.text`: Full or truncated SQL
   - `server.address` and `server.port`

### Step 3: Query with NRQL

```sql
-- Check database spans are being recorded
FROM Span 
SELECT count(*) 
WHERE db.system = 'oracle' 
FACET db.operation.name, db.collection.name 
SINCE 30 minutes ago

-- Check span names follow new format
FROM Span 
SELECT uniques(name) 
WHERE db.system = 'oracle' 
SINCE 30 minutes ago
LIMIT 100

-- Check all required attributes are present
FROM Span 
SELECT 
  name,
  db.system,
  db.operation.name,
  db.collection.name,
  db.namespace,
  `server.address`,
  `server.port`,
  `db.response.returned_rows`
WHERE db.system = 'oracle' 
SINCE 10 minutes ago
LIMIT 10
```

## Troubleshooting

### Issue: Still no database operations after 15 minutes

**Check 1: Verify semantic-conventions package is installed**
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle/services
npm list @opentelemetry/semantic-conventions
```

**Check 2: Verify span attributes in logs**
Add debug logging to `oracledb-instrumented.js`:
```javascript
console.log('Creating span:', { spanName, attributes });
```

**Check 3: Check for export errors**
```bash
docker-compose logs oracle-test-app | grep -i "export\|error\|failed"
```

### Issue: "Cannot find module '@opentelemetry/semantic-conventions'"

**Solution**: Rebuild Docker image to install new dependency
```bash
docker-compose down
docker-compose build --no-cache oracle-test-app
docker-compose up -d
```

### Issue: Spans visible but wrong attributes

**Solution**: Clear any cached modules and restart
```bash
docker-compose down
docker volume prune -f
docker-compose build --no-cache
docker-compose up -d
```

## Key Differences: OpenTelemetry vs New Relic APM Agent

| Aspect | New Relic APM Agent | OpenTelemetry (OTLP) |
|--------|---------------------|----------------------|
| Span Names | `Datastore/statement/Oracle/table/operation` | `{operation} {table}` |
| Kind | Numeric: `1` | Enum: `SpanKind.CLIENT` |
| Attributes | Custom: `db.rows_affected` | Standard: `db.response.returned_rows` |
| Conventions | New Relic proprietary | OpenTelemetry semantic conventions |
| Database System | `peer.service`: 'oracle' | `db.system`: 'oracle' |
| Error Codes | Custom attributes | `error.type`, `db.response.status_code` |

**Important**: When sending data via OTLP to New Relic, always use OpenTelemetry semantic conventions, not New Relic APM agent conventions.

## References

- [OpenTelemetry Semantic Conventions for Database Spans v1.38.0](https://opentelemetry.io/docs/specs/semconv/database/database-spans/)
- [OpenTelemetry JavaScript SDK](https://opentelemetry.io/docs/languages/js/)
- [New Relic OpenTelemetry APM Documentation](https://docs.newrelic.com/docs/opentelemetry/get-started/apm-monitoring/opentelemetry-apm-intro/)
- [New Relic OpenTelemetry Examples - JavaScript](https://github.com/newrelic/newrelic-opentelemetry-examples/tree/main/getting-started-guides/javascript)
- [New Relic OTLP Ingestion](https://docs.newrelic.com/docs/more-integrations/open-source-telemetry-integrations/opentelemetry/opentelemetry-introduction/)

## Summary

✅ **Fixed**: Implemented proper OpenTelemetry semantic conventions v1.38.0  
✅ **Fixed**: Span naming follows `{operation} {table}` format  
✅ **Fixed**: All required/recommended attributes included  
✅ **Fixed**: Using semantic-conventions constants for attribute names  
✅ **Fixed**: Proper SpanKind enum instead of numeric values  
✅ **Fixed**: Error handling with `error.type` and `db.response.status_code`  
✅ **Fixed**: Result metrics with `db.response.returned_rows`  
✅ **Improved**: Removed lock workload for better stability  
✅ **Improved**: Added server address and port extraction  

**Expected Outcome**: Database operations will now appear in New Relic APM's "Databases" view with proper grouping, metrics, and distributed tracing.
