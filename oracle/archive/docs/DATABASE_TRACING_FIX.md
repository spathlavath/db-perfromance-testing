# Oracle Database Transaction Visibility Fix

## Problem
New Relic APM was only showing HTTP endpoint transactions (GET /health, POST /workload/start, GET /pool-stats) but **no database-level transaction traces** from Oracle queries.

## Root Cause
OpenTelemetry's auto-instrumentation package does not include native support for Oracle Database (oracledb npm package). The HTTP and Express instrumentations were working, but database calls were not being traced.

## Solution
Created custom Oracle DB instrumentation that wraps all `connection.execute()` and `connection.executeMany()` calls with OpenTelemetry spans.

## Changes Made

### 1. Created `oracledb-instrumented.js`
Custom wrapper that:
- Intercepts all Oracle DB execute operations
- Creates OpenTelemetry spans for each query
- Captures database attributes:
  - `db.system`: oracle
  - `db.statement`: SQL query (truncated to 500 chars)
  - `db.operation`: SELECT, INSERT, UPDATE, DELETE, etc.
  - `db.rows_affected`: Number of rows returned/affected
  - `db.user`: Oracle username
  - `peer.service`: Oracle Database 19c
- Records exceptions and errors
- Supports both callback and Promise-based APIs

### 2. Updated `app.js`
Changed from:
```javascript
const oracledb = require('oracledb');
```

To:
```javascript
const oracledb = require('./oracledb-instrumented');
```

### 3. Updated `tracing.js`
- Removed non-existent oracledb instrumentation from auto-instrumentations
- Added health check filtering to reduce trace noise
- Kept HTTP and Express auto-instrumentation

## Deployment

### Copy updated files to VM:
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

scp -i ~/Downloads/ssh-key-2025-11-03.key \
  services/oracledb-instrumented.js \
  services/tracing.js \
  services/app.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/services/
```

### Rebuild and restart:
```bash
ssh -A -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle
docker-compose down
docker-compose up --build -d
docker-compose logs -f oracle-test-app
```

## Expected Results in New Relic

### Before:
- ✅ GET /health
- ✅ POST /workload/start
- ✅ GET /pool-stats
- ❌ No database transactions

### After:
- ✅ GET /health (filtered out to reduce noise)
- ✅ POST /workload/start
- ✅ GET /pool-stats
- ✅ **DB SELECT** - Employee queries
- ✅ **DB INSERT** - Transaction workloads
- ✅ **DB UPDATE** - Salary updates
- ✅ **DB DELETE** - Cleanup operations
- ✅ **DB SELECT (BATCH)** - Bulk operations
- ✅ **PL/SQL BLOCK** - Stored procedures

### Transaction Details Will Show:
1. **HTTP Request** → Express endpoint
2. **Database Spans** → All Oracle queries with:
   - SQL statement
   - Operation type (SELECT/INSERT/UPDATE/DELETE)
   - Rows affected
   - Query duration
   - Connection details
3. **Service Map** → Application → Oracle Database 19c

### Distributed Traces Will Show:
```
POST /workload/start
  ├─ DB SELECT: SELECT employee_id, first_name, last_name FROM employees
  ├─ DB SELECT: SELECT * FROM departments WHERE department_id = :1
  ├─ DB UPDATE: UPDATE employees SET salary = salary * 1.1 WHERE ...
  └─ DB INSERT: INSERT INTO job_history (employee_id, start_date, ...)
```

## Verification

Run the test script:
```bash
cd ~/db-perfromance-testing/oracle
./test-otel.sh
```

Check logs for:
```
✅ Oracle DB instrumentation enabled - all queries will be traced
```

## What Gets Traced Now

### Query Workload:
- Fast HR queries (EMPLOYEES, DEPARTMENTS)
- Slow HR queries (complex joins)
- Bind variable queries
- Parse-intensive queries
- Full table scans

### Transaction Workload:
- Short transactions (INSERT + UPDATE)
- Long transactions (multiple DML operations)
- Rollback scenarios
- Multi-statement transactions

### Connection Workload:
- Connection pool operations (visible as DB operations)

### Lock Workload:
- Table locks (LOCK TABLE statements)
- Row locks (SELECT FOR UPDATE)
- Deadlock scenarios

### Memory Workload:
- PL/SQL operations (DECLARE blocks)
- Large result sets
- Sort operations

All of these will now appear as **separate transaction types** in New Relic APM with full database visibility!
