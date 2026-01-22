# Testing New Relic SQL Comment Prepending with Oracle

## Overview
This guide helps you test the New Relic Java agent's feature that instruments `java.sql.Connection::prepareStatement` to prepend comments with trace context to SQL queries.

**Expected Behavior:**
The agent should prepend comments like:
```sql
/* nr_trace_id=1234,nr_span_id=6789,nr_service=myapp */ SELECT * FROM employees
```

## Prerequisites

1. **Oracle Database VM** - Your Oracle database should be running and accessible
2. **Oracle Java Application** - This application (oracle-java) ready to deploy
3. **New Relic Snapshot JAR** - The PoC New Relic agent JAR file

## Setup Steps

### Step 1: Place New Relic Snapshot JAR

If you have a custom snapshot JAR to test, you need to modify the Dockerfile to use it instead of downloading from the official source.

#### Option A: Local JAR File

1. Copy your snapshot JAR to the oracle-java directory:
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
cp /path/to/your/newrelic-snapshot.jar ./newrelic-agent-snapshot.jar
```

2. Modify the `Dockerfile` (lines 27-32) to use your local JAR:

**Replace:**
```dockerfile
# Download New Relic Java agent
ADD https://download.newrelic.com/newrelic/java-agent/newrelic-agent/current/newrelic-java.zip /tmp/newrelic-java.zip
RUN apk add --no-cache unzip && \
    unzip /tmp/newrelic-java.zip -d /app && \
    rm /tmp/newrelic-java.zip && \
    chmod 644 /app/newrelic/newrelic.jar
```

**With:**
```dockerfile
# Use local New Relic Java agent snapshot
RUN mkdir -p /app/newrelic
COPY newrelic-agent-snapshot.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
```

#### Option B: URL to Snapshot Build

If your snapshot JAR is available via URL:
```dockerfile
# Download New Relic Java agent snapshot
RUN mkdir -p /app/newrelic
ADD https://your-url/newrelic-snapshot.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
```

### Step 2: Configure New Relic Agent

Edit `.env` file to enable New Relic agent:

```bash
# Agent Selection - ENABLE NEW RELIC, DISABLE OTEL
USE_OTEL=false
USE_NEW_RELIC=true

# New Relic Configuration
NEW_RELIC_LICENSE_KEY=your-license-key-here
NEW_RELIC_APP_NAME=Oracle-HR-Portal-SQL-Comment-Test
NEW_RELIC_HOST=staging-collector.newrelic.com  # or collector.newrelic.com for prod
NEW_RELIC_LOG_LEVEL=finest  # Use 'finest' for detailed debugging
```

### Step 3: Enable SQL Instrumentation Logging

Edit `src/main/resources/newrelic.yml` to enable detailed SQL logging:

```yaml
common: &default_settings
  license_key: '<%= license_key %>'
  app_name: Oracle HR Portal SQL Test
  
  # Enable audit mode to see all agent activity
  audit_mode: true
  
  # Log settings for SQL debugging
  log_level: finest
  
  # Transaction tracer settings
  transaction_tracer:
    enabled: true
    transaction_threshold: apdex_f
    record_sql: obfuscated
    stack_trace_threshold: 0.5
    explain_enabled: true
    explain_threshold: 0.5
  
  # Database tracer settings
  database_tracer:
    enabled: true
    record_sql: obfuscated
    
  # Enable all instrumentation
  instrumentation:
    jdbc:
      enabled: true
```

### Step 4: Deploy to Oracle VM

#### Transfer Files to VM
```bash
# From your Mac
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ <your-vm-user>@<your-vm-ip>:~/oracle-java/
```

#### SSH to VM and Deploy
```bash
ssh <your-vm-user>@<your-vm-ip>
cd ~/oracle-java

# Deploy the application
./deploy.sh up
```

## Testing SQL Comment Prepending

### Test 1: Monitor Application Logs

Watch the application logs for SQL statements:

```bash
./deploy.sh logs
```

Look for log entries showing:
- New Relic agent initialization
- SQL statements being executed
- Transaction traces

### Test 2: Query Oracle v$sql View

Connect to your Oracle database and check the SQL statements being executed:

```sql
-- Connect to Oracle as a user with appropriate privileges
sqlplus system/password@//10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

-- Check recent SQL statements for comments
SELECT 
    sql_id,
    sql_fulltext,
    executions,
    last_active_time
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
   OR sql_fulltext LIKE '%nr_span_id%'
   OR sql_fulltext LIKE '%HR_Portal%'
ORDER BY last_active_time DESC
FETCH FIRST 20 ROWS ONLY;

-- Check for SQL from our application (without comment filter)
SELECT 
    sql_id,
    SUBSTR(sql_fulltext, 1, 200) as sql_text,
    executions,
    last_active_time
FROM v$sql
WHERE sql_fulltext LIKE '%EMPLOYEES%'
  AND sql_fulltext LIKE '%DEPARTMENTS%'
ORDER BY last_active_time DESC
FETCH FIRST 20 ROWS ONLY;
```

### Test 3: Check v$sqlarea for Full SQL Text

```sql
-- More comprehensive view
SELECT 
    sql_id,
    sql_fulltext,
    executions,
    module,
    action
FROM v$sqlarea
WHERE last_active_time > SYSDATE - INTERVAL '1' HOUR
  AND (sql_fulltext LIKE '%nr_%' OR module LIKE '%HR-Portal%')
ORDER BY last_active_time DESC;
```

### Test 4: Generate Test Traffic

Use the provided k6 load test or manual API calls:

```bash
# Option 1: Use k6 (from VM)
./deploy.sh test

# Option 2: Manual API calls (from VM or your Mac)
# Get VM IP and test endpoints
VM_IP="your-vm-ip"
PORT=3000

# Test employee queries
curl http://$VM_IP:$PORT/employees
curl http://$VM_IP:$PORT/employees/100

# Test department queries
curl http://$VM_IP:$PORT/departments
curl http://$VM_IP:$PORT/departments/10/employees

# Test reports (complex queries)
curl http://$VM_IP:$PORT/reports/salary-by-department

# Test employee history
curl http://$VM_IP:$PORT/employees/101/history
```

### Test 5: Enable Oracle SQL Trace

For detailed analysis, enable SQL trace on the Oracle side:

```sql
-- As SYSTEM or DBA user
ALTER SESSION SET SQL_TRACE = TRUE;

-- Or for specific session
SELECT sid, serial# FROM v$session WHERE username = 'HR';
EXEC DBMS_MONITOR.SESSION_TRACE_ENABLE(session_id => <sid>, serial_num => <serial#>);

-- Generate some traffic, then check trace files
-- Trace files location: $ORACLE_BASE/diag/rdbms/$ORACLE_SID/$ORACLE_SID/trace/
```

## Expected Results

### ✅ Success Indicators

1. **In Application Logs:**
   - New Relic agent starts successfully
   - No errors about SQL instrumentation
   - Transaction traces being sent

2. **In Oracle v$sql:**
   - SQL statements show prepended comments
   - Comments contain: `nr_trace_id`, `nr_span_id`, `nr_service`
   - Example:
     ```sql
     /* nr_trace_id=abc123,nr_span_id=xyz789,nr_service=Oracle-HR-Portal-SQL-Comment-Test */ 
     SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME...
     ```

3. **In New Relic UI:**
   - Transactions appear with database calls
   - SQL statements are captured
   - Transaction traces show DB time

### ❌ Troubleshooting

If comments don't appear:

1. **Check Agent Loaded:**
   ```bash
   docker logs oracle-test-app 2>&1 | grep -i "newrelic agent"
   docker logs oracle-test-app 2>&1 | grep -i "javaagent"
   ```

2. **Verify SQL Instrumentation:**
   ```bash
   # Check if JDBC is being instrumented
   docker logs oracle-test-app 2>&1 | grep -i "jdbc"
   docker logs oracle-test-app 2>&1 | grep -i "prepareStatement"
   ```

3. **Check for Errors:**
   ```bash
   docker logs oracle-test-app 2>&1 | grep -i "error"
   docker logs oracle-test-app 2>&1 | grep -i "exception"
   ```

4. **Verify Database User Permissions:**
   - Ensure HR user can access v$sql:
     ```sql
     GRANT SELECT ON v_$sql TO hr;
     GRANT SELECT ON v_$sqlarea TO hr;
     ```

## Testing with Stored Procedures (CallableStatement)

To test with Oracle stored procedures:

### Create Test Procedure

```sql
-- As HR user
CREATE OR REPLACE PROCEDURE get_employee_details(
    p_employee_id IN NUMBER,
    p_cursor OUT SYS_REFCURSOR
) AS
BEGIN
    OPEN p_cursor FOR
        SELECT e.*, d.department_name, j.job_title
        FROM employees e
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN jobs j ON e.job_id = j.job_id
        WHERE e.employee_id = p_employee_id;
END;
/
```

### Add Java Code to Call Stored Procedure

Create a new test endpoint in your application:

```java
@GetMapping("/employees/{id}/stored-proc-test")
public Map<String, Object> getEmployeeViaStoredProc(@PathVariable Long id) {
    String sql = "{call get_employee_details(?, ?)}";
    // This will use CallableStatement
    return jdbcTemplate.queryForMap(sql, id);
}
```

Then check if the CallableStatement also gets the comment prepended.

## Verification Checklist

- [ ] New Relic agent loads successfully
- [ ] Application starts without errors
- [ ] API endpoints respond correctly
- [ ] SQL statements execute successfully
- [ ] Comments appear in v$sql view
- [ ] Comments contain trace_id and span_id
- [ ] Comments contain service name
- [ ] PreparedStatement queries have comments
- [ ] CallableStatement queries have comments (if tested)
- [ ] No performance degradation
- [ ] Transaction traces appear in New Relic UI

## Reporting Results

When reporting back to the New Relic team, provide:

1. **SQL Examples from v$sql:**
   ```sql
   SELECT sql_fulltext FROM v$sql WHERE sql_fulltext LIKE '%nr_trace_id%';
   ```

2. **Agent Logs:**
   ```bash
   docker logs oracle-test-app > newrelic-agent-logs.txt 2>&1
   ```

3. **Oracle Version:**
   ```sql
   SELECT * FROM v$version;
   ```

4. **JDBC Driver Version:**
   Check `pom.xml` - currently using `ojdbc8:21.9.0.0`

5. **Any Errors or Unexpected Behavior**

## Quick Test Script

Save this as `test-sql-comments.sh` on your VM:

```bash
#!/bin/bash
# Quick test script for SQL comment verification

VM_IP="localhost"
PORT=3000

echo "=== Testing SQL Comment Prepending ==="
echo ""

echo "Step 1: Generate traffic..."
curl -s http://$VM_IP:$PORT/employees > /dev/null
curl -s http://$VM_IP:$PORT/departments > /dev/null
curl -s http://$VM_IP:$PORT/reports/salary-by-department > /dev/null

echo "✓ Traffic generated"
echo ""

echo "Step 2: Check Oracle for SQL comments..."
echo "Run this SQL as HR or SYSTEM user:"
echo ""
cat << 'EOF'
SELECT 
    sql_id,
    SUBSTR(sql_fulltext, 1, 300) as sql_text,
    executions,
    last_active_time
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '5' MINUTE
  AND (sql_fulltext LIKE '%nr_%' OR sql_fulltext LIKE '%EMPLOYEES%')
ORDER BY last_active_time DESC
FETCH FIRST 10 ROWS ONLY;
EOF

echo ""
echo "Step 3: Check application logs..."
docker logs oracle-test-app 2>&1 | tail -50
```

## Notes

- The application uses Spring JdbcTemplate, which internally uses PreparedStatement
- All SQL queries in the app will go through `Connection.prepareStatement()`
- The New Relic agent should intercept these calls and prepend comments
- Oracle 23ai FREE is the target database (based on your config)
- Database connection: `10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com`
