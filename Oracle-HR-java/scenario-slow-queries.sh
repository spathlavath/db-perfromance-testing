#!/bin/bash
# Scenario 2: Slow Queries (Complex aggregations and reports)
# Use case: Heavy analytical queries that take longer

BASE_URL="${BASE_URL:-http://localhost:3002}"

echo "[$(date)] [SLOW-QUERY] Starting slow query scenario..."

# Complex queries with JOINs and aggregations
curl -sf $BASE_URL/employees > /dev/null
curl -sf $BASE_URL/employees/101/history > /dev/null
curl -sf $BASE_URL/departments/metrics > /dev/null
curl -sf $BASE_URL/jobs/compensation-analysis > /dev/null

# Heavy report queries
curl -sf $BASE_URL/reports/salary-by-department > /dev/null
curl -sf $BASE_URL/reports/employee-turnover > /dev/null
curl -sf $BASE_URL/reports/location-wise > /dev/null

echo "[$(date)] [SLOW-QUERY] Completed"
