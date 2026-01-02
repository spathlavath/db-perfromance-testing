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
        echo "Running LOW intensity test (20 VUs, 3-5s think time, 30 min)"
        ;;
    medium)
        echo "Running MEDIUM intensity test (50 VUs, 1-3s think time, 30 min)"
        ;;
    high)
        echo "Running HIGH intensity test (120 VUs, 0.5-2s think time, 30 min)"
        ;;
    stress)
        echo "Running STRESS test (50→400 VUs, 0.1-0.5s think time, 32 min)"
        ;;
    max|maximum|crash)
        echo "⚠️  Running MAXIMUM/CRASH test (100→500 VUs, NO think time, 13 min)"
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
