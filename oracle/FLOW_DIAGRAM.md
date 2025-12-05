# 🔄 Complete Flow: Simulator → Oracle → Receiver

```
┌─────────────────────────────────────────────────────────────────────┐
│                    HR WORKLOAD SIMULATOR                            │
│                   (hr-workload-simulator.go)                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Generates Workload
                              ▼
    ┌──────────────────────────────────────────────────────┐
    │               ORACLE DATABASE (PDB1)                 │
    │                    HR SCHEMA                         │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │  ┌────────────────────────────────────────────┐    │
    │  │ 1. SLOW QUERIES in v$sqlarea               │    │
    │  ├────────────────────────────────────────────┤    │
    │  │ sql_id          avg_elapsed_ms  executions │    │
    │  │ a1b2c3d4e5f6    3450           5          │    │
    │  │ g7h8i9j0k1l2    2890           12         │    │
    │  │ m3n4o5p6q7r8    4125           3          │    │
    │  └────────────────────────────────────────────┘    │
    │                       │                             │
    │                       │ sql_id list                 │
    │                       ▼                             │
    │  ┌────────────────────────────────────────────┐    │
    │  │ 2. WAIT EVENTS in v$session                │    │
    │  ├────────────────────────────────────────────┤    │
    │  │ sid  sql_id        child#  wait_ms status  │    │
    │  │ 123  a1b2c3d4e5f6  0       2100    ACTIVE │    │
    │  │ 124  g7h8i9j0k1l2  1       1500    ACTIVE │    │
    │  │ 125  a1b2c3d4e5f6  0       8500    ACTIVE │    │ ◄── BLOCKED!
    │  │                             ▲               │    │
    │  │                             │ blocking_session=123
    │  └────────────────────────────────────────────┘    │
    │                       │                             │
    │          (sql_id, child_number) pairs              │
    │                       ▼                             │
    │  ┌────────────────────────────────────────────┐    │
    │  │ 3. CHILD CURSORS in v$sql                  │    │
    │  ├────────────────────────────────────────────┤    │
    │  │ sql_id        child#  plan_hash  avg_ms    │    │
    │  │ a1b2c3d4e5f6  0       1234567    3450     │    │
    │  │ a1b2c3d4e5f6  1       9876543    2890     │    │ ◄── Multiple plans!
    │  └────────────────────────────────────────────┘    │
    │                       │                             │
    │                       ▼                             │
    │  ┌────────────────────────────────────────────┐    │
    │  │ 4. EXECUTION PLANS in v$sql_plan           │    │
    │  ├────────────────────────────────────────────┤    │
    │  │ sql_id        child#  id  operation        │    │
    │  │ a1b2c3d4e5f6  0       0   SELECT STATEMENT │    │
    │  │ a1b2c3d4e5f6  0       1   HASH JOIN        │    │
    │  │ a1b2c3d4e5f6  0       2   TABLE ACCESS FULL│    │
    │  └────────────────────────────────────────────┘    │
    │                                                      │
    └──────────────────────────────────────────────────────┘
                              │
                              │ Receiver Queries
                              ▼
    ┌──────────────────────────────────────────────────────┐
    │         YOUR NEWRELICORACLERECEIVER                  │
    │    (opentelemetry-collector-contrib/receiver)        │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │  Step 1: GetSlowQueriesSQL(intervalSeconds)         │
    │          └─> Returns: [sql_id_1, sql_id_2, ...]   │
    │                                                      │
    │  Step 2: GetWaitEventsAndBlockingSQL(rowLimit, sqlIDs)│
    │          └─> Returns: [(sql_id, child#), ...]      │
    │                                                      │
    │  Step 3: GetSpecificChildCursorQuery(sql_id, child#)│
    │          └─> Returns: cursor metrics                │
    │                                                      │
    │  Step 4: GetExecutionPlanForChildQuery(sql_id, child#)│
    │          └─> Returns: execution plan                │
    │                                                      │
    └──────────────────────────────────────────────────────┘
                              │
                              │ Exports Metrics
                              ▼
    ┌──────────────────────────────────────────────────────┐
    │                  TELEMETRY OUTPUT                    │
    │           (OpenTelemetry Metrics/Logs)               │
    ├──────────────────────────────────────────────────────┤
    │                                                      │
    │  newrelicoracledb.query.avg_elapsed_time_ms: 3450   │
    │  newrelicoracledb.wait_events.current_wait_ms: 2100 │
    │  newrelicoracledb.blocking_queries.blocked_ms: 8500 │
    │  newrelicoracledb.child_cursor.plan_hash: 1234567   │
    │                                                      │
    └──────────────────────────────────────────────────────┘
```

---

## 📊 Detailed Worker Flow

### Slow Query Worker
```
[SlowQuery-0] Running
    │
    ├─> Execute: SELECT e1.*, e2.* FROM employees e1, employees e2...
    │   Duration: 3.45s
    │   Rows: 1000
    │
    └─> Stored in v$sqlarea:
        ├─ sql_id: a1b2c3d4e5f6
        ├─ avg_elapsed_time_ms: 3450
        ├─ executions: 1
        └─ query_text: "SELECT e1.*, e2.*..."
```

### Blocking Worker
```
[Blocking-1] Running
    │
    ├─> Session 1 (Blocker):
    │   ├─ BEGIN TRANSACTION
    │   ├─ SELECT ... FOR UPDATE (employee_id=105)
    │   ├─ LOCK ACQUIRED 🔒
    │   └─ HOLD for 10 seconds...
    │
    └─> Session 2 (Blocked):
        ├─ BEGIN TRANSACTION (2s later)
        ├─ SELECT ... FOR UPDATE (employee_id=105)
        ├─ WAITING... ⏳ (blocked by Session 1)
        │   └─ Stored in v$session:
        │       ├─ sid: 124
        │       ├─ sql_id: x7y8z9
        │       ├─ status: ACTIVE
        │       ├─ state: WAITING
        │       ├─ wait_time_micro: 8500000 (8.5s)
        │       ├─ wait_class: Application
        │       ├─ event: enq: TX - row lock contention
        │       ├─ BLOCKING_SESSION: 123
        │       └─ FINAL_BLOCKING_SESSION: 123
        │
        └─> Session 1 RELEASES 🔓
            └─> Session 2 ACQUIRES ✅
```

### Child Cursor Worker
```
[ChildCursor-0] Running
    │
    ├─> Execute: SELECT * FROM employees WHERE dept_id=:1 AND salary>:2
    │   Binds: dept=10, salary=5000
    │   └─> Creates child 0 in v$sql
    │       ├─ sql_id: m9n8b7v6c5
    │       ├─ child_number: 0
    │       ├─ plan_hash_value: 1234567890
    │       └─ avg_elapsed_ms: 45
    │
    ├─> Execute: SELECT * FROM employees WHERE dept_id=:1 AND salary>:2
    │   Binds: dept=50, salary=10000  (different!)
    │   └─> Creates child 1 in v$sql
    │       ├─ sql_id: m9n8b7v6c5  (same!)
    │       ├─ child_number: 1       (new!)
    │       ├─ plan_hash_value: 9876543210 (different plan!)
    │       └─ avg_elapsed_ms: 78
    │
    └─> Execute: SELECT * FROM employees WHERE dept_id=:1 AND salary>:2
        Binds: dept=80, salary=8000  (different again!)
        └─> Creates child 2 in v$sql
            ├─ sql_id: m9n8b7v6c5  (same!)
            ├─ child_number: 2       (new!)
            ├─ plan_hash_value: 5555555555 (different plan!)
            └─ avg_elapsed_ms: 62
```

---

## 🔍 Receiver Query Flow

### Query 1: Get Slow Queries
```sql
-- Executed by: GetSlowQueriesSQL(60)
SELECT sql_id, avg_elapsed_time_ms, ...
FROM v$sqlarea
WHERE parsing_schema_name = 'HR'
  AND last_active_time >= SYSDATE - INTERVAL '60' SECOND
ORDER BY avg_elapsed_time_ms DESC

-- Returns:
-- sql_id         avg_elapsed_ms
-- a1b2c3d4e5f6   3450
-- g7h8i9j0k1l2   2890
-- m3n4o5p6q7r8   4125
```

### Query 2: Get Wait Events (Filtered by sql_id)
```sql
-- Executed by: GetWaitEventsAndBlockingSQL(100, ['a1b2c3d4e5f6', 'g7h8i9j0k1l2', ...])
SELECT sid, sql_id, SQL_CHILD_NUMBER, wait_class, event, ...
FROM v$session
WHERE status = 'ACTIVE'
  AND state = 'WAITING'
  AND WAIT_TIME_MICRO > 0
  AND sql_id IN ('a1b2c3d4e5f6', 'g7h8i9j0k1l2', ...)  ◄── Filtered!
ORDER BY WAIT_TIME_MICRO DESC
FETCH FIRST 100 ROWS ONLY

-- Returns:
-- sid  sql_id        child#  wait_ms  blocking_session
-- 123  a1b2c3d4e5f6  0       2100     NULL
-- 125  a1b2c3d4e5f6  0       8500     123  ◄── Blocked!
-- 124  g7h8i9j0k1l2  1       1500     NULL
```

### Query 3: Get Specific Child Cursor
```sql
-- Executed by: GetSpecificChildCursorQuery('a1b2c3d4e5f6', 0)
SELECT sql_id, child_number, plan_hash_value, ...
FROM v$sql
WHERE sql_id = 'a1b2c3d4e5f6'
  AND child_number = 0

-- Returns:
-- sql_id        child#  plan_hash   avg_elapsed_ms
-- a1b2c3d4e5f6  0       1234567890  3450
```

### Query 4: Get Execution Plan
```sql
-- Executed by: GetExecutionPlanForChildQuery('a1b2c3d4e5f6', 0)
SELECT SQL_ID, CHILD_NUMBER, ID, PARENT_ID, OPERATION, OPTIONS, ...
FROM V$SQL_PLAN
WHERE SQL_ID = 'a1b2c3d4e5f6'
  AND CHILD_NUMBER = 0

-- Returns:
-- sql_id        child#  id  operation         options
-- a1b2c3d4e5f6  0       0   SELECT STATEMENT  
-- a1b2c3d4e5f6  0       1   HASH JOIN         
-- a1b2c3d4e5f6  0       2   TABLE ACCESS      FULL
-- a1b2c3d4e5f6  0       3   TABLE ACCESS      FULL
```

---

## 📈 Expected Timeline (15-minute run)

```
Time    | Simulator Activity                    | Database State
--------+---------------------------------------+----------------------------------
00:00   | Start all workers                     | No HR activity
00:05   | 2 slow queries running               | v$sqlarea: 2 entries
00:10   | First blocking scenario starts       | v$session: 1 blocked session
00:15   | 5 child cursors created              | v$sql: 5 child entries
00:30   | 15 slow queries total                | v$sqlarea: 15+ entries
00:45   | 3rd blocking scenario                | Active blocking chains
01:00   | Statistics report                     | Peak activity
        | Slow Queries: 60                      |
        | Blocking Events: 12                   |
        | I/O Queries: 48                       |
        | Child Cursors: 100                    |
--------+---------------------------------------+----------------------------------
05:00   | Mid-point                             | Sustained load
        | Slow Queries: 145                     |
        | Blocking Events: 42                   |
        | Child Cursors: 250                    |
--------+---------------------------------------+----------------------------------
10:00   | Continuing...                         | More complex blocking chains
--------+---------------------------------------+----------------------------------
15:00   | Graceful shutdown                     | All transactions rolled back
        | Final stats printed                   | Cleanup complete
        | Slow Queries: 287                     |
        | Blocking Events: 89                   |
        | I/O Queries: 245                      |
        | Child Cursors: 502                    |
```

---

## ✅ Validation Checklist

Run `verify_workload.sql` and check:

- [ ] **Section 1:** At least 10 slow queries in v$sqlarea
- [ ] **Section 2:** Active sessions with status='ACTIVE', state='WAITING'
- [ ] **Section 3:** At least 1 blocking chain visible
- [ ] **Section 4:** Multiple child_number for same sql_id
- [ ] **Section 5:** Various wait_class values (User I/O, Concurrency, Application)
- [ ] **Section 6:** Common wait events listed
- [ ] **Section 7:** Execution summary shows HR activity
- [ ] **Section 8:** Recent activity within last 5 minutes
- [ ] **Section 9:** Lock information populated
- [ ] **Section 10:** Multiple execution plans per SQL_ID

If all sections show data → **Simulator is working correctly! ✅**

---

**Visual Flow Complete! Use this diagram to understand the end-to-end flow.** 🎯
