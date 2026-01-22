# Testing SQL Instrumentation with Custom New Relic Agent

Your custom New Relic agent instruments `java.sql.Connection::prepareStatement` to prepend SQL comments like:
```sql
/* nr_trace_id=1234,nr_span_id=6789,nr_service=myapp */ SELECT ...
```

## Step 1: Rebuild and Restart

```bash
cd ~/db-perfromance-testing/oracle-java

# Rebuild with fixes
docker-compose up -d --build

# Wait for startup
sleep 10

# Check logs
docker-compose logs --tail=30 oracle-test-app
```

## Step 2: Generate SQL Traffic

Test various endpoints to trigger SQL queries:

```bash
# Test 1: Get all employees (SELECT with WHERE clause)
curl -s http://localhost:3001/employees | jq '.[0:2]'

# Test 2: Get specific employee (SELECT with JOIN)
curl -s http://localhost:3001/employees/100 | jq .

# Test 3: Get departments with stats (Complex JOIN query)
curl -s http://localhost:3001/departments | jq '.[0:2]'

# Test 4: Salary report (Aggregation query)
curl -s http://localhost:3001/reports/salary-by-department | jq '.[0:2]'

# Test 5: Create new employee (INSERT query)
curl -X POST http://localhost:3001/employees \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test.user@example.com",
    "phoneNumber": "555.123.4567",
    "hireDate": "2025-01-01",
    "jobId": "IT_PROG",
    "salary": 75000,
    "departmentId": 60
  }'

# Test 6: Update employee (UPDATE query)
curl -X PUT http://localhost:3001/employees/207 \
  -H "Content-Type: application/json" \
  -d '{
    "salary": 80000,
    "departmentId": 60
  }'
```

## Step 3: Verify SQL Comments in Oracle Database

Connect to Oracle and check v$sql to see the instrumented queries:

```sql
-- Connect to Oracle
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

-- Check recent SQL with New Relic comments
SELECT
    sql_id,
    sql_text,
    executions,
    elapsed_time/1000000 as elapsed_sec,
    buffer_gets,
    disk_reads
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext NOT LIKE '%v$sql%'
ORDER BY last_active_time DESC
FETCH FIRST 10 ROWS ONLY;

-- Or check SQL text containing the comment pattern
SELECT sql_id, sql_text
FROM v$sqlarea
WHERE sql_text LIKE '/* nr_%'
ORDER BY last_active_time DESC;
```

## Step 4: Verify in New Relic Dashboard

1. Go to New Relic: https://staging.newrelic.com/accounts/12309804/applications/283083239
2. Navigate to **Monitoring → APM & Services**
3. Select **Oracle-HR-Portal-Java**
4. Go to **Transactions** tab
5. Click on any transaction (e.g., `/employees`)
6. View **Database queries** section
7. You should see SQL queries with the prepended comments

## Step 5: Check Application Logs for SQL Execution

Since we have `logging.level.org.springframework.jdbc=debug` enabled:

```bash
# View SQL execution logs
docker-compose logs oracle-test-app | grep -A 2 "Executing prepared SQL"

# Or check for specific queries
docker-compose logs oracle-test-app | grep "SELECT.*FROM EMPLOYEES"
```

## Expected Results

### In Oracle v$sql:
```sql
/* nr_trace_id=abc123,nr_span_id=xyz789,nr_service=Oracle-HR-Portal-Java */
SELECT EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE_NUMBER,
       HIRE_DATE, JOB_ID, SALARY, COMMISSION_PCT, MANAGER_ID, DEPARTMENT_ID
FROM EMPLOYEES
ORDER BY EMPLOYEE_ID
```

### In New Relic APM:
- Transaction traces will show database time
- SQL queries will appear with the comments
- You can correlate trace IDs between New Relic and Oracle
- Database performance metrics will be captured

## Troubleshooting

### If SQL comments are NOT appearing:

1. **Verify custom agent is loaded:**
```bash
docker-compose logs oracle-test-app | grep "newrelic.jar"
```

2. **Check agent version:**
```bash
docker-compose exec oracle-test-app ls -lh /app/newrelic/newrelic.jar
```

3. **Verify instrumentation module:**
Check if your custom instrumentation is in the JAR:
```bash
docker-compose exec oracle-test-app unzip -l /app/newrelic/newrelic.jar | grep -i preparestatement
```

4. **Enable New Relic debug logging:**
Update .env file:
```bash
NEW_RELIC_LOG_LEVEL=finest
```
Then rebuild and check logs for instrumentation details.

## Performance Impact

The SQL comment prepending should have minimal performance impact:
- Comments are small (< 100 bytes typically)
- Prepending happens at prepare time, not execution time
- Oracle parses and ignores comments efficiently
- Benefit: Full correlation between APM traces and database queries

## Next Steps

1. Run load tests with k6 to generate sustained traffic
2. Monitor New Relic dashboard for SQL performance
3. Query Oracle v$sql to verify comments are present
4. Use trace IDs to correlate slow queries between New Relic and Oracle AWR/ASH
