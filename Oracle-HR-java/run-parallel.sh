#!/bin/bash
# Run all test scenarios in parallel continuously
# This simulates real application load with different query patterns

BASE_URL="${BASE_URL:-http://localhost:3002}"
INTERVAL="${INTERVAL:-60}"

export BASE_URL

echo "=========================================="
echo "Oracle HR Load Test - Parallel Execution"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Interval: ${INTERVAL}s"
echo ""

# Make scripts executable
chmod +x scenario-*.sh

# Worker function
run_scenario() {
    local scenario=$1
    local worker_id=$2
    local iteration=0

    while true; do
        iteration=$((iteration + 1))
        echo "[Worker-${worker_id}] [Iteration ${iteration}] Running ${scenario}..."
        bash "${scenario}"
        sleep $((INTERVAL + RANDOM % 10))  # Add jitter
    done
}

# Start 4 workers in parallel (one for each scenario)
run_scenario "scenario-read-only.sh" 1 &
PID1=$!

run_scenario "scenario-slow-queries.sh" 2 &
PID2=$!

run_scenario "scenario-blocking.sh" 3 &
PID3=$!

run_scenario "scenario-wait-events.sh" 4 &
PID4=$!

echo "Started 4 parallel workers:"
echo "  Worker 1 (Read-Only): PID $PID1"
echo "  Worker 2 (Slow Queries): PID $PID2"
echo "  Worker 3 (Blocking): PID $PID3"
echo "  Worker 4 (Wait Events): PID $PID4"
echo ""
echo "Press Ctrl+C to stop all workers"

# Save PIDs for cleanup
echo "$PID1 $PID2 $PID3 $PID4" > .worker-pids

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping all workers..."
    kill $PID1 $PID2 $PID3 $PID4 2>/dev/null || true
    rm -f .worker-pids
    echo "All workers stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for workers
wait
