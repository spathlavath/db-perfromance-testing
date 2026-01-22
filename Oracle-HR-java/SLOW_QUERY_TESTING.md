# Testing Slow Query with NR Trace Comments

## What Was Changed

I modified the `getAllEmployees()` query in `EmployeeService.java` to make it:
1. **More complex** - Multiple JOINs, subqueries, WHERE clauses
2. **Slower** - Will execute slower and appear in slow query monitoring
3. **Uses PreparedStatement** - Added parameters so NR trace comments are attached

## The Complex Query

### Before (Simple):
```sql
SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME, e.EMAIL,
       e.PHONE_NUMBER, e.HIRE_DATE, e.JOB_ID, e.SALARY,
       e.MANAGER_ID, e.DEPARTMENT_ID, d.DEPARTMENT_NAME
FROM EMPLOYEES e
LEFT JOIN DEPARTMENTS d ON e.DEPARTMENT_ID = d.DEPARTMENT_ID
ORDER BY e.EMPLOYEE_ID
```
- No parameters → Uses Statement → **No NR comments**
- Fast execution → Won't appear in slow query logs

### After (Complex):
```sql
SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME, e.EMAIL,
       e.PHONE_NUMBER, e.HIRE_DATE, e.JOB_ID, e.SALARY,
       e.MANAGER_ID, e.DEPARTMENT_ID, d.DEPARTMENT_NAME,
       j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY,
       m.FIRST_NAME as MANAGER_FIRST_NAME, m.LAST_NAME as MANAGER_LAST_NAME,
       l.CITY, l.STATE_PROVINCE, l.COUNTRY_ID,
       (SELECT COUNT(*) FROM JOB_HISTORY jh WHERE jh.EMPLOYEE_ID = e.EMPLOYEE_ID) as JOB_HISTORY_COUNT,
       (SELECT AVG(SALARY) FROM EMPLOYEES WHERE DEPARTMENT_ID = e.DEPARTMENT_ID) as DEPT_AVG_SALARY,
       (SELECT MAX(SALARY) FROM EMPLOYEES WHERE JOB_ID = e.JOB_ID) as JOB_MAX_SALARY
FROM EMPLOYEES e
LEFT JOIN DEPARTMENTS d ON e.DEPARTMENT_ID = d.DEPARTMENT_ID
LEFT JOIN JOBS j ON e.JOB_ID = j.JOB_ID
LEFT JOIN EMPLOYEES m ON e.MANAGER_ID = m.EMPLOYEE_ID
LEFT JOIN LOCATIONS l ON d.LOCATION_ID = l.LOCATION_ID
WHERE e.SALARY >= ?
AND (e.DEPARTMENT_ID IS NOT NULL OR e.JOB_ID LIKE ?)
AND e.HIRE_DATE >= TO_DATE(?, 'YYYY-MM-DD')
ORDER BY e.DEPARTMENT_ID, e.SALARY DESC, e.LAST_NAME
```

### What Makes It Slow:

1. **5 JOINs**:
   - DEPARTMENTS
   - JOBS
   - EMPLOYEES (self-join for manager)
   - LOCATIONS
   - Multiple correlated subqueries

2. **3 Correlated Subqueries** (executed per row):
   - `SELECT COUNT(*) FROM JOB_HISTORY` - Count job history per employee
   - `SELECT AVG(SALARY) FROM EMPLOYEES` - Avg salary per department
   - `SELECT MAX(SALARY) FROM EMPLOYEES` - Max salary per job

3. **WHERE Clause Conditions**:
   - Salary filter: `e.SALARY >= 3000`
   - Department or job filter
   - Hire date filter: `>= 1987-01-01`

4. **Complex ORDER BY**:
   - Department, Salary DESC, Last Name

5. **Uses Parameters** (`?, ?, ?`):
   - Forces PreparedStatement → **Gets NR trace comments!**

## Rebuild and Test

### Step 1: Rebuild on VM

```bash
cd ~/db-perfromance-testing/oracle-java

# Pull latest changes
git pull

# Rebuild
./rebuild.sh
```

### Step 2: Test the Slow Query

```bash
# Hit the /employees endpoint (uses getAllEmployees)
curl -s http://localhost:3001/employees | jq '.[0:3]'

# Or run multiple times to generate traffic
for i in {1..10}; do
  curl -s http://localhost:3001/employees > /dev/null
  echo "Request $i completed"
  sleep 1
done
```

### Step 3: Check Logs for NR Comments

```bash
docker-compose logs oracle-test-app | grep -A 2 "getAllEmployees"
docker-compose logs oracle-test-app | grep "nr_trace_id" | grep -i "LOCATION"
```

You should see:
```
SQLMetadata-- 1 /* nr_trace_id=xxx,nr_span_id=yyy,nr_service=Oracle-HR-Portal-Java */ SELECT e.EMPLOYEE_ID, e.FIRST_NAME... l.CITY, l.STATE_PROVINCE, l.COUNTRY_ID...
```

### Step 4: Verify in Oracle v$sql

Connect to Oracle and check for the slow query with trace comments:

```sql
sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
```

```sql
-- Find queries with LOCATIONS join (our complex query)
SELECT
    sql_id,
    SUBSTR(sql_fulltext, 1, 150) as sql_preview,
    executions,
    elapsed_time/1000000 as elapsed_sec,
    buffer_gets,
    disk_reads,
    TO_CHAR(last_active_time, 'YYYY-MM-DD HH24:MI:SS') as last_active
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext LIKE '%LOCATIONS%'
  AND sql_fulltext NOT LIKE '%v$sql%'
ORDER BY last_active_time DESC
FETCH FIRST 5 ROWS ONLY;
```

```sql
-- Get full SQL text with trace ID
SELECT
    sql_id,
    sql_fulltext,
    executions,
    elapsed_time/1000000 as elapsed_sec
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext LIKE '%JOB_HISTORY_COUNT%'
  AND sql_fulltext NOT LIKE '%v$sql%'
FETCH FIRST 1 ROWS ONLY;
```

### Step 5: Check Performance in New Relic

1. Go to: https://staging.newrelic.com/accounts/11600319/applications/283090211
2. Navigate to **Transactions**
3. Find `GET /employees` transaction
4. Check:
   - **Transaction duration** - Should be higher now
   - **Database queries** - Should show the complex query
   - **Slow query traces** - Should appear in slow SQL list

### Step 6: Analyze Query Performance

```sql
-- Get execution plan for the SQL
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR('your_sql_id_here', NULL, 'ALLSTATS LAST'));

-- Check query statistics
SELECT
    sql_id,
    executions,
    elapsed_time/1000000/executions as avg_elapsed_sec,
    cpu_time/1000000/executions as avg_cpu_sec,
    buffer_gets/executions as avg_buffer_gets,
    disk_reads/executions as avg_disk_reads,
    rows_processed/executions as avg_rows
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext LIKE '%LOCATIONS%'
  AND sql_fulltext NOT LIKE '%v$sql%'
  AND executions > 0;
```

## Expected Results

### In Logs:
```
DEBUG ... Executing prepared SQL query
DEBUG ... Executing prepared SQL statement [SELECT e.EMPLOYEE_ID... LOCATIONS l...WHERE e.SALARY >= ? AND...]
SQLMetadata-- 1 /* nr_trace_id=abc123,nr_span_id=xyz789,nr_service=Oracle-HR-Portal-Java */ SELECT e.EMPLOYEE_ID...
```

### In Oracle v$sql:
```
SQL_ID        SQL_PREVIEW                                                     EXECUTIONS  ELAPSED_SEC
------------- --------------------------------------------------------------- ----------  -----------
9xy7z8w6m5n4  /* nr_trace_id=abc123,nr_span_id=xyz789,nr_service=Oracle-...  5           0.234
```

### In New Relic:
- Transaction `/employees` shows increased database time
- SQL query appears in "Slow queries" section
- You can see execution time, call count, time per call
- Trace correlation between APM and database

## Performance Comparison

| Metric | Before (Simple) | After (Complex) |
|--------|----------------|-----------------|
| JOINs | 1 | 5 |
| Subqueries | 0 | 3 correlated |
| WHERE conditions | 0 | 3 |
| Estimated execution time | ~5ms | ~50-200ms |
| NR Comments | ❌ NO | ✅ YES |
| Shows in slow queries | ❌ NO | ✅ YES |

## Benefits for Testing

1. **Realistic slow query scenario** - Shows how NR agent handles complex queries
2. **Trace correlation** - Can correlate trace_id between New Relic and Oracle
3. **Performance analysis** - Demonstrates query optimization opportunities
4. **Monitoring validation** - Proves slow query detection works

## Reverting Changes

If you want to revert to the simple query:

```bash
git checkout src/main/java/com/oracle/test/service/EmployeeService.java
```

Or keep both by creating a new endpoint:
- `/employees` - Simple fast query
- `/employees-detailed` - Complex slow query
