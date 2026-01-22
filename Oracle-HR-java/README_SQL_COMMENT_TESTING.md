# 🎯 Summary: Testing New Relic SQL Comment Prepending with Oracle

## What This Is

You're helping test a **New Relic Java agent PoC feature** that instruments `java.sql.Connection::prepareStatement` to prepend SQL comments with trace context.

**The feature prepends comments like this:**
```sql
/* nr_trace_id=1234,nr_span_id=6789,nr_service=myapp */ SELECT * FROM employees
```

This has been tested with H2, MySQL, and PostgreSQL, but **needs testing with Oracle**.

## What You Have Ready

✅ **Oracle Java Application** - Spring Boot app in `/oracle-java/` directory
  - Uses JdbcTemplate (which uses PreparedStatement internally)
  - Has real HR queries (SELECT, INSERT, UPDATE, JOIN, aggregates)
  - Dockerized and ready to deploy

✅ **Oracle Database** - Running on VM at 10.0.1.36
  - Oracle 23ai FREE
  - HR schema with sample data
  - Access to v$sql for verification

✅ **Testing Infrastructure**
  - Automated test scripts
  - SQL verification queries
  - Load testing with k6
  - Complete documentation

## What You Need

1. **New Relic Snapshot JAR** - Get the PoC agent from the New Relic team
2. **Oracle VM Access** - SSH to deploy the application
3. **~30 minutes** - To deploy, test, and verify

## How to Test (Simple Version)

### 1. Get the Snapshot JAR
Ask New Relic for the snapshot agent JAR with SQL comment instrumentation.

### 2. Setup (5 minutes)
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java

# Copy snapshot JAR
cp /path/to/newrelic-snapshot.jar ./newrelic-agent-custom.jar

# Modify Dockerfile (see CUSTOM_NEWRELIC_JAR_SETUP.md)
# Just replace 6 lines in the Dockerfile

# Configure .env
# Set USE_NEW_RELIC=true and your license key
```

### 3. Deploy (10 minutes)
```bash
# Transfer to VM
rsync -avz oracle-java/ user@vm:~/oracle-java/

# SSH and deploy
ssh user@vm
cd ~/oracle-java
./deploy.sh up
```

### 4. Test (10 minutes)
```bash
# Run automated test
./test-sql-comments.sh

# Check Oracle for SQL comments
./check_sql_comments.sh
```

### 5. Verify (5 minutes)
Look in Oracle v$sql for SQL statements with comments:
```sql
/* nr_trace_id=...,nr_span_id=...,nr_service=... */ SELECT ...
```

## What to Expect

### ✅ Success Looks Like:
- Application starts with New Relic agent
- API calls work normally
- **Oracle v$sql shows SQL with prepended comments**
- Comments contain: trace_id, span_id, service name
- No errors or performance issues

### ❌ Needs Investigation:
- Agent loads but no comments in SQL
- SQL syntax errors due to comments
- Performance degradation
- Comments in wrong format

## Files Created for You

| File | Purpose |
|------|---------|
| **TESTING_QUICKSTART.md** | Start here - 5-minute guide |
| **TESTING_CHECKLIST.md** | Complete testing checklist |
| **NEWRELIC_SQL_COMMENT_TEST_GUIDE.md** | Detailed testing procedures |
| **CUSTOM_NEWRELIC_JAR_SETUP.md** | How to use snapshot JAR |
| **test-sql-comments.sh** | Automated test script |
| **check_sql_comments.sql** | Oracle verification SQL |
| **check_sql_comments.sh** | Automated Oracle check |

## Quick Reference

### Your Oracle Connection
```
Host: 10.0.1.36
Port: 1521
Service: pdb1.privatesubnet.oracledb.oraclevcn.com
User: hr
Password: (in your .env file)
```

### Your Application
```
Tech Stack: Spring Boot 3.2 + Java 17 + Oracle JDBC
Uses: JdbcTemplate → PreparedStatement
Port: 3000
Docker: oracle-test-app
```

### Key SQL to Run in Oracle
```sql
-- Check for SQL comments
SELECT sql_fulltext 
FROM v$sql 
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND last_active_time > SYSDATE - INTERVAL '30' MINUTE;
```

## Architecture Overview

```
┌──────────────────┐
│  Your Mac        │
│  oracle-java/    │ 
│  + snapshot JAR  │
└────────┬─────────┘
         │ rsync
         ▼
┌──────────────────┐      ┌──────────────────┐
│  Oracle VM       │      │  Oracle 23ai     │
│  Docker          │─────▶│  Port 1521       │
│  Port 3000       │ JDBC │  HR Schema       │
│  + NR Agent      │      │  v$sql (verify)  │
└────────┬─────────┘      └──────────────────┘
         │
         ▼
┌──────────────────┐
│  New Relic       │
│  (Staging)       │
└──────────────────┘
```

## Typical Test Flow

1. **Deploy** → Application starts with NR agent
2. **Traffic** → Hit API endpoints (employees, departments, etc.)
3. **Capture** → NR agent intercepts PreparedStatement calls
4. **Prepend** → Agent adds comment to SQL
5. **Execute** → Oracle executes SQL with comment
6. **Verify** → Check v$sql for SQL with comments

## What Gets Tested

| SQL Type | Example | Coverage |
|----------|---------|----------|
| Simple SELECT | `SELECT * FROM employees` | ✅ |
| SELECT with WHERE | `WHERE employee_id = ?` | ✅ |
| SELECT with JOIN | `FROM employees e JOIN departments d` | ✅ |
| Complex SELECT | `GROUP BY, aggregates` | ✅ |
| INSERT | `INSERT INTO employees` | ✅ |
| UPDATE | `UPDATE employees SET` | ✅ |
| CallableStatement | Stored procedures | ⚠️ Optional |

## Support

### Troubleshooting
1. Check `TESTING_CHECKLIST.md` for common issues
2. Review logs: `docker logs oracle-test-app`
3. Verify agent loaded: Look for "New Relic Agent" in logs
4. Test Oracle connectivity: `./check_sql_comments.sh`

### Getting Help
- All documentation in `oracle-java/` directory
- Start with `TESTING_QUICKSTART.md`
- Use `TESTING_CHECKLIST.md` to track progress
- Reference `NEWRELIC_SQL_COMMENT_TEST_GUIDE.md` for details

## Next Steps

1. **Read**: `TESTING_QUICKSTART.md` (5-minute guide)
2. **Get**: New Relic snapshot JAR from the team
3. **Setup**: Follow `CUSTOM_NEWRELIC_JAR_SETUP.md`
4. **Test**: Use `TESTING_CHECKLIST.md`
5. **Report**: Share results with New Relic team

## Expected Timeline

- ⏱️ **Setup**: 5-10 minutes
- ⏱️ **Deploy**: 5-10 minutes  
- ⏱️ **Test**: 10-15 minutes
- ⏱️ **Verify**: 5-10 minutes
- ⏱️ **Report**: 10 minutes

**Total**: ~30-45 minutes

## Success Metrics

- ✅ Agent loads successfully
- ✅ Application functions normally
- ✅ **SQL comments appear in Oracle v$sql**
- ✅ Comments have correct format
- ✅ All SQL types instrumented
- ✅ No errors or performance issues

---

## 🚀 Ready to Start?

**Read first**: `TESTING_QUICKSTART.md`

**Get snapshot JAR**: Contact New Relic team

**Questions?**: Check the detailed guides in the documentation

Good luck! 🎉
