# 🚀 Quick Start Guide - HR Workload Simulator

## One-Command Setup

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
chmod +x run-simulator.sh
./run-simulator.sh build
```

## One-Command Run

```bash
./run-simulator.sh run
```

## That's It! 🎉

The simulator will:
1. ✅ Connect to your HR schema
2. ✅ Generate slow queries (high avg_elapsed_time_ms)
3. ✅ Create wait events (ACTIVE/WAITING sessions)
4. ✅ Produce blocking scenarios (lock contention)
5. ✅ Generate child cursors (multiple execution plans)
6. ✅ Simulate various wait classes

---

## Quick Commands

| Command | What It Does |
|---------|--------------|
| `./run-simulator.sh build` | Build the simulator |
| `./run-simulator.sh run` | Run for 5 minutes (default) |
| `./run-simulator.sh light` | Light load (5 min, 1 worker each) |
| `./run-simulator.sh medium` | Medium load (15 min, 2-3 workers) |
| `./run-simulator.sh heavy` | Heavy load (30 min, 4-5 workers) |

---

## Verify It's Working

While simulator runs, open another terminal:

```bash
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com @verify_workload.sql
```

You should see:
- 📊 Slow queries in v$sqlarea
- ⏳ Active sessions waiting
- 🔒 Blocking sessions
- 🔄 Multiple child cursors
- 📈 Various wait events

---

## Credentials (Already Set)

```
ORACLE_USER=hr
ORACLE_PASSWORD=NewRelic_PW_7663_
ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
```

---

## Expected Output

```
=== HR Workload Simulator ===
Database: hr@10.0.1.36:1521/pdb1...
Duration: 5m0s
Workers: Slow=2, Blocking=3, I/O=2, ChildCursor=2, Concurrency=2
==============================

✓ Database connection successful
✓ HR schema verified

🚀 Starting workload generators...

[SlowQuery-0] Query executed in 3.45s (1000 rows)
[Blocking-1] 🔒 Session 1 locked employee 105
[Blocking-1] ⏳ Session 2 attempting to lock employee 105 (will block)...
[IO-0] I/O query executed in 2.1s (107 rows)
[ChildCursor-0] Executed with binds dept=10, salary=5000 (4 rows)

=== Workload Statistics ===
Slow Queries Run:         45
Blocking Events Created:  12
I/O Intensive Queries:    38
Child Cursors Generated:  50
Wait Events Generated:    15
===========================
```

---

## Test Your Receiver

**Terminal 1:** Start simulator
```bash
./run-simulator.sh medium
```

**Terminal 2:** Run your receiver
```bash
cd /Users/spathlavath/otel/opentelemetry-collector-contrib
./bin/otelcol_linux_amd64 --config=config.yaml
```

**Terminal 3:** Verify data
```bash
sqlplus hr/pass@db @verify_workload.sql
```

---

## Troubleshooting

**Connection failed?**
```bash
# Test manually
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

# Should see: Connected to Oracle Database...
```

**Build failed?**
```bash
# Check Go version
go version  # Need 1.21+

# Reinstall dependencies
go clean -modcache
go get github.com/godror/godror@latest
./run-simulator.sh build
```

---

## Stop Simulator

Press `Ctrl+C` - it will gracefully shutdown and show final statistics.

---

## Files Created

```
db-perfromance-testing/oracle/
├── hr-workload-simulator.go         ← Main simulator code
├── run-simulator.sh                 ← Easy run script
├── verify_workload.sql              ← Verification queries
├── HR_WORKLOAD_SIMULATOR_README.md  ← Full documentation
└── QUICK_START.md                   ← This file
```

---

## What Your Receiver Will Capture

### 1. From v$sqlarea (Slow Queries)
```sql
SQL_ID: a1b2c3d4e5f6
AVG_ELAPSED_TIME_MS: 3450
QUERY_TEXT: SELECT e1.*, e2.* FROM employees e1, employees e2...
```

### 2. From v$session (Wait Events)
```sql
SID: 123, SQL_ID: a1b2c3d4e5f6
STATUS: ACTIVE, STATE: WAITING
WAIT_CLASS: User I/O
WAIT_TIME_MICRO: 2100000  (2100ms)
```

### 3. Blocking Information
```sql
BLOCKED_SID: 124, BLOCKER_SID: 123
BLOCKED_TIME_MS: 5000
FINAL_BLOCKING_SESSION: 123
```

### 4. Child Cursors
```sql
SQL_ID: x7y8z9, CHILD_NUMBER: 0, PLAN_HASH: 1234567890
SQL_ID: x7y8z9, CHILD_NUMBER: 1, PLAN_HASH: 9876543210
SQL_ID: x7y8z9, CHILD_NUMBER: 2, PLAN_HASH: 5555555555
```

---

## Next Steps

1. ✅ Run simulator: `./run-simulator.sh run`
2. ✅ Start your receiver
3. ✅ Verify with SQL: `@verify_workload.sql`
4. ✅ Check receiver metrics/logs
5. ✅ Adjust load as needed

---

**Need help?** See `HR_WORKLOAD_SIMULATOR_README.md` for detailed documentation.

**Ready to test?** 
```bash
./run-simulator.sh run
```
