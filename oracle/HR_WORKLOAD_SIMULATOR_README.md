# HR Workload Simulator - Setup & Usage Guide

## 📋 Overview

The HR Workload Simulator is a comprehensive Go application designed to generate realistic database workload patterns that trigger all monitoring scenarios in your `newrelicoraclereceiver`. It creates the exact conditions your receiver is designed to detect and monitor.

## 🎯 What It Does

### 1. **Slow Queries** (Appears in v$sqlarea with high avg_elapsed_time_ms)
- Cartesian joins between employee tables
- Complex multi-table joins with aggregations
- Recursive self-joins with manager hierarchies
- Analytical window functions with ranking

### 2. **Wait Events** (Captured by v$session with status='ACTIVE' and state='WAITING')
- I/O waits from full table scans
- Lock contention waits
- Latch contention from concurrent queries
- Enqueue waits from blocking scenarios

### 3. **Blocking Sessions** (Creates blocker-blocked relationships)
- Session A locks row with SELECT FOR UPDATE
- Session B waits on same row (creates blocking chain)
- Tracks BLOCKING_SESSION and FINAL_BLOCKING_SESSION
- Generates blocked_time_ms metrics

### 4. **Child Cursors** (Multiple execution plans for same SQL_ID)
- Same query with different bind variables
- Creates multiple child_number entries
- Different execution plans based on bind values
- Tests SQL_ID + child_number tracking

### 5. **Various Wait Classes**
- User I/O (disk reads/writes)
- Concurrency (latch/enqueue waits)
- Application (lock waits)
- Configuration (resource limits)

## 🔄 Receiver Flow Alignment

```
┌─────────────────────────────────────────────────────────────┐
│ Your Receiver Flow                                          │
├─────────────────────────────────────────────────────────────┤
│ 1. Query v$sqlarea for high avg_elapsed_time_ms           │
│    → Returns: [sql_id_1, sql_id_2, ...]                   │
│                                                             │
│ 2. Query v$session for ACTIVE sessions                     │
│    WHERE status='ACTIVE' AND state='WAITING'               │
│    AND wait_time_micro>0                                   │
│    AND sql_id IN (sql_id_1, sql_id_2, ...)                │
│    → Returns: [(sql_id, child_number), ...]               │
│                                                             │
│ 3. Query v$sql for specific child cursors                  │
│    WHERE sql_id=X AND child_number=Y                       │
│                                                             │
│ 4. Query v$sql_plan for execution plans                    │
│    WHERE sql_id=X AND child_number=Y                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ What Simulator Generates                                    │
├─────────────────────────────────────────────────────────────┤
│ ✓ Slow queries → Populates v$sqlarea                       │
│ ✓ Wait events → Creates ACTIVE/WAITING sessions            │
│ ✓ Blocking → Creates BLOCKING_SESSION relationships        │
│ ✓ Child cursors → Same SQL_ID, different child_numbers     │
│ ✓ Execution plans → Stored in v$sql_plan                   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Setup Instructions

### Prerequisites

1. **Go 1.21 or later**
   ```bash
   go version
   # Should show: go version go1.21.x or later
   ```

2. **Oracle Instant Client** (for godror driver)
   - Already installed on your VM (check with `echo $ORACLE_HOME`)

3. **HR Schema** (from oracle-samples/db-sample-schemas)
   - Already set up based on your credentials

### Step 1: Navigate to Oracle Directory

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
```

### Step 2: Initialize Go Module (if not already done)

```bash
# Initialize module
go mod init github.com/spathlavath/db-perfromance-testing/oracle

# Add godror dependency
go get github.com/godror/godror@latest
```

### Step 3: Set Environment Variables

Create or update `.env` file:

```bash
cat > .env << 'EOF'
ORACLE_USER=hr
ORACLE_PASSWORD=NewRelic_PW_7663_
ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
EOF
```

Load environment variables:

```bash
export $(cat .env | xargs)
```

### Step 4: Build the Simulator

```bash
go build -o hr-workload-simulator hr-workload-simulator.go
```

## 🎮 Running the Simulator

### Basic Usage

```bash
./hr-workload-simulator \
  -user hr \
  -password "NewRelic_PW_7663_" \
  -connect "10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com" \
  -duration 5m
```

### Using Environment Variables

```bash
# Set once
export ORACLE_USER=hr
export ORACLE_PASSWORD="NewRelic_PW_7663_"
export ORACLE_CONNECT_STRING="10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com"

# Then run with just duration
./hr-workload-simulator -duration 10m
```

### Advanced Configuration

```bash
./hr-workload-simulator \
  -duration 15m \
  -slow-workers 3 \
  -block-workers 4 \
  -io-workers 3 \
  -child-workers 2 \
  -concurrency-workers 3
```

### Configuration Options

| Flag | Description | Default |
|------|-------------|---------|
| `-user` | Oracle username | `hr` |
| `-password` | Oracle password | (required) |
| `-connect` | Connection string (host:port/service) | (required) |
| `-duration` | How long to run (e.g., 5m, 1h) | `5m` |
| `-slow-workers` | Number of slow query workers | `2` |
| `-block-workers` | Number of blocking scenario workers | `3` |
| `-io-workers` | Number of I/O intensive workers | `2` |
| `-child-workers` | Number of child cursor workers | `2` |
| `-concurrency-workers` | Number of concurrency wait workers | `2` |

## 📊 Understanding the Output

### Real-time Logs

```
[SlowQuery-0] Query executed in 3.45s (1000 rows)
[Blocking-1] 🔒 Session 1 locked employee 105 (salary=8000.00)
[Blocking-1] ⏳ Session 2 attempting to lock employee 105 (will block)...
[IO-0] I/O query executed in 2.1s (107 rows)
[ChildCursor-0] Executed with binds dept=10, salary=5000 (4 rows)
[Concurrency-1] Executed burst of 10 concurrent queries
```

### Statistics Report (every 10 seconds)

```
=== Workload Statistics ===
Slow Queries Run:         45
Blocking Events Created:  12
I/O Intensive Queries:    38
Child Cursors Generated:  50
Wait Events Generated:    15
Errors:                   0
===========================
```

## 🧪 Testing Your Receiver

### Step 1: Start the Simulator

```bash
# Terminal 1: Start workload generator
./hr-workload-simulator -duration 30m
```

### Step 2: Monitor with Your Receiver

```bash
# Terminal 2: Run your receiver (adjust path as needed)
cd /Users/spathlavath/otel/opentelemetry-collector-contrib
./bin/otelcol_linux_amd64 --config=your-config.yaml
```

### Step 3: Verify Data Collection

Check that your receiver is capturing:

1. **Slow Queries from v$sqlarea**
   ```sql
   SELECT sql_id, executions, 
          elapsed_time/DECODE(executions,0,1,executions)/1000 as avg_elapsed_ms,
          SUBSTR(sql_text, 1, 80) as query_text
   FROM v$sqlarea
   WHERE parsing_schema_name = 'HR'
   AND last_active_time >= SYSDATE - INTERVAL '5' MINUTE
   ORDER BY avg_elapsed_ms DESC
   FETCH FIRST 10 ROWS ONLY;
   ```

2. **Active Sessions with Waits**
   ```sql
   SELECT s.sid, s.sql_id, s.SQL_CHILD_NUMBER,
          s.status, s.state, s.wait_class, s.event,
          ROUND(s.WAIT_TIME_MICRO/1000, 2) as wait_ms,
          s.BLOCKING_SESSION
   FROM v$session s
   WHERE s.status = 'ACTIVE'
   AND s.state = 'WAITING'
   AND s.WAIT_TIME_MICRO > 0
   AND s.username = 'HR';
   ```

3. **Blocking Chains**
   ```sql
   SELECT s.sid as blocked_sid,
          s.sql_id as blocked_query,
          s.BLOCKING_SESSION as blocker_sid,
          s.FINAL_BLOCKING_SESSION as final_blocker,
          ROUND(s.WAIT_TIME_MICRO/1000, 2) as blocked_ms,
          blocker.sql_id as blocker_query
   FROM v$session s
   LEFT JOIN v$session blocker ON s.BLOCKING_SESSION = blocker.sid
   WHERE s.BLOCKING_SESSION IS NOT NULL
   AND s.username = 'HR';
   ```

4. **Child Cursors**
   ```sql
   SELECT sql_id, child_number, plan_hash_value, executions,
          elapsed_time/DECODE(executions,0,1,executions)/1000 as avg_elapsed_ms
   FROM v$sql
   WHERE sql_text LIKE '%department_id = :1%'
   AND parsing_schema_name = 'HR'
   ORDER BY sql_id, child_number;
   ```

## 🔍 Troubleshooting

### Issue: "Failed to create database connection"

**Solution:**
```bash
# Test connection manually
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

# Check Oracle listener
tnsping 10.0.1.36:1521

# Verify HR schema access
SELECT COUNT(*) FROM employees;
```

### Issue: "Table not accessible"

**Solution:**
```bash
# Check HR schema is unlocked
sqlplus system/password@your_db

SQL> ALTER USER hr ACCOUNT UNLOCK;
SQL> GRANT CREATE SESSION TO hr;
SQL> GRANT SELECT ON hr.employees TO hr;
```

### Issue: "Too many open connections"

**Solution:**
```bash
# Reduce workers
./hr-workload-simulator \
  -duration 5m \
  -slow-workers 1 \
  -block-workers 2 \
  -io-workers 1 \
  -child-workers 1 \
  -concurrency-workers 1
```

### Issue: "godror: not found"

**Solution:**
```bash
# Set Oracle environment
export ORACLE_HOME=/path/to/oracle/instantclient
export LD_LIBRARY_PATH=$ORACLE_HOME:$LD_LIBRARY_PATH
export PATH=$ORACLE_HOME:$PATH

# Rebuild
go clean -cache
go build -o hr-workload-simulator hr-workload-simulator.go
```

## 📈 Performance Tuning

### Light Load (Testing)
```bash
./hr-workload-simulator \
  -duration 5m \
  -slow-workers 1 \
  -block-workers 1 \
  -io-workers 1 \
  -child-workers 1 \
  -concurrency-workers 1
```

### Medium Load (Typical)
```bash
./hr-workload-simulator \
  -duration 15m \
  -slow-workers 2 \
  -block-workers 3 \
  -io-workers 2 \
  -child-workers 2 \
  -concurrency-workers 2
```

### Heavy Load (Stress Test)
```bash
./hr-workload-simulator \
  -duration 30m \
  -slow-workers 4 \
  -block-workers 5 \
  -io-workers 4 \
  -child-workers 3 \
  -concurrency-workers 4
```

## 🎯 Expected Receiver Behavior

When running both simulator and receiver, you should see:

1. **Slow Query Metrics**
   - `newrelicoracledb.query.avg_elapsed_time_ms` > 1000ms
   - Multiple SQL_IDs from HR schema
   - Query text showing complex joins

2. **Wait Event Metrics**
   - `newrelicoracledb.wait_events.current_wait_time_ms` > 0
   - Wait classes: User I/O, Concurrency, Application
   - Events: db file sequential read, enq: TX - row lock contention

3. **Blocking Metrics**
   - `newrelicoracledb.blocking_queries.blocked_time_ms` > 0
   - BLOCKING_SESSION populated
   - FINAL_BLOCKING_SESSION showing chain

4. **Child Cursor Metrics**
   - Same SQL_ID with multiple child_numbers (0, 1, 2, ...)
   - Different plan_hash_values
   - Different avg_elapsed_time_ms per child

## 🛑 Stopping the Simulator

### Graceful Shutdown
```bash
# Press Ctrl+C in the terminal
^C
⚠️  Interrupt received, shutting down...
✅ Workload simulation completed

=== Workload Statistics ===
Slow Queries Run:         145
Blocking Events Created:  42
I/O Intensive Queries:    128
Child Cursors Generated:  250
Wait Events Generated:    55
Errors:                   0
===========================
```

### Forced Shutdown
```bash
# If Ctrl+C doesn't work, kill the process
ps aux | grep hr-workload
kill -9 <PID>
```

## 📝 Quick Start Checklist

- [ ] Go 1.21+ installed
- [ ] Oracle Instant Client configured
- [ ] HR schema accessible
- [ ] Environment variables set
- [ ] Simulator built successfully
- [ ] Test connection works
- [ ] Receiver configuration ready
- [ ] Monitoring queries prepared

## 🔗 Related Documentation

- [HR Schema GitHub](https://github.com/oracle-samples/db-sample-schemas/tree/main/human_resources)
- [godror Driver](https://github.com/godror/godror)
- [Oracle v$ Views Reference](https://docs.oracle.com/en/database/oracle/oracle-database/)

## 💡 Tips

1. **Start small**: Begin with 5-minute duration and low worker counts
2. **Monitor resources**: Watch CPU/memory on both app and database
3. **Check logs**: Look for errors in both simulator and receiver logs
4. **Verify data**: Use SQL queries above to confirm data is being generated
5. **Adjust timing**: Increase/decrease worker counts based on your needs

## 🆘 Support

If you encounter issues:

1. Check connection: `sqlplus hr/pass@connect_string`
2. Verify tables: `SELECT COUNT(*) FROM employees;`
3. Review logs: Look for error messages in output
4. Test receiver: Ensure receiver can query the same views
5. Check privileges: Ensure HR user has SELECT on v$ views

---

**Ready to test your receiver? Start the simulator and watch the metrics flow!** 🚀
