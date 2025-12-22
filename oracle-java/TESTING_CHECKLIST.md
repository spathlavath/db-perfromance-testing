# New Relic SQL Comment Testing - Complete Checklist

## 📋 Pre-Testing Checklist

### Environment Setup
- [ ] Oracle Database is running and accessible
  - Host: 10.0.1.36
  - Port: 1521
  - Service: pdb1.privatesubnet.oracledb.oraclevcn.com
  - User: hr / password configured

- [ ] Oracle VM is accessible via SSH
  - IP address: ___________________
  - Username: ___________________
  - SSH key configured

- [ ] Docker is installed on Oracle VM
  ```bash
  ssh user@vm "docker --version"
  ```

### Files Prepared
- [ ] New Relic snapshot JAR obtained from New Relic team
- [ ] Snapshot JAR copied to oracle-java directory as `newrelic-agent-custom.jar`
- [ ] Dockerfile modified to use custom JAR (see CUSTOM_NEWRELIC_JAR_SETUP.md)
- [ ] `.env` file configured with:
  - [ ] `USE_NEW_RELIC=true`
  - [ ] `USE_OTEL=false` (or true for comparison)
  - [ ] `NEW_RELIC_LICENSE_KEY` set
  - [ ] `NEW_RELIC_APP_NAME` set
  - [ ] `NEW_RELIC_LOG_LEVEL=finest`
- [ ] All test scripts are executable (`*.sh` files)

## 🚀 Deployment Checklist

### Step 1: Transfer to VM
```bash
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ user@vm-ip:~/oracle-java/
```

- [ ] All files transferred successfully
- [ ] newrelic-agent-custom.jar transferred (check size ~10-15MB)
- [ ] .env file with correct credentials transferred

### Step 2: Deploy Application
```bash
ssh user@vm-ip
cd ~/oracle-java
./deploy.sh up
```

- [ ] Docker image builds successfully
- [ ] Container starts without errors
- [ ] Health check passes

### Step 3: Verify Deployment
```bash
./deploy.sh status
curl http://localhost:3000/health
```

- [ ] Application is running
- [ ] Health endpoint responds
- [ ] No errors in logs

## 🧪 Testing Checklist

### Phase 1: Application Verification
- [ ] Run test script: `./test-sql-comments.sh`
- [ ] Application responds to API calls
- [ ] New Relic agent loaded (check logs)
- [ ] No startup errors

### Phase 2: Traffic Generation
Test these endpoints manually or with script:

- [ ] `GET /employees` - List employees
- [ ] `GET /employees/100` - Get employee by ID
- [ ] `GET /departments` - List departments
- [ ] `GET /departments/10/employees` - Department employees
- [ ] `GET /reports/salary-by-department` - Complex report
- [ ] `GET /employees/101/history` - Job history

Record any errors: _______________________________

### Phase 3: Oracle SQL Verification
Run SQL checks:

```bash
./check_sql_comments.sh
```
OR manually:
```bash
sqlplus hr@//10.0.1.36:1521/pdb1
@check_sql_comments.sql
```

- [ ] SQL queries executed successfully
- [ ] Results show SQL statements from application
- [ ] Check for SQL comments with nr_trace_id
- [ ] Check for SQL comments with nr_span_id
- [ ] Check for SQL comments with nr_service

### Phase 4: Results Analysis

#### SQL Comment Presence
- [ ] Comments found in PreparedStatement queries
- [ ] Comments found in all SELECT queries
- [ ] Comments found in INSERT/UPDATE queries
- [ ] Comment format is correct: `/* nr_trace_id=...,nr_span_id=...,nr_service=... */`

#### Sample SQL Found (record 2-3 examples):

Example 1:
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```

Example 2:
```
_____________________________________________________________
_____________________________________________________________
_____________________________________________________________
```

### Phase 5: CallableStatement Testing (Optional)

If testing stored procedures:

- [ ] Created test stored procedure in Oracle
- [ ] Added Java endpoint to call stored procedure
- [ ] Rebuilt and redeployed application
- [ ] Called stored procedure endpoint
- [ ] Verified comments in CallableStatement SQL

Result: ☐ Success  ☐ Failed  ☐ Not Tested

## 📊 Data Collection Checklist

### Logs Collection
```bash
# Application logs
docker logs oracle-test-app > newrelic-app-logs.txt 2>&1

# New Relic agent specific logs
docker logs oracle-test-app 2>&1 | grep -i "newrelic" > newrelic-agent-logs.txt

# SQL execution logs (if available)
docker logs oracle-test-app 2>&1 | grep -i "sql\|jdbc" > sql-logs.txt
```

- [ ] Application logs collected
- [ ] Agent logs extracted
- [ ] SQL logs extracted

### Oracle Data Collection
```sql
-- Save SQL statements with comments
spool nr_sql_comments.txt
SELECT sql_id, sql_fulltext 
FROM v$sql 
WHERE sql_fulltext LIKE '%nr_%'
  AND last_active_time > SYSDATE - INTERVAL '1' HOUR;
spool off
```

- [ ] SQL statements with comments exported
- [ ] Query statistics collected
- [ ] Module/action information recorded

### Environment Information
- [ ] Oracle version: `SELECT * FROM v$version;`
- [ ] Java version: `docker exec oracle-test-app java -version`
- [ ] New Relic agent version: `docker exec oracle-test-app java -jar /app/newrelic/newrelic.jar version`
- [ ] JDBC driver version: Check pom.xml (ojdbc8:21.9.0.0)

## ✅ Success Criteria

### Must Have (Critical)
- [ ] New Relic agent loads without errors
- [ ] Application functions correctly
- [ ] SQL statements execute successfully
- [ ] Comments appear in Oracle v$sql
- [ ] Comments contain trace_id
- [ ] Comments contain span_id
- [ ] Comments contain service name

### Should Have (Important)
- [ ] All SQL types have comments (SELECT, INSERT, UPDATE)
- [ ] Comment format is consistent
- [ ] No performance degradation observed
- [ ] Transaction traces appear in New Relic UI

### Nice to Have (Optional)
- [ ] CallableStatement tested
- [ ] Compared with OpenTelemetry instrumentation
- [ ] Load test completed
- [ ] Performance metrics collected

## 🐛 Issues Encountered

| Issue | Description | Resolution | Status |
|-------|-------------|------------|--------|
| 1.    |             |            | ☐ Open ☐ Resolved |
| 2.    |             |            | ☐ Open ☐ Resolved |
| 3.    |             |            | ☐ Open ☐ Resolved |

## 📝 Notes and Observations

General observations:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

Performance impact:
```
_________________________________________________________________
_________________________________________________________________
```

Unexpected behavior:
```
_________________________________________________________________
_________________________________________________________________
```

## 📦 Deliverables for New Relic Team

Prepare these files/information:

- [ ] newrelic-app-logs.txt - Full application logs
- [ ] newrelic-agent-logs.txt - Agent-specific logs
- [ ] nr_sql_comments.txt - SQL statements with comments from Oracle
- [ ] Environment details (Oracle version, Java version, JDBC driver)
- [ ] Sample SQL statements (3-5 examples)
- [ ] Screenshots from New Relic UI (if applicable)
- [ ] This completed checklist
- [ ] Any error messages or stack traces

## 🎯 Final Status

Overall test result: ☐ Success  ☐ Partial Success  ☐ Failed

Date completed: _______________
Tested by: _______________
Duration: _______________

### Summary
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

### Recommendations
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## 📚 Reference Documents
- TESTING_QUICKSTART.md - Quick start guide
- NEWRELIC_SQL_COMMENT_TEST_GUIDE.md - Detailed testing guide
- CUSTOM_NEWRELIC_JAR_SETUP.md - How to use snapshot JAR
- AGENT_CONFIGURATION.md - Agent configuration
- README.md - Application overview

## 🔗 Quick Commands Reference

```bash
# Deploy
./deploy.sh up

# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Run tests
./test-sql-comments.sh

# Check Oracle
./check_sql_comments.sh

# Restart
./deploy.sh restart

# Stop
./deploy.sh down

# Rebuild
./deploy.sh rebuild
```
