#!/bin/bash
# Scenario 4: Wait Events (I/O, CPU, Latch, Library Cache, Buffer Busy)
# Use case: Generate various Oracle wait events that OTel will capture

BASE_URL="${BASE_URL:-http://localhost:3002}"

echo "[$(date)] [WAIT-EVENTS] Starting wait event scenario..."

# 1. Disk I/O wait events (db file sequential read, db file scattered read)
echo "[$(date)] [WAIT-EVENTS] Creating disk I/O waits..."
curl -sf -X POST "$BASE_URL/blocking/disk-io-wait?durationSeconds=5" > /dev/null 2>&1

sleep 1

# 2. CPU-intensive wait events (CPU time)
echo "[$(date)] [WAIT-EVENTS] Creating CPU waits..."
curl -sf -X POST "$BASE_URL/blocking/cpu-wait?durationSeconds=5" > /dev/null 2>&1

sleep 1

# 3. Latch contention waits (latch: cache buffers chains)
echo "[$(date)] [WAIT-EVENTS] Creating latch contention..."
curl -sf -X POST "$BASE_URL/blocking/latch-contention?durationSeconds=5&threadCount=3" > /dev/null 2>&1

sleep 1

# 4. Library cache waits (library cache lock/pin)
echo "[$(date)] [WAIT-EVENTS] Creating library cache waits..."
curl -sf -X POST "$BASE_URL/blocking/library-cache-wait?durationSeconds=5" > /dev/null 2>&1

sleep 1

# 5. Buffer busy waits (buffer busy waits, read by other session)
echo "[$(date)] [WAIT-EVENTS] Creating buffer busy waits..."
curl -sf -X POST "$BASE_URL/blocking/buffer-busy-wait?durationSeconds=5&concurrency=5" > /dev/null 2>&1

sleep 1

# 6. Row lock contention - Traditional blocking wait event
echo "[$(date)] [WAIT-EVENTS] Creating TX row lock contention..."
curl -sf -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=3" > /dev/null 2>&1 &
LOCK_PID=$!
sleep 1
curl -sf $BASE_URL/employees/100 > /dev/null 2>&1
wait $LOCK_PID 2>/dev/null || true

echo "[$(date)] [WAIT-EVENTS] Completed - Generated I/O, CPU, latch, library cache, buffer, and TX wait events"
