#!/bin/sh

# K6 Test Wrapper Script
# Selects the appropriate test script based on TEST_INTENSITY environment variable

TEST_INTENSITY=${TEST_INTENSITY:-medium}

echo "========================================"
echo "K6 Load Test Launcher"
echo "========================================"
echo "Test Intensity: ${TEST_INTENSITY}"
echo ""

case "${TEST_INTENSITY}" in
    low)
        echo "Running LOW intensity test (0→100 VUs ramping, 1-2s think time, 40 min)"
        ;;
    medium)
        echo "Running MEDIUM intensity test (0→200 VUs ramping, 0.5-1s think time, 40 min)"
        ;;
    high)
        echo "Running HIGH intensity test (0→500 VUs ramping, 0.2-0.5s think time, 40 min)"
        ;;
    stress)
        echo "Running STRESS test (0→1000 VUs ramping, 0.1-0.3s think time, 40 min)"
        ;;
    max|maximum|crash)
        echo "⚠️  Running MAXIMUM/CRASH test (0→2000 VUs ramping, 0.05-0.2s think time, 40 min)"
        echo "⚠️  This will intentionally overwhelm the system!"
        ;;
    *)
        echo "ERROR: Unknown TEST_INTENSITY: ${TEST_INTENSITY}"
        echo "Valid values: low, medium, high, stress, max"
        exit 1
        ;;
esac

# All intensity modes use the same unified load-test.js file
exec k6 run /scripts/load-test.js
