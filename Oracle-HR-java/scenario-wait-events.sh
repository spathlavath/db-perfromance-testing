#!/bin/bash
# Scenario 3: Wait Events (via concurrent access patterns)
# Use case: Generate wait events through high concurrency and resource contention
# Note: Oracle-HR-java doesn't have blocking APIs, so we create waits via concurrent queries

BASE_URL="${BASE_URL:-http://localhost:3002}"

echo "[$(date)] [WAIT-EVENTS] Starting wait event scenario..."

# Strategy: Run multiple concurrent queries to create buffer busy waits, latch contention

# 1. Concurrent access to same employees (buffer busy waits, latch contention)
echo "[$(date)] [WAIT-EVENTS] Creating concurrent access to same resources..."
for i in {1..5}; do
    curl -sf $BASE_URL/employees/100 > /dev/null 2>&1 &
    curl -sf $BASE_URL/employees/101 > /dev/null 2>&1 &
    curl -sf $BASE_URL/employees/102 > /dev/null 2>&1 &
done
wait

sleep 1

# 2. Heavy aggregation queries running concurrently (CPU waits, I/O waits)
echo "[$(date)] [WAIT-EVENTS] Creating CPU and I/O contention..."
curl -sf $BASE_URL/reports/salary-by-department > /dev/null 2>&1 &
curl -sf $BASE_URL/reports/employee-turnover > /dev/null 2>&1 &
curl -sf $BASE_URL/departments/metrics > /dev/null 2>&1 &
wait

sleep 1

# 3. Concurrent department queries (shared resource access)
echo "[$(date)] [WAIT-EVENTS] Creating shared resource contention..."
for i in {50,60,80,90,100}; do
    curl -sf $BASE_URL/departments/${i}/employees > /dev/null 2>&1 &
done
wait

sleep 1

# 4. Mix of reads and complex queries (cache buffer chains latch)
echo "[$(date)] [WAIT-EVENTS] Creating mixed workload contention..."
curl -sf $BASE_URL/employees > /dev/null 2>&1 &
curl -sf $BASE_URL/jobs/compensation-analysis > /dev/null 2>&1 &
curl -sf $BASE_URL/employees/103/history > /dev/null 2>&1 &
wait

echo "[$(date)] [WAIT-EVENTS] Completed - Generated buffer waits, latch contention, I/O waits"
