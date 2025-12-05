# Receiver Flow Analysis - Which Scenarios Are Useful?

## Exact Receiver Flow (From Code Analysis)

###Step 1: Slow Queries Scraper
```
Query: v$sqlarea
Filter: last_active_time >= SYSDATE - INTERVAL 'N' SECOND
Returns: List of sql_id with high avg_elapsed_time_ms
Example: ['abc123xyz', 'def456uvw', 'ghi789rst']
```

**Key Points:**
- ✅ Queries v$sqlarea (cumulative statistics)
- ✅ Does NOT require WAITING state
- ✅ Looks at avg_elapsed_time_ms across all executions
- ✅ Returns TOP N slow sql_ids after delta calculation

### Step 2: Wait Events Scraper (WITH FILTERING!)
```sql
SELECT ... FROM v$session s
WHERE
    s.status = 'ACTIVE'
    AND s.state = 'WAITING'  ← MUST be waiting!
    AND s.wait_class <> 'Idle'
    AND s.WAIT_TIME_MICRO > 0
    AND s.sql_id IN ('abc123xyz', 'def456uvw', 'ghi789rst')  ← FILTERED by slow query sql_ids!
```

**CRITICAL**: Wait events query is **FILTERED by the slow query sql_ids from Step 1!**

This means:
1. Query must show up in v$sqlarea as "slow" first
2. THEN it must have an ACTIVE WAITING session
3. ONLY THEN will receiver capture (sql_id, child_number)

### Step 3: Child Cursor Scraper
```
For each (sql_id, child_number) from Step 2:
Query: v$sql WHERE sql_id = X AND child_number = Y
Returns: plan_hash_value, execution metrics
```

### Step 4: Execution Plan Scraper
```
Query: v$sql_plan WHERE sql_id = X AND child_number = Y
Returns: Full execution plan details
```

---

## Which Test Scenarios Are Useful?

Based on the EXACT flow above, a scenario is useful ONLY if it:

1. ✅ **Shows up in v$sqlarea** with high avg_elapsed_time_ms (gets into slow query list)
2. ✅ **Creates ACTIVE WAITING sessions** (status='ACTIVE' AND state='WAITING')
3. ✅ **Runs long enough** for receiver to capture (15-30+ seconds)
4. ✅ **Has valid sql_id and child_number**

---

## Workload Analysis

### ✅ USEFUL: blocking-sessions-workload.js

**Why Useful:**
- Creates ACTIVE WAITING sessions with row locks (enq: TX - row lock contention)
- Queries appear in v$sqlarea as slow
- Valid sql_id + child_number
- Creates blocking chains (FINAL_BLOCKING_SESSION tracking)

**Scenarios:**
1. Row lock contention (15-25s locks)
2. Blocking chains (30s)
3. Index contention
4. Application contention

**Receiver captures:**
- Slow queries from v$sqlarea
- Wait events filtered to those slow sql_ids
- Child cursors with plan_hash_value
- Execution plans

---

### ✅ USEFUL: complex-query-workload.js

**Why Useful:**
- Complex joins create I/O waits (direct path read, buffer busy waits)
- Queries run 20-30 seconds
- Enter WAITING state due to I/O operations
- Appear in v$sqlarea as slow

**Scenarios:**
1. 6-table joins with window functions
2. Analytical aggregations with ROLLUP
3. Hierarchical queries (CONNECT BY)
4. Self-joins with Cartesian products
5. Time-series analysis

**Receiver captures:**
- High avg_elapsed_time_ms in v$sqlarea
- User I/O wait events
- Execution plans showing FULL SCANS, HASH JOINS, SORTS

---

### ✅ USEFUL: plan-regression-workload.js

**Why Useful:**
- Creates queries that appear in v$sqlarea with different performance
- Long-running queries (15-25s) enter WAITING state
- Same query logic with different plan_hash_value

**Scenarios:**
1. Heavy multi-table join with plan variation (INDEX vs FULL SCAN)
2. Bind variable causing plan differences

**Receiver captures:**
- Same query pattern with varying avg_elapsed_time_ms
- ACTIVE WAITING sessions (I/O waits)
- **DIFFERENT plan_hash_value for similar queries** ← KEY for regression detection!

---

### ⚠️ PARTIALLY USEFUL: lock-workload.js

**Why Partially Useful:**
- Creates row locks (WAITING state) ✅
- But queries may be too simple/fast to appear in slow queries ❌

**Recommendation:** Keep for lock/wait event testing, but may not trigger full flow

---

### ⚠️ PARTIALLY USEFUL: memory-workload.js

**Why Partially Useful:**
- Some queries create temp I/O waits ✅
- But primarily tests memory metrics, not slow query flow ❌

**Recommendation:** Keep for memory metrics, but not primary for receiver flow

---

### ❌ NOT USEFUL FOR RECEIVER FLOW: query-workload.js

**Why Not Useful:**
- **Fast queries** (< 1 second) - Won't appear in slow queries
- Don't enter WAITING state long enough
- Parse-intensive workload tests parsing metrics, not slow query flow

**Recommendation:**
- Keep for parse metrics and general activity
- But won't trigger the slow queries → wait events → child cursors flow

---

### ❌ NOT USEFUL FOR RECEIVER FLOW: transaction-workload.js

**Why Not Useful:**
- Short transactions (< 5 seconds)
- Don't appear in slow queries
- Tests transaction metrics (commits/rollbacks), not slow query detection

**Recommendation:**
- Keep for transaction metrics
- But won't trigger receiver flow

---

### ❌ NOT USEFUL FOR RECEIVER FLOW: connection-workload.js

**Why Not Useful:**
- Tests connection pool behavior
- No queries that appear in slow queries
- No WAITING states created

**Recommendation:**
- Keep for connection metrics
- But irrelevant to receiver flow

---

## K6 Configuration Analysis

**File:** `k6/scripts/hr-portal-load-test.js`

### ✅ Configuration is GOOD!

**Load Pattern:**
```javascript
stages: [
  { duration: '2m', target: 3 },   // Ramp up
  { duration: '25m', target: 5 },  // Sustained load
  { duration: '3m', target: 0 },   // Ramp down
]
```

**Request Distribution:**
- 30% List employees (SELECT with JOIN)
- 25% Employee details (SELECT with multiple JOINs)
- 15% Department stats (SELECT with aggregation)
- 10% Department employees
- 5% Salary report (Complex aggregation) ← Can create slow queries!
- 5% Jobs list
- 3% Update employee
- 5% Job history
- 1% Create employee
- 1% Promote employee (transaction)

### ⚠️ K6 Limitation for Receiver Flow

**Problem:** K6 queries are mostly **fast** (< 2 seconds threshold in config)

```javascript
thresholds: {
  'http_req_duration': ['p(95)<2000'], // 95% under 2s
}
```

**Impact:**
- K6 queries won't appear in v$sqlarea as "slow"
- Won't trigger slow queries → wait events flow
- K6 is good for **general database activity** and **APM traces**
- But not for testing **slow query detection**

### 💡 K6 Recommendation

**Keep k6 as-is for:**
- ✅ Generating realistic API load
- ✅ Testing OpenTelemetry APM traces
- ✅ Creating background database activity
- ✅ Stress testing application endpoints

**Do NOT rely on k6 for:**
- ❌ Slow query detection
- ❌ Wait event capture
- ❌ Plan regression testing

**Reason:** The test-all-features.js workloads are specifically designed to create slow queries and wait events. K6 creates fast, realistic user traffic.

---

## Recommended Workload Configuration

### Priority 1: Core Receiver Flow Testing ✅

```javascript
// In test-all-features.js - KEEP THESE:
1. blocking-sessions-workload  (Creates WAITING sessions + appears in slow queries)
2. complex-query-workload      (Creates I/O waits + appears in slow queries)
3. plan-regression-workload    (Tests plan_hash_value changes + appears in slow queries)
```

**These 3 workloads fully test the receiver flow:**
- Slow queries in v$sqlarea ✅
- ACTIVE WAITING sessions ✅
- sql_id filtering ✅
- Child cursors with plan_hash_value ✅
- Execution plans ✅

### Priority 2: Additional Metrics (Optional)

```javascript
4. lock-workload          (For lock metrics, partially triggers flow)
5. memory-workload        (For memory metrics, partially triggers flow)
```

### Priority 3: Background Activity (Optional)

```javascript
6. query-workload         (Parse metrics, general activity)
7. transaction-workload   (Transaction metrics)
8. connection-workload    (Connection pool metrics)
```

**Note:** Priority 3 workloads don't trigger the main receiver flow but provide additional database activity.

---

## Summary: What Should You Keep/Remove?

### ✅ KEEP - Essential for Receiver Flow:
1. **blocking-sessions-workload.js** - ACTIVE WAITING + slow queries
2. **complex-query-workload.js** - I/O waits + slow queries
3. **plan-regression-workload.js** - Plan variations + slow queries

### ⚠️ KEEP BUT OPTIONAL - Partial Flow Trigger:
4. **lock-workload.js** - Lock metrics
5. **memory-workload.js** - Memory metrics

### ❌ OPTIONAL - No Flow Trigger (But Useful for Other Metrics):
6. **query-workload.js** - Parse metrics only
7. **transaction-workload.js** - Transaction metrics only
8. **connection-workload.js** - Connection metrics only

### ✅ KEEP - K6 Load Testing:
9. **k6/scripts/hr-portal-load-test.js** - Realistic API load, APM traces

---

## Final Recommendation

**Minimal Setup (Tests Full Receiver Flow):**
```javascript
// test-all-features.js
complexQueryWorkload.start(pool, logger, duration, 'low');
blockingSessionsWorkload.start(pool, logger, duration, 'low');
planRegressionWorkload.start(pool, logger, duration, 'low');
```

This minimal setup will:
1. ✅ Create slow queries in v$sqlarea
2. ✅ Create ACTIVE WAITING sessions
3. ✅ Trigger sql_id filtering
4. ✅ Generate child cursor metrics with plan_hash_value
5. ✅ Produce execution plans

**Full Setup (Tests All Metrics):**
Keep all workloads but understand:
- Only 3 workloads test the core receiver flow
- Others provide additional metrics but don't trigger flow
- K6 provides realistic API load but queries are too fast for slow query detection

---

## Verification Query

Check if your scenarios are triggering the receiver flow:

```sql
-- 1. Check slow queries in v$sqlarea (Step 1)
SELECT sql_id, executions,
       ROUND(elapsed_time/executions/1000, 2) as avg_elapsed_ms
FROM v$sqlarea
WHERE parsing_schema_name = 'HR'
  AND last_active_time >= SYSDATE - INTERVAL '60' SECOND
  AND executions > 0
ORDER BY avg_elapsed_ms DESC
FETCH FIRST 10 ROWS ONLY;

-- 2. Check ACTIVE WAITING sessions for those sql_ids (Step 2)
SELECT s.sid, s.sql_id, s.sql_child_number, s.state, s.wait_class, s.event
FROM v$session s
WHERE s.status = 'ACTIVE'
  AND s.state = 'WAITING'
  AND s.wait_class <> 'Idle'
  AND s.sql_id IN (
    SELECT sql_id FROM v$sqlarea
    WHERE parsing_schema_name = 'HR'
    AND last_active_time >= SYSDATE - INTERVAL '60' SECOND
    ORDER BY elapsed_time/executions DESC
    FETCH FIRST 10 ROWS ONLY
  );

-- 3. Check child cursors (Step 3)
SELECT sql_id, child_number, plan_hash_value, executions
FROM v$sql
WHERE sql_id IN ('...')  -- sql_ids from above
ORDER BY sql_id, child_number;
```

If all 3 queries return results, your receiver flow is working! 🎉
