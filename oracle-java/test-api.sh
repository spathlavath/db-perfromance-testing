#!/bin/bash
# Test API endpoints to generate SQL traffic for instrumentation verification

BASE_URL="http://localhost:3001"

echo "==> Testing Oracle Java Application with Custom New Relic Agent"
echo "==> This will generate SQL queries with trace comments: /* nr_trace_id=...,nr_span_id=... */"
echo ""

echo "1. Get all employees (SELECT query)..."
curl -s $BASE_URL/employees | jq '.[0:2]'
echo ""

echo "2. Get specific employee (SELECT with WHERE)..."
curl -s $BASE_URL/employees/100 | jq .
echo ""

echo "3. Get departments with stats (Complex JOIN)..."
curl -s $BASE_URL/departments | jq '.[0:2]'
echo ""

echo "4. Get salary report (Aggregation)..."
curl -s $BASE_URL/reports/salary-by-department | jq '.[0:2]'
echo ""

echo "5. Get jobs list..."
curl -s $BASE_URL/jobs | jq '.[0:2]'
echo ""

echo "6. Get employee history (Multiple JOINs)..."
curl -s $BASE_URL/employees/101/history | jq .
echo ""

echo "7. Get department employees (JOIN query)..."
curl -s $BASE_URL/departments/60/employees | jq '.[0:2]'
echo ""

echo "==> All API tests completed!"
echo ""
echo "Next steps to verify SQL instrumentation:"
echo ""
echo "1. Check New Relic Dashboard:"
echo "   https://staging.newrelic.com/accounts/12309804/applications/283083239"
echo ""
echo "2. Query Oracle v\$sql to see trace comments:"
echo "   SELECT sql_fulltext FROM v\$sql WHERE sql_fulltext LIKE '%nr_trace_id%' FETCH FIRST 5 ROWS ONLY;"
echo ""
echo "3. View application logs for SQL execution:"
echo "   docker-compose logs oracle-test-app | grep 'Executing prepared SQL'"
