# 📦 HR Workload Simulator - Complete Package

## 📋 Package Contents

Your HR Workload Simulator is now ready! Here's what was created:

### Core Files

1. **`hr-workload-simulator.go`** (19 KB)
   - Main Go application
   - 5 worker types for different scenarios
   - Comprehensive statistics tracking
   - Graceful shutdown handling

2. **`run-simulator.sh`** (7.9 KB, executable)
   - One-command runner
   - Auto-build capability
   - Preset configurations (light/medium/heavy)
   - Connection testing

3. **`verify_workload.sql`**
   - 10 verification queries
   - Checks all aspects of generated workload
   - Easy-to-read output format

4. **`HR_WORKLOAD_SIMULATOR_README.md`**
   - Full documentation
   - Detailed setup instructions
   - Troubleshooting guide
   - Performance tuning tips

5. **`QUICK_START.md`**
   - TL;DR version
   - Quick commands
   - Common workflows

---

## 🎯 What This Simulator Does

### Perfectly Aligns with Your Receiver Flow

```
┌──────────────────────────────────────────────────────────────┐
│ YOUR RECEIVER FLOW                                           │
├──────────────────────────────────────────────────────────────┤
│ Step 1: Query v$sqlarea                                      │
│         WHERE avg_elapsed_time_ms is high                    │
│         ➜ Returns: [sql_id_1, sql_id_2, ...]               │
│                                                              │
│ Step 2: Query v$session                                      │
│         WHERE status='ACTIVE' AND state='WAITING'            │
│         AND wait_time_micro>0                                │
│         AND sql_id IN (sql_id_1, sql_id_2, ...)            │
│         ➜ Returns: [(sql_id, child_number), ...]           │
│                                                              │
│ Step 3: Query v$sql for child cursors                       │
│         WHERE sql_id=X AND child_number=Y                    │
│                                                              │
│ Step 4: Query v$sql_plan for execution plans                │
│         WHERE sql_id=X AND child_number=Y                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ WHAT SIMULATOR GENERATES                                     │
├──────────────────────────────────────────────────────────────┤
│ ✓ Slow queries → Populates v$sqlarea                        │
│   - Cartesian joins (high CPU)                              │
│   - Complex aggregations (high elapsed time)                │
│   - Multi-table joins (high buffer gets)                    │
│                                                              │
│ ✓ Wait events → Creates ACTIVE/WAITING sessions             │
│   - I/O waits (full table scans)                            │
│   - Lock waits (enq: TX - row lock contention)              │
│   - Latch waits (concurrent access)                         │
│                                                              │
│ ✓ Blocking → Creates blocker-blocked chains                 │
│   - Session A: SELECT FOR UPDATE (holds lock)               │
│   - Session B: SELECT FOR UPDATE (blocks)                   │
│   - Tracks BLOCKING_SESSION and FINAL_BLOCKING_SESSION      │
│                                                              │
│ ✓ Child cursors → Multiple plans for same SQL_ID            │
│   - Same query, different bind values                       │
│   - Different execution plans                               │
│   - Different child_numbers (0, 1, 2, ...)                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start (3 Steps)

### Step 1: Build
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
./run-simulator.sh build
```

### Step 2: Run
```bash
./run-simulator.sh run
```

### Step 3: Verify
```bash
# In another terminal
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com @verify_workload.sql
```

---

## 📊 Workload Scenarios Generated

### 1. Slow Query Worker (2 workers)
**Purpose:** Generate queries with high avg_elapsed_time_ms in v$sqlarea

**Queries Generated:**
- Cartesian joins between employee tables
- Complex multi-table aggregations with GROUP BY
- Recursive manager hierarchy queries
- Analytical functions with window operations

**Metrics Triggered:**
- `avg_elapsed_time_ms` > 1000ms
- `avg_cpu_time_ms` > 500ms
- `avg_disk_reads` > 100

**Example:**
```sql
SELECT e1.employee_id, e2.employee_id
FROM employees e1, employees e2
WHERE e1.salary < e2.salary  -- Creates 107x107 cartesian product
```

### 2. Blocking Worker (3 workers)
**Purpose:** Create lock contention and blocking sessions

**Scenario:**
1. Session 1: `SELECT ... FOR UPDATE` (acquires row lock)
2. Wait 2 seconds
3. Session 2: `SELECT ... FOR UPDATE` (blocks on same row)
4. Session 1 holds lock for 8-15 seconds
5. Session 1 releases (rollback)
6. Session 2 acquires lock

**Metrics Triggered:**
- `blocked_time_ms` > 5000ms
- `BLOCKING_SESSION` populated
- `wait_class` = 'Application'
- `event` = 'enq: TX - row lock contention'

### 3. I/O Intensive Worker (2 workers)
**Purpose:** Generate disk reads/writes with full table scans

**Queries Generated:**
- FULL table hints to bypass indexes
- Large sort operations requiring disk
- Hash joins with multiple tables
- Pattern matching with LIKE on non-indexed columns

**Metrics Triggered:**
- `avg_disk_reads` > 50
- `wait_class` = 'User I/O'
- `event` = 'db file sequential read'

**Example:**
```sql
SELECT /*+ FULL(e) */ *
FROM employees e
WHERE LOWER(first_name) LIKE '%a%'  -- Forces full scan
```

### 4. Child Cursor Worker (2 workers)
**Purpose:** Create multiple execution plans for same SQL_ID

**Method:**
- Same SQL text
- Different bind variable values
- Oracle creates different child cursors
- Each has unique child_number and plan_hash_value

**Metrics Triggered:**
- Same `sql_id` with multiple `child_number` values (0, 1, 2, ...)
- Different `plan_hash_value` for each child
- Different execution statistics per child

**Example:**
```sql
-- Creates multiple children based on bind values
SELECT * FROM employees WHERE department_id = :1 AND salary > :2

-- Child 0: dept=10, salary=5000  (small dept, selective)
-- Child 1: dept=50, salary=10000 (large dept, different plan)
-- Child 2: dept=80, salary=8000  (different selectivity)
```

### 5. Concurrency Worker (2 workers)
**Purpose:** Generate latch contention and concurrency waits

**Method:**
- Burst of 10 rapid-fire queries
- Concurrent access to same data
- Creates latch contention

**Metrics Triggered:**
- `wait_class` = 'Concurrency'
- `event` = 'latch: cache buffers chains'
- High frequency, low duration waits

---

## 🎛️ Configuration Options

### Preset Modes

| Mode | Duration | Workers | Use Case |
|------|----------|---------|----------|
| **Light** | 5 min | 1 each | Quick test, development |
| **Medium** | 15 min | 2-3 each | Standard testing, receiver validation |
| **Heavy** | 30 min | 4-5 each | Stress test, performance benchmarking |

### Custom Configuration

```bash
./run-simulator.sh custom \
  -duration 20m \
  -slow-workers 3 \
  -block-workers 5 \
  -io-workers 3 \
  -child-workers 2 \
  -concurrency-workers 4
```

---

## 📈 Expected Metrics in Your Receiver

### From v$sqlarea (Slow Queries)
```yaml
newrelicoracledb.query.avg_elapsed_time_ms: 3450
newrelicoracledb.query.avg_cpu_time_ms: 1200
newrelicoracledb.query.avg_disk_reads: 250
newrelicoracledb.query.execution_count: 5
attributes:
  query_id: a1b2c3d4e5f6
  schema_name: HR
  query_text: "SELECT e1.*, e2.* FROM employees..."
```

### From v$session (Wait Events)
```yaml
newrelicoracledb.wait_events.current_wait_time_ms: 2100
attributes:
  sid: "123"
  sql_id: a1b2c3d4e5f6
  sql_child_number: "0"
  status: ACTIVE
  state: WAITING
  wait_class: User I/O
  wait_event: db file sequential read
```

### From Blocking Detection
```yaml
newrelicoracledb.blocking_queries.blocked_time_ms: 8500
attributes:
  blocked_sid: "124"
  blocked_query_id: x7y8z9
  immediate_blocker_sid: "123"
  final_blocker_sid: "123"
  final_blocker_query_id: a1b2c3d4e5f6
```

### From Child Cursors
```yaml
# Child 0
newrelicoracledb.child_cursor.avg_elapsed_time_ms: 45
attributes:
  sql_id: m9n8b7v6c5
  child_number: "0"
  plan_hash_value: "1234567890"
  
# Child 1 (same sql_id, different plan)
newrelicoracledb.child_cursor.avg_elapsed_time_ms: 78
attributes:
  sql_id: m9n8b7v6c5
  child_number: "1"
  plan_hash_value: "9876543210"
```

---

## 🧪 Testing Workflow

### Complete Test Cycle

```bash
# Terminal 1: Start simulator
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
./run-simulator.sh medium

# Terminal 2: Run receiver
cd /Users/spathlavath/otel/opentelemetry-collector-contrib
export ORACLE_USER=C##OTEL_MONITOR
export ORACLE_PASSWORD=your_monitor_password
export ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
./bin/otelcol_linux_amd64 --config=config.yaml

# Terminal 3: Verify workload
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
SQL> @verify_workload.sql

# Terminal 4: Monitor receiver logs
tail -f /path/to/receiver/logs
```

### Validation Checklist

- [ ] Slow queries appear in v$sqlarea with high avg_elapsed_time_ms
- [ ] Active sessions show status='ACTIVE', state='WAITING'
- [ ] wait_time_micro > 0 for waiting sessions
- [ ] Blocking sessions have BLOCKING_SESSION populated
- [ ] Same SQL_ID has multiple child_number entries
- [ ] Different plan_hash_values for different child cursors
- [ ] Receiver collects slow queries from Step 1
- [ ] Receiver filters sessions by sql_id list in Step 2
- [ ] Receiver queries specific child cursors in Step 3
- [ ] Receiver retrieves execution plans in Step 4

---

## 🔍 Verification Queries

### Quick Check: Are queries running?
```sql
SELECT COUNT(*) FROM v$sqlarea WHERE parsing_schema_name = 'HR';
```

### Quick Check: Any wait events?
```sql
SELECT COUNT(*) FROM v$session 
WHERE username = 'HR' AND status = 'ACTIVE' AND state = 'WAITING';
```

### Quick Check: Any blocking?
```sql
SELECT COUNT(*) FROM v$session 
WHERE username = 'HR' AND BLOCKING_SESSION IS NOT NULL;
```

### Quick Check: Child cursors?
```sql
SELECT sql_id, COUNT(*) as children 
FROM v$sql 
WHERE parsing_schema_name = 'HR' 
GROUP BY sql_id 
HAVING COUNT(*) > 1;
```

---

## 📊 Output Example

```
=== HR Workload Simulator ===
Database: hr@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
Duration: 15m0s
Workers: Slow=2, Blocking=3, I/O=2, ChildCursor=2, Concurrency=2
==============================

✓ Database connection successful
  • EMPLOYEES: 107 rows
  • DEPARTMENTS: 27 rows
  • JOBS: 19 rows
  • LOCATIONS: 23 rows
  • COUNTRIES: 25 rows
  • REGIONS: 4 rows
✓ HR schema verified

🚀 Starting workload generators...

[SlowQuery-0] Query executed in 3.45s (1000 rows)
[Blocking-1] 🔒 Session 1 locked employee 105 (salary=8000.00)
[Blocking-1] ⏳ Session 2 attempting to lock employee 105 (will block)...
[IO-0] I/O query executed in 2.1s (107 rows)
[ChildCursor-0] Executed with binds dept=10, salary=5000 (4 rows)
[Concurrency-1] Executed burst of 10 concurrent queries
[SlowQuery-1] Query executed in 4.23s (27 rows)
[Blocking-1] ✅ Session 2 acquired lock on employee 105 after waiting 8.2s
[ChildCursor-1] Executed with binds dept=50, salary=10000 (12 rows)

=== Workload Statistics ===
Slow Queries Run:         145
Blocking Events Created:  42
I/O Intensive Queries:    128
Child Cursors Generated:  250
Wait Events Generated:    55
Errors:                   0
===========================

⏱️  Duration elapsed, shutting down...

✅ Workload simulation completed

=== Workload Statistics ===
Slow Queries Run:         287
Blocking Events Created:  89
I/O Intensive Queries:    245
Child Cursors Generated:  502
Wait Events Generated:    112
Errors:                   0
===========================
```

---

## 🔧 Troubleshooting

### Issue: Build fails with "godror not found"

**Solution:**
```bash
export ORACLE_HOME=/usr/lib/oracle/21/client64
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:$LD_LIBRARY_PATH
go clean -modcache
go get github.com/godror/godror@latest
./run-simulator.sh build
```

### Issue: Connection refused

**Solution:**
```bash
# Test connection
tnsping 10.0.1.36:1521

# Test SQL*Plus
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

# Check firewall
telnet 10.0.1.36 1521
```

### Issue: No data in v$sqlarea

**Solution:**
```bash
# Check if queries are actually running
ps aux | grep hr-workload

# Check for errors in output
./run-simulator.sh run 2>&1 | tee simulator.log

# Verify HR schema access
sqlplus hr/pass@db
SQL> SELECT COUNT(*) FROM employees;
```

### Issue: Too many connections

**Solution:**
```bash
# Use light mode
./run-simulator.sh light

# Or reduce workers manually
./run-simulator.sh custom -duration 5m -slow-workers 1 -block-workers 1
```

---

## 📚 File Reference

```
db-perfromance-testing/oracle/
│
├── hr-workload-simulator.go          # Main application (19 KB)
├── run-simulator.sh                  # Run script (7.9 KB, executable)
├── verify_workload.sql               # Verification queries
├── HR_WORKLOAD_SIMULATOR_README.md   # Full documentation
├── QUICK_START.md                    # Quick reference
├── THIS_FILE.md                      # This summary
│
├── .env                              # Your credentials (gitignored)
├── .env.example                      # Template
│
└── (generated files)
    ├── hr-workload-simulator         # Compiled binary (after build)
    ├── go.mod                        # Go module definition
    └── go.sum                        # Go dependencies
```

---

## 🎯 Success Criteria

Your receiver should successfully:

1. ✅ Query v$sqlarea and find HR queries with high elapsed time
2. ✅ Filter those queries by your threshold
3. ✅ Query v$session with sql_id IN (...) filter
4. ✅ Find ACTIVE sessions with state='WAITING'
5. ✅ Extract (sql_id, child_number) pairs
6. ✅ Query v$sql for specific child cursors
7. ✅ Query v$sql_plan for execution plans
8. ✅ Detect blocking chains with BLOCKING_SESSION
9. ✅ Record metrics for all scenarios

---

## 🚦 Next Steps

1. **Build:** `./run-simulator.sh build`
2. **Test connection:** `./run-simulator.sh test`
3. **Light run:** `./run-simulator.sh light` (5 minutes)
4. **Verify:** Run `verify_workload.sql`
5. **Start receiver:** Test data collection
6. **Medium run:** `./run-simulator.sh medium` (15 minutes)
7. **Production test:** Adjust workers as needed

---

## 📞 Support

- **Documentation:** `HR_WORKLOAD_SIMULATOR_README.md`
- **Quick Start:** `QUICK_START.md`
- **Verification:** `verify_workload.sql`
- **Help:** `./run-simulator.sh help`

---

**✨ Your HR Workload Simulator is ready to test your receiver! ✨**

Start with:
```bash
./run-simulator.sh run
```
