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

echo "==> All API tests completed!"
echo "==> All queries above use PREPARED STATEMENTS with parameters"
echo ""
echo "Next steps to verify SQL instrumentation:"
echo ""
echo "1. Check New Relic Dashboard:"
echo "   https://staging.newrelic.com/accounts/12309804/applications/283083239"
echo ""
echo "2. Query Oracle v\$sql to see trace comments in prepared statements:"
echo "   SELECT sql_fulltext FROM v\$sql WHERE sql_fulltext LIKE '%nr_trace_id%' FETCH FIRST 10 ROWS ONLY;"
echo ""
echo "3. View application logs for SQL execution:"
echo "   docker-compose logs oracle-test-app | grep 'Executing prepared SQL'"
echo ""
echo "4. Verify all queries use prepared statements (look for '?' placeholders):"
echo "   docker-compose logs oracle-test-app | grep 'PreparedStatement'"
