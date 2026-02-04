#!/bin/bash
# Test API endpoints to generate SQL traffic for instrumentation verification
# All endpoints below use PREPARED STATEMENTS with parameters

BASE_URL="http://localhost:3001"

echo "==> Testing Oracle Java Application with Custom New Relic Agent"
echo "==> All queries below use PREPARED STATEMENTS with trace comments: /* nr_service=...,nr_txn=... */"
echo ""

echo "1. Get all employees (Complex query with JOINs and subqueries - PREPARED STATEMENT)..."
curl -s $BASE_URL/employees | jq '.employees[0:2]'
echo ""

echo "2. Get specific employee (SELECT with WHERE - PREPARED STATEMENT)..."
curl -s $BASE_URL/employees/100 | jq .
echo ""

echo "3. Get employee history (Multiple JOINs - PREPARED STATEMENT)..."
curl -s $BASE_URL/employees/101/history | jq '.history[0:2]'
echo ""

echo "4. Get all departments (Complex query with JOINs and subqueries - PREPARED STATEMENT)..."
curl -s $BASE_URL/departments | jq '.departments[0:2]'
echo ""

echo "5. Get department employees (JOIN query - PREPARED STATEMENT)..."
curl -s $BASE_URL/departments/60/employees | jq '.employees[0:2]'
echo ""

echo "6. Get departments with metrics (Complex query with subqueries - PREPARED STATEMENT)..."
curl -s $BASE_URL/departments/metrics | jq '.departments[0:2]'
echo ""

echo "7. Get all jobs (Complex query with JOINs and subqueries - PREPARED STATEMENT)..."
curl -s $BASE_URL/jobs | jq '.jobs[0:2]'
echo ""

echo "8. Get jobs with compensation analysis (Complex query with percentiles - PREPARED STATEMENT)..."
curl -s $BASE_URL/jobs/compensation-analysis | jq '.jobs[0:2]'
echo ""

echo "9. Get salary report by department (Complex aggregation - PREPARED STATEMENT)..."
curl -s $BASE_URL/reports/salary-by-department | jq '.report[0:2]'
echo ""

echo "10. Get employee turnover report (Complex query with date ranges - PREPARED STATEMENT)..."
curl -s $BASE_URL/reports/employee-turnover | jq '.report[0:2]'
echo ""

echo "11. Get location-wise report (Complex query with location analysis - PREPARED STATEMENT)..."
curl -s $BASE_URL/reports/location-wise | jq '.report[0:2]'
echo ""



echo "==> Testing Blocking Scenarios (Optional - comment out if not needed)"
echo ""

echo "12. Get current locks in database..."
curl -s $BASE_URL/blocking/locks | jq '.locks[0:3]'
echo ""

echo "13. Get blocking sessions..."
curl -s $BASE_URL/blocking/blocking-sessions | jq '.'
echo ""

echo "14. Lock employee 100 for 10 seconds (row-level lock)..."
curl -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=10" | jq '.'
echo ""
echo "    Note: Employee 100 is now locked for 10 seconds. Run step 15 in another terminal to see blocking."
echo ""

echo "15. Lock all employees in department 50 for 10 seconds..."
curl -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=10" | jq '.'
echo ""

echo "16. Batch salary increase for department 60 (5% with 3-second delay)..."
curl -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=5&delaySeconds=3" | jq '.'
echo ""

echo "17. Create deadlock scenario between employees 100 and 101..."
curl -X POST "$BASE_URL/blocking/create-deadlock?employeeId1=100&employeeId2=101" | jq '.'
echo ""
echo "    Note: Check application logs to see which transaction was rolled back."
echo ""

echo "==> All API tests completed!"
echo "==> All queries above use PREPARED STATEMENTS with parameters"
echo ""
echo "Next steps to verify SQL instrumentation:"
echo ""
echo "1. Check New Relic Dashboard:"
echo "   https://staging.newrelic.com/accounts/12309804/applications/283083239"
echo ""
echo "2. Query Oracle v\$sql to see SQL comments with nr_service_guid:"
echo "   SELECT sql_fulltext FROM v\$sql WHERE sql_fulltext LIKE '%nr_service%' FETCH FIRST 10 ROWS ONLY;"
echo ""
echo "3. View application logs for SQL execution:"
echo "   docker-compose logs oracle-test-app | grep 'Executing prepared SQL'"
echo ""
echo "4. Verify all queries use prepared statements (look for '?' placeholders):"
echo "   docker-compose logs oracle-test-app | grep 'PreparedStatement'"
echo ""
echo "5. Check for blocking events in logs:"
echo "   docker-compose logs oracle-test-app | grep -E 'Locking|locked|Deadlock'"
echo ""
echo "6. Query OTel metrics for blocking correlation:"
echo "   SELECT * FROM Metric WHERE metricName LIKE 'newrelicoracledb%'"
echo "   FACET client_name, transaction_name, normalised_sql_hash"
