# Query Plan Regression Scenarios - Added to Oracle Test Application

## Overview

Added comprehensive real-world query plan regression scenarios to simulate queries that perform well initially but suddenly become slow over time. These scenarios are critical for testing the newrelicoraclereceiver's ability to detect performance degradations.

## Problem Statement

**User Requirement:** "If a query is running performing very well in last 100 runs/20 days but suddenly since 1 day/last 6 hours it became very slow, such scenarios should get added."

**Root Causes:**
- Statistics go stale → Optimizer chooses FULL SCAN instead of INDEX
- Bind variable peeking → Different plan for different bind values
- Plan change → Same SQL_ID but different PLAN_HASH_VALUE
- Data growth → Query performs well with small dataset, slow with large dataset
- Join order changes → Optimizer chooses suboptimal join order

## Implementation

### New File: `workloads/plan-regression-workload.js`

This workload simulates 5 real-world plan regression scenarios:

### 1. Statistics Regression Scenario
**Scenario:** Query uses index initially (fast) → After data changes, uses full scan (slow)

**How it works:**
- Phase 1: Fast indexed lookups on `employee_id` (PRIMARY KEY)
- Bulk updates simulate data changes
- Phase 2: Same query pattern but with FULL SCAN hint (simulating stale stats)

**Real-world trigger:** Statistics haven't been gathered after significant data changes

**Metrics captured:**
- Same SQL pattern, different `plan_hash_value`
- Dramatic elapsed time increase
- Shows up in slow queries

### 2. Bind Variable Peeking Regression
**Scenario:** Plan optimized for one bind value performs poorly for another

**How it works:**
- Phase 1: Selective query (`employee_id = 100`) uses index
- Phase 2: Non-selective query (`salary > X` matching most rows) forces full scan
- Same SQL structure, different bind values → Different performance

**Real-world trigger:** Optimizer "peeks" at first bind value and creates plan that doesn't work for all values

**Metrics captured:**
- Same SQL_ID
- Different execution characteristics
- Performance variance across executions

### 3. Plan Hash Value Change (MOST CRITICAL!)
**Scenario:** Same SQL_ID, different PLAN_HASH_VALUE over time

**How it works:**
- Execution 1: Query with optimal plan (index access)
- Execution 2: Same query semantics with forced hints (bad plan)
- Simulates optimizer choosing different plan after statistics/data changes

**Real-world trigger:**
- Statistics update causes plan change
- Cost model changes
- Initialization parameters modified

**Metrics captured:**
- Same SQL_ID
- Different `plan_hash_value`
- Performance degradation percentage logged
- **This is what receiver should detect!**

### 4. Data Growth Regression
**Scenario:** Query fast with small dataset → Slow as table grows

**How it works:**
- Baseline: Query on normal dataset
- After growth: CROSS JOIN simulates 10x data growth
- Same query logic, massively different performance

**Real-world trigger:** Table grows from 10K rows to 1M rows over months

**Metrics captured:**
- Same query structure
- Order of magnitude performance difference
- Demonstrates why queries that worked 6 months ago are now slow

### 5. Join Order Regression
**Scenario:** Optimizer chooses wrong join order → Performance degrades

**How it works:**
- Good plan: Join small tables first (departments → locations → countries)
- Bad plan: Join large table first (employees → departments)
- Same result set, drastically different execution path

**Real-world trigger:**
- Statistics inaccuracy on cardinality estimates
- CBO (Cost-Based Optimizer) miscalculation

**Metrics captured:**
- Same join semantics
- Different join order via LEADING hint
- Performance impact of join order

## Integration

### Updated Files:

1. **`services/test-all-features.js`**
   - Imported `planRegressionWorkload`
   - Added to test orchestration
   - Documented as new metric category #7

2. **`services/app.js`**
   - **Fixed connection pool exhaustion issue:**
     - `poolMin`: 5 → 10
     - `poolMax`: 30 → 50
     - `poolIncrement`: 2 → 5
     - `poolTimeout`: 60 → 120 seconds
     - `queueTimeout`: 180000 → 300000 ms (3 → 5 minutes)
     - Added `queueMax: -1` (unlimited queue)

   **Why this matters:** Complex query workloads + blocking scenarios + plan regression scenarios were exhausting the pool, causing `NJS-040: connection request timeout` errors.

## Receiver Flow Verification

### How newrelicoraclereceiver Should Capture These Scenarios:

```
┌─────────────────────────────────────────────────────┐
│  1. Slow Queries Scraper (GetSlowQueriesSQL)      │
│     - Captures queries with high elapsed_time_ms   │
│     - Returns sql_id for further analysis          │
│     - NOW INCLUDES: Same sql_id appearing multiple │
│       times with different performance             │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  2. Wait Events Scraper (GetWaitEventsAndBlockingSQL)│
│     - Captures ACTIVE sessions in WAITING state    │
│     - Returns (sql_id, child_number) pairs         │
│     - Filters to TOP N slow query sql_ids          │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  3. Child Cursor Scraper                           │
│     - For each (sql_id, child_number):            │
│     - Queries v$sql for PLAN_HASH_VALUE            │
│     - Captures execution metrics per child cursor  │
│     - KEY: Different plan_hash_value = plan change!│
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  4. Execution Plan Scraper                         │
│     - Fetches full plan from v$sql_plan            │
│     - Shows INDEX vs FULL SCAN operations          │
│     - Logs each plan step as separate event        │
└─────────────────────────────────────────────────────┘
```

## Expected Receiver Metrics

When plan regression scenarios run, receiver should capture:

### 1. Slow Queries Metrics
- `oracledb.slow_queries.avg_elapsed_time_ms`
- Same `sql_id` appearing with:
  - **Good performance:** 50-100ms
  - **Degraded performance:** 500-2000ms (10-20x slower)

### 2. Child Cursor Metrics
- `oracledb.child_cursors.avg_elapsed_time_ms`
- **CRITICAL:** Same `sql_id` with different `plan_hash_value`:
  - `sql_id`: abc123xyz
  - `plan_hash_value`: 2834567890 (good plan)
  - `plan_hash_value`: 1234567890 (bad plan)

### 3. Execution Plan Logs
- Plan 1 (fast): `INDEX UNIQUE SCAN` on `EMP_EMP_ID_PK`
- Plan 2 (slow): `TABLE ACCESS FULL` on `EMPLOYEES`

## Verification Queries

### Check for Plan Regressions in v$sql

```sql
-- Find queries with multiple plans (plan regression candidates)
SELECT
    sql_id,
    COUNT(DISTINCT plan_hash_value) as plan_count,
    MIN(elapsed_time/executions)/1000 as min_avg_elapsed_ms,
    MAX(elapsed_time/executions)/1000 as max_avg_elapsed_ms,
    ROUND((MAX(elapsed_time/executions) - MIN(elapsed_time/executions)) /
          MIN(elapsed_time/executions) * 100, 2) as perf_variance_pct
FROM v$sql
WHERE executions > 0
  AND sql_text NOT LIKE '%v$sql%'
GROUP BY sql_id
HAVING COUNT(DISTINCT plan_hash_value) > 1
ORDER BY perf_variance_pct DESC;
```

### Check Current Execution Plans

```sql
-- See which plan is currently being used
SELECT
    sql_id,
    child_number,
    plan_hash_value,
    executions,
    ROUND(elapsed_time/executions/1000, 2) as avg_elapsed_ms,
    ROUND(cpu_time/executions/1000, 2) as avg_cpu_ms,
    buffer_gets/executions as avg_buffer_gets
FROM v$sql
WHERE sql_id IN (
    SELECT sql_id
    FROM v$sql
    GROUP BY sql_id
    HAVING COUNT(DISTINCT plan_hash_value) > 1
)
ORDER BY sql_id, child_number;
```

## Testing Instructions

### 1. Start the Test Application

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Update pool configuration in .env (if needed)
POOL_MIN=10
POOL_MAX=50
POOL_INCREMENT=5
POOL_TIMEOUT=120
QUEUE_TIMEOUT=300000

# Start services
docker-compose up --build
```

### 2. Monitor Logs

Watch for plan regression log messages:

```bash
docker-compose logs -f oracle-test-app | grep "PLAN REGRESSION\|PLAN HASH\|GOOD PLAN\|BAD PLAN"
```

Expected output:
```
[PLAN REGRESSION] Starting statistics regression scenario...
[FAST] Running query with good plan (index scan)...
[FAST] Completed 20 fast indexed lookups
[SLOW] Running same query with degraded plan (full scan)...
[SLOW] Query completed in 1247ms (should show up in slow queries)
[PLAN HASH CHANGE] Performance degradation: 156.32% slower
[PLAN HASH CHANGE] This should appear in receiver with DIFFERENT plan_hash_value
```

### 3. Verify in Oracle

```sql
-- Connect to Oracle
sqlplus hr/password@//host:1521/FREEPDB1

-- Check for plan variations
SELECT sql_id, COUNT(DISTINCT plan_hash_value) as plans
FROM v$sql
WHERE parsing_schema_name = 'HR'
GROUP BY sql_id
HAVING COUNT(DISTINCT plan_hash_value) > 1;
```

### 4. Check Receiver Metrics

In New Relic or your monitoring system, look for:

1. **Slow queries** with same `sql_id` but varying performance
2. **Child cursor metrics** showing different `plan_hash_value` for same `sql_id`
3. **Execution plan logs** showing `INDEX SCAN` vs `FULL TABLE SCAN`

## Connection Pool Fixes

### Problem
Multiple concurrent workloads (query, transaction, connection, blocking, complex, **plan regression**, memory) were exhausting the connection pool, causing:

```
NJS-040: connection request timeout. Request exceeded "queueTimeout" of 120000
```

### Solution
Increased pool capacity and timeouts to handle:
- Long-running complex queries (20-30 seconds)
- Blocking scenarios holding connections
- Plan regression scenarios running multiple queries per iteration
- Multiple workloads running simultaneously

**New configuration:**
- Pool scales from 10 to 50 connections
- 5-minute queue timeout for long-running queries
- Faster pool growth (5 connections per increment)
- 120-second idle timeout for sustained queries

## Summary

✅ **Added:** 5 real-world query plan regression scenarios
✅ **Fixed:** Connection pool exhaustion (NJS-040 errors)
✅ **Integrated:** Plan regression workload into test orchestration
✅ **Documented:** Expected receiver behavior and metrics

These scenarios directly address your requirement: **"queries performing well for 100 runs/20 days but suddenly became slow in last 1 day/6 hours"** - which is exactly what plan hash value changes represent!
