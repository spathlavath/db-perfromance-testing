# 🎯 HR Workload Simulator - FINAL INSTRUCTIONS

## 📦 What Was Created

I've created a **complete HR schema workload simulator** in Go that generates all the conditions your `newrelicoraclereceiver` is designed to monitor.

### Files Created (8 files)

1. **`hr-workload-simulator.go`** - Main Go application (607 lines)
2. **`run-simulator.sh`** - Easy runner script with presets
3. **`setup-and-test.sh`** - One-command complete setup
4. **`verify_workload.sql`** - SQL verification script (10 checks)
5. **`QUICK_START.md`** - TL;DR instructions
6. **`HR_WORKLOAD_SIMULATOR_README.md`** - Complete documentation
7. **`COMPLETE_PACKAGE_SUMMARY.md`** - Feature overview
8. **`FLOW_DIAGRAM.md`** - Visual flow diagrams

---

## 🚀 QUICK START (3 Commands)

### On Your VM, run these commands:

```bash
# 1. Navigate to the directory
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# 2. Run setup (one-time)
./setup-and-test.sh

# 3. Start simulator
./run-simulator.sh run
```

**That's it!** The simulator will run for 5 minutes generating workload.

---

## 🎯 What It Generates (Matches Your Receiver Flow Exactly)

### Your Receiver Flow:
```
1. Query v$sqlarea → Returns sql_id list with high avg_elapsed_time_ms
2. Query v$session → Filters by those sql_ids, returns (sql_id, child_number) pairs
3. Query v$sql → Gets specific child cursor details
4. Query v$sql_plan → Gets execution plan
```

### What Simulator Creates:
```
✅ Slow queries in v$sqlarea
   - Cartesian joins (high CPU, 3-5s execution)
   - Complex aggregations (high elapsed time)
   - Multi-table joins (high buffer gets)

✅ Wait events in v$session
   - status='ACTIVE'
   - state='WAITING'
   - wait_time_micro > 0
   - Various wait classes (User I/O, Concurrency, Application)

✅ Blocking sessions
   - Session A locks row (SELECT FOR UPDATE)
   - Session B waits (blocks for 8-15 seconds)
   - BLOCKING_SESSION populated
   - blocked_time_ms > 5000

✅ Child cursors
   - Same SQL_ID
   - Different child_number (0, 1, 2, ...)
   - Different plan_hash_value
   - Different execution plans
```

---

## 📊 Worker Types (5 Types)

| Worker | Count | Purpose | What It Creates |
|--------|-------|---------|-----------------|
| **Slow Query** | 2 | CPU-intensive queries | High avg_elapsed_time_ms in v$sqlarea |
| **Blocking** | 3 | Lock contention | Blocked sessions with BLOCKING_SESSION |
| **I/O Intensive** | 2 | Disk reads/writes | User I/O wait events |
| **Child Cursor** | 2 | Multiple execution plans | Same sql_id, different child_number |
| **Concurrency** | 2 | Latch contention | Concurrency wait events |

---

## 🧪 Testing Your Receiver

### Terminal 1: Start Simulator
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
./run-simulator.sh medium   # Runs for 15 minutes
```

### Terminal 2: Start Your Receiver
```bash
cd /Users/spathlavath/otel/opentelemetry-collector-contrib
export ORACLE_USER=C##OTEL_MONITOR
export ORACLE_PASSWORD=your_monitor_password
export ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
./bin/otelcol_linux_amd64 --config=your-config.yaml
```

### Terminal 3: Verify Workload
```bash
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
SQL> @verify_workload.sql
```

You should see:
- ✅ Slow queries in v$sqlarea
- ✅ Active/waiting sessions
- ✅ Blocking chains
- ✅ Multiple child cursors
- ✅ Various wait events

---

## 🎛️ Run Modes

| Command | Duration | Workers | Use Case |
|---------|----------|---------|----------|
| `./run-simulator.sh run` | 5 min | 2-3 each | Quick test |
| `./run-simulator.sh light` | 5 min | 1 each | Development |
| `./run-simulator.sh medium` | 15 min | 2-3 each | **Recommended for testing** |
| `./run-simulator.sh heavy` | 30 min | 4-5 each | Stress test |

### Custom Run
```bash
./run-simulator.sh custom \
  -duration 10m \
  -slow-workers 3 \
  -block-workers 4 \
  -io-workers 2
```

---

## 📈 Expected Output

```
=== HR Workload Simulator ===
Database: hr@10.0.1.36:1521/pdb1...
Duration: 15m0s
Workers: Slow=2, Blocking=3, I/O=2, ChildCursor=2, Concurrency=2
==============================

✓ Database connection successful
  • EMPLOYEES: 107 rows
  • DEPARTMENTS: 27 rows
  • JOBS: 19 rows
✓ HR schema verified

🚀 Starting workload generators...

[SlowQuery-0] Query executed in 3.45s (1000 rows)
[Blocking-1] 🔒 Session 1 locked employee 105
[Blocking-1] ⏳ Session 2 attempting to lock employee 105 (will block)...
[IO-0] I/O query executed in 2.1s (107 rows)
[ChildCursor-0] Executed with binds dept=10, salary=5000 (4 rows)
[Concurrency-1] Executed burst of 10 concurrent queries

=== Workload Statistics ===  (every 10 seconds)
Slow Queries Run:         45
Blocking Events Created:  12
I/O Intensive Queries:    38
Child Cursors Generated:  50
Wait Events Generated:    15
Errors:                   0
===========================
```

---

## ✅ Verification Checklist

After starting simulator, verify:

```bash
# Quick checks
sqlplus hr/pass@db

-- Check 1: Slow queries exist
SELECT COUNT(*) FROM v$sqlarea WHERE parsing_schema_name = 'HR';
-- Should show: 10-50+

-- Check 2: Wait events exist
SELECT COUNT(*) FROM v$session 
WHERE username = 'HR' AND status = 'ACTIVE' AND state = 'WAITING';
-- Should show: 2-10+

-- Check 3: Blocking exists
SELECT COUNT(*) FROM v$session 
WHERE username = 'HR' AND BLOCKING_SESSION IS NOT NULL;
-- Should show: 1-5

-- Check 4: Child cursors exist
SELECT sql_id, COUNT(*) FROM v$sql 
WHERE parsing_schema_name = 'HR' 
GROUP BY sql_id 
HAVING COUNT(*) > 1;
-- Should show: multiple rows
```

Or use the complete verification script:
```bash
@verify_workload.sql
```

---

## 🔧 Troubleshooting

### Build Issues

**Problem:** `godror` not found
```bash
export ORACLE_HOME=/usr/lib/oracle/21/client64
export LD_LIBRARY_PATH=$ORACLE_HOME/lib:$LD_LIBRARY_PATH
go clean -modcache
./run-simulator.sh build
```

**Problem:** Go version too old
```bash
go version  # Need 1.21+
# Install latest Go from https://go.dev/dl/
```

### Connection Issues

**Problem:** Connection refused
```bash
# Test with sqlplus first
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

# Test network
tnsping 10.0.1.36:1521
telnet 10.0.1.36 1521
```

**Problem:** HR schema locked
```bash
sqlplus system/password@db
SQL> ALTER USER hr ACCOUNT UNLOCK;
```

### Runtime Issues

**Problem:** No data in v$sqlarea
```bash
# Check if simulator is actually running
ps aux | grep hr-workload

# Check for errors
./run-simulator.sh run 2>&1 | tee simulator.log
```

**Problem:** Too many connections
```bash
# Use light mode
./run-simulator.sh light
```

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **QUICK_START.md** | Quick reference (read this first) |
| **HR_WORKLOAD_SIMULATOR_README.md** | Complete documentation |
| **COMPLETE_PACKAGE_SUMMARY.md** | Feature overview and details |
| **FLOW_DIAGRAM.md** | Visual flow diagrams |
| **verify_workload.sql** | SQL verification script |

---

## 🎯 Success Criteria

Your receiver should capture:

1. ✅ **Slow queries** - avg_elapsed_time_ms > 1000ms
2. ✅ **Wait events** - current_wait_time_ms > 0
3. ✅ **Blocking** - blocked_time_ms > 5000ms with blocker info
4. ✅ **Child cursors** - Multiple child_numbers per sql_id
5. ✅ **Execution plans** - Plan details from v$sql_plan

---

## 🚦 Step-by-Step First Run

```bash
# Step 1: Navigate
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Step 2: Verify files exist
ls -l hr-workload-simulator.go run-simulator.sh verify_workload.sql

# Step 3: Build
./run-simulator.sh build

# Step 4: Test connection
./run-simulator.sh test

# Step 5: Quick test (5 minutes)
./run-simulator.sh run

# Step 6: In another terminal, verify
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
SQL> @verify_workload.sql

# Step 7: Stop (Ctrl+C)
^C

# Step 8: Check final stats
(automatically printed on shutdown)
```

---

## 📞 Quick Help

```bash
# Show all options
./run-simulator.sh help

# See what's running
ps aux | grep hr-workload

# Kill if needed
pkill hr-workload

# View logs
./run-simulator.sh run 2>&1 | tee simulator.log
```

---

## 🎉 You're Ready!

Everything is set up and ready to test your receiver. The simulator will generate:

- ✅ Slow queries your receiver can detect
- ✅ Wait events with proper filtering
- ✅ Blocking scenarios with chain tracking
- ✅ Child cursors with multiple plans
- ✅ All wait classes and event types

**Start with:**
```bash
./run-simulator.sh run
```

**Then start your receiver and watch the metrics flow!**

---

## 📊 Expected Receiver Metrics

When both are running, you should see metrics like:

```yaml
# Slow queries
newrelicoracledb.query.avg_elapsed_time_ms: 3450
  query_id: "a1b2c3d4e5f6"
  schema_name: "HR"

# Wait events  
newrelicoracledb.wait_events.current_wait_time_ms: 2100
  sid: "123"
  sql_id: "a1b2c3d4e5f6"
  sql_child_number: "0"
  wait_class: "User I/O"

# Blocking
newrelicoracledb.blocking_queries.blocked_time_ms: 8500
  blocked_sid: "124"
  blocker_sid: "123"
  final_blocker_sid: "123"

# Child cursors
newrelicoracledb.child_cursor.avg_elapsed_time_ms: 45
  sql_id: "m9n8b7v6c5"
  child_number: "0"
  plan_hash_value: "1234567890"
```

---

## 🎊 Have Fun Testing!

Your workload simulator is ready. It generates real-world Oracle workload patterns that perfectly match your receiver's monitoring capabilities.

**Questions?** Check the documentation files or run `./run-simulator.sh help`

**Ready?** `./run-simulator.sh run` 🚀
