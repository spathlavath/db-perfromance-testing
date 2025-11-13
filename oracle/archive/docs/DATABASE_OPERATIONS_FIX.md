# Database Operations Not Visible in New Relic - Solution

## Problem
SQL span traces are visible in "Slow SQL Span traces", but:
- ❌ "Top 20 database operations" shows "We couldn't find any Database operations"
- ❌ No database transaction types visible (only HTTP transactions)
- ❌ Database queries appear as spans but not as separate transactions

## Root Cause
The original custom Oracle DB instrumentation was creating spans with generic names like "DB SELECT", "DB INSERT", etc. **New Relic requires specific naming conventions** to recognize database operations as separate transaction types.

## Solution: New Relic Datastore Naming Convention

Updated the span naming to follow New Relic's datastore transaction naming pattern:

```
Datastore/statement/{product}/{table}/{operation}
```

### Examples:
- `Datastore/statement/Oracle/employees/SELECT`
- `Datastore/statement/Oracle/departments/SELECT`
- `Datastore/statement/Oracle/job_history/INSERT`
- `Datastore/statement/Oracle/employees/UPDATE`

### Code Changes

**File: `/services/oracledb-instrumented.js`**

#### Added Table Name Extraction Function:
```javascript
function extractTableName(sql) {
  try {
    const cleanSql = sql.trim().replace(/\s+/g, ' ').toUpperCase();
    
    const patterns = [
      /FROM\s+([A-Z_][A-Z0-9_]*)/i,      // SELECT ... FROM table
      /INTO\s+([A-Z_][A-Z0-9_]*)/i,      // INSERT INTO table
      /UPDATE\s+([A-Z_][A-Z0-9_]*)/i,    // UPDATE table
      /DELETE\s+FROM\s+([A-Z_][A-Z0-9_]*)/i, // DELETE FROM table
    ];
    
    for (const pattern of patterns) {
      const match = cleanSql.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }
    
    return 'unknown';
  } catch (e) {
    return 'unknown';
  }
}
```

#### Updated Span Creation:
**Before:**
```javascript
const span = tracer.startSpan(`DB ${operation}`, {
  kind: 1,
  attributes: {
    'db.system': 'oracle',
    'db.statement': sqlStatement.substring(0, 500),
    // ...
  }
});
```

**After:**
```javascript
const tableName = extractTableName(sqlStatement);

const span = tracer.startSpan(`Datastore/statement/Oracle/${tableName}/${operation}`, {
  kind: 1,
  attributes: {
    'db.system': 'oracle',
    'db.statement': sqlStatement.substring(0, 2000),
    'db.operation': operation,
    'peer.service': 'oracle',
    'span.kind': 'client',
    'component': 'oracledb',
    'db.type': 'sql',
    // ...
  }
});
```

#### Additional Improvements:
1. **Increased SQL statement truncation**: 500 → 2000 characters (capture more query context)
2. **Added New Relic-specific attributes**:
   - `peer.service`: 'oracle'
   - `component`: 'oracledb'
   - `db.type`: 'sql'
3. **Dynamic table name extraction**: Parses SQL to get actual table name

## Expected Results After Deployment

### In New Relic "Databases" View:
- ✅ **Top 20 database operations** will show operations grouped by table:
  - `employees` SELECT operations
  - `departments` SELECT operations
  - `jobs` SELECT operations
  - `job_history` INSERT operations
  - `employees` UPDATE operations

### In New Relic "Transactions" View:
- ✅ Transaction types will include database operations:
  - HTTP transactions (POST /workload/start, GET /pool-stats, GET /health)
  - **Database transactions** (Datastore/statement/Oracle/*/*)

### In "Distributed Tracing" View:
- ✅ Each HTTP request trace will show child database spans with proper naming:
  ```
  POST /workload/start (3.95ms)
    └─ Datastore/statement/Oracle/employees/SELECT (1.2ms)
    └─ Datastore/statement/Oracle/departments/SELECT (0.8ms)
    └─ Datastore/statement/Oracle/job_history/INSERT (1.5ms)
  ```

## Deployment Instructions

### Option 1: Automated Script
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
chmod +x deploy-db-tracing-fix.sh
./deploy-db-tracing-fix.sh
```

### Option 2: Manual Deployment
```bash
# 1. Copy updated file
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  services/oracledb-instrumented.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/services/

# 2. Restart containers
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle
docker-compose down
docker-compose up --build -d

# 3. Verify deployment
docker-compose logs -f oracle-test-app | grep "Oracle DB instrumentation"
curl http://localhost:3000/health
```

## Verification Steps

### 1. Check Logs for Instrumentation Confirmation
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | grep "instrumentation"
```

Expected output:
```
✅ Oracle DB instrumentation enabled - all queries will be traced
```

### 2. Wait 5-10 Minutes
New Relic needs time to process and aggregate the new transaction types.

### 3. Check New Relic APM
Go to: **APM & Services → Oracle-HR-Portal → Databases**

You should now see:
- ✅ **Top 20 database operations** populated with operations
- ✅ Query breakdown by table (employees, departments, jobs, etc.)
- ✅ Individual query performance metrics

### 4. Check Transactions View
Go to: **APM & Services → Oracle-HR-Portal → Transactions**

You should see new transaction types:
- `Datastore/statement/Oracle/employees/SELECT`
- `Datastore/statement/Oracle/departments/SELECT`
- `Datastore/statement/Oracle/job_history/INSERT`
- etc.

## Why This Naming Convention?

New Relic APM agents use a specific transaction naming format for database operations:

```
Datastore/statement/{product}/{table}/{operation}
```

This convention allows New Relic to:
1. **Group operations by database product** (Oracle, MySQL, PostgreSQL, etc.)
2. **Group operations by table** (employees, departments, etc.)
3. **Group operations by type** (SELECT, INSERT, UPDATE, DELETE)
4. **Provide detailed analytics** per table and operation type
5. **Show database operations separately** from HTTP transactions

## Troubleshooting

### Issue: Still not seeing database operations after 15 minutes

**Solution 1: Verify span names in logs**
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | grep -i "datastore"
```

**Solution 2: Check OTLP export errors**
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | grep -i "export"
```

**Solution 3: Verify instrumentation is loaded**
```bash
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | head -50
```

Should show:
```
✅ Oracle DB instrumentation enabled - all queries will be traced
```

### Issue: Seeing "unknown" table names

This means the SQL pattern matching couldn't extract the table name. Check logs for actual SQL queries and update the extraction patterns if needed.

### Issue: Operations show but no query details

Increase the `db.statement` truncation limit in `oracledb-instrumented.js`:
```javascript
'db.statement': sqlStatement.substring(0, 5000), // Increase to 5000
```

## References

- [New Relic Transaction Naming](https://docs.newrelic.com/docs/apm/agents/manage-apm-agents/agent-data/collect-custom-metrics/)
- [OpenTelemetry Semantic Conventions for Database](https://opentelemetry.io/docs/specs/semconv/database/)
- [New Relic OTLP Ingestion](https://docs.newrelic.com/docs/more-integrations/open-source-telemetry-integrations/opentelemetry/opentelemetry-introduction/)

## Summary

✅ **Fixed span naming** to use New Relic's datastore convention  
✅ **Added table name extraction** from SQL queries  
✅ **Enhanced attributes** with New Relic-specific fields  
✅ **Increased statement capture** from 500 to 2000 characters  
✅ **Created automated deployment** script for easy rollout  

**Expected Result**: Database operations will now appear as separate transaction types in New Relic APM, with detailed breakdown by table and operation type.
