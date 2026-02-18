#!/bin/bash
# Scenario 3: Blocking Scenarios
# Use case: Row locks, table locks, blocking sessions, deadlocks

BASE_URL="${BASE_URL:-http://localhost:3002}"

echo "[$(date)] [BLOCKING] Starting blocking scenario..."

# Row-level lock (3 seconds)
curl -sf -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=3" > /dev/null 2>&1 &
LOCK_PID=$!
sleep 1
curl -sf $BASE_URL/employees/100 > /dev/null 2>&1  # This will wait
wait $LOCK_PID 2>/dev/null || true

# Department lock (3 seconds)
curl -sf -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=3" > /dev/null 2>&1 &
DEPT_PID=$!
sleep 1
curl -sf $BASE_URL/departments/50/employees > /dev/null 2>&1
wait $DEPT_PID 2>/dev/null || true

# Batch update with delay
curl -sf -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=2&delaySeconds=2" > /dev/null 2>&1

echo "[$(date)] [BLOCKING] Completed"
