#!/bin/bash
# Scenario 4: Wait Events (enq: TX - row lock contention, application wait events)
# Use case: Generate wait events that OTel will capture

BASE_URL="${BASE_URL:-http://localhost:3001}"

echo "[$(date)] [WAIT-EVENTS] Starting wait event scenario..."

# Strategy: Create locks in background, then try to access locked resources
# This generates various wait events: enq: TX - row lock contention, latch waits, etc.

# 1. Row lock contention - Lock employee in background
curl -sf -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=5" > /dev/null 2>&1 &
LOCK_PID=$!
sleep 1

# Try to access locked row - generates "enq: TX - row lock contention" wait event
echo "[$(date)] [WAIT-EVENTS] Creating TX row lock contention..."
curl -sf $BASE_URL/employees/100 > /dev/null 2>&1
wait $LOCK_PID 2>/dev/null || true

sleep 2

# 2. Table-level contention - Lock department in background
curl -sf -X POST "$BASE_URL/blocking/lock-department-employees/60?durationSeconds=5" > /dev/null 2>&1 &
DEPT_PID=$!
sleep 1

# Try to access locked department - generates wait events
echo "[$(date)] [WAIT-EVENTS] Creating multi-row lock contention..."
curl -sf $BASE_URL/departments/60/employees > /dev/null 2>&1
wait $DEPT_PID 2>/dev/null || true

sleep 2

# 3. Application wait event - Batch update with intentional delay
echo "[$(date)] [WAIT-EVENTS] Creating application wait (sleep/delay)..."
curl -sf -X POST "$BASE_URL/blocking/batch-salary-increase/50?increasePercent=1&delaySeconds=3" > /dev/null 2>&1

sleep 2

# 4. Concurrent access to create buffer busy waits
echo "[$(date)] [WAIT-EVENTS] Creating concurrent access patterns..."
curl -sf $BASE_URL/employees/101 > /dev/null 2>&1 &
curl -sf $BASE_URL/employees/102 > /dev/null 2>&1 &
curl -sf $BASE_URL/employees/103 > /dev/null 2>&1 &
wait

# 5. Query blocking sessions and locks (monitoring queries)
curl -sf $BASE_URL/blocking/locks > /dev/null 2>&1
curl -sf $BASE_URL/blocking/blocking-sessions > /dev/null 2>&1

echo "[$(date)] [WAIT-EVENTS] Completed - Generated TX locks, application waits, buffer waits"
