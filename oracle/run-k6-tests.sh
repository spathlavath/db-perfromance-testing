#!/bin/bash

# K6 Load Test Runner for Oracle HR Portal
# Runs different intensity levels and stress tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL=${BASE_URL:-"http://oracle-test-app:3000"}
RESULTS_DIR="./k6/results"

# Create results directory
mkdir -p "$RESULTS_DIR"

# Function to display menu
show_menu() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║         Oracle HR Portal - K6 Load Test Suite                 ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Select a test to run:"
    echo ""
    echo -e "${GREEN}1)${NC} LOW Intensity    - 20 VUs max    | 3-5s think time  | 30 min"
    echo -e "${GREEN}2)${NC} MEDIUM Intensity - 50 VUs max    | 1-3s think time  | 30 min"
    echo -e "${GREEN}3)${NC} HIGH Intensity   - 120 VUs max   | 0.5-2s think time| 30 min"
    echo -e "${YELLOW}4)${NC} STRESS Test      - 50→400 VUs    | 0.1-0.5s think  | 32 min"
    echo -e "${RED}5)${NC} MAXIMUM/CRASH    - 100→500 VUs   | NO think time   | 13 min"
    echo ""
    echo -e "${BLUE}6)${NC} Run ALL tests in sequence (Low → Medium → High → Stress)"
    echo -e "${BLUE}7)${NC} Custom test (specify VUs and duration)"
    echo ""
    echo -e "0) Exit"
    echo ""
}

# Function to wait for app to be healthy
wait_for_app() {
    echo -e "${YELLOW}Checking if application is ready...${NC}"

    max_retries=30
    retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if curl -f -s "${BASE_URL}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Application is ready!${NC}"
            return 0
        fi

        retry_count=$((retry_count + 1))
        echo -e "${YELLOW}Waiting for application... (${retry_count}/${max_retries})${NC}"
        sleep 2
    done

    echo -e "${RED}✗ Application is not responding. Please check docker-compose logs.${NC}"
    return 1
}

# Function to run k6 test
run_test() {
    local test_name=$1
    local intensity=$2
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local result_file="${RESULTS_DIR}/${test_name}_${timestamp}.json"

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Running ${test_name} Test${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Intensity: ${intensity}"
    echo "Results will be saved to: ${result_file}"
    echo ""

    # Run with docker-compose using TEST_INTENSITY environment variable
    docker-compose run --rm \
        -e BASE_URL="${BASE_URL}" \
        -e TEST_INTENSITY="${intensity}" \
        k6 run --out json="${result_file}" "/scripts/load-test.js"

    echo ""
    echo -e "${GREEN}✓ Test completed!${NC}"
    echo -e "Results saved to: ${result_file}"
    echo ""
}

# Function to run custom test
run_custom_test() {
    echo ""
    echo "Custom Test Configuration"
    echo "------------------------"
    read -p "Enter target VUs: " target_vus
    read -p "Enter test duration (e.g., 10m, 30m, 1h): " duration
    read -p "Enter ramp-up time (e.g., 2m, 5m): " ramp_time

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local result_file="${RESULTS_DIR}/custom_${target_vus}vu_${timestamp}.json"

    echo ""
    echo -e "${BLUE}Running custom test: ${target_vus} VUs for ${duration}${NC}"
    echo ""

    docker-compose run --rm \
        -e BASE_URL="${BASE_URL}" \
        k6 run \
        --vus "${target_vus}" \
        --duration "${duration}" \
        --ramp-up-time "${ramp_time}" \
        --out json="${result_file}" \
        /scripts/load-test.js

    echo ""
    echo -e "${GREEN}✓ Custom test completed!${NC}"
    echo -e "Results saved to: ${result_file}"
    echo ""
}

# Main script
main() {
    # Check if running inside container or host
    if [ ! -f "/.dockerenv" ]; then
        # Running on host - need to use docker-compose

        # Check if app is running
        if ! docker-compose ps | grep -q "oracle-test-app.*Up"; then
            echo -e "${YELLOW}Starting Oracle HR Portal application...${NC}"
            docker-compose up -d oracle-test-app
            sleep 5
        fi

        # Wait for app to be healthy
        wait_for_app || exit 1
    fi

    while true; do
        show_menu
        read -p "Enter your choice [0-7]: " choice

        case $choice in
            1)
                run_test "LOW" "low"
                ;;
            2)
                run_test "MEDIUM" "medium"
                ;;
            3)
                run_test "HIGH" "high"
                ;;
            4)
                run_test "STRESS" "stress"
                ;;
            5)
                echo -e "${RED}⚠️  WARNING: This test will intentionally crash/overwhelm the application!${NC}"
                read -p "Are you sure you want to continue? (yes/no): " confirm
                if [ "$confirm" = "yes" ]; then
                    run_test "MAXIMUM" "max"
                else
                    echo "Test cancelled."
                fi
                ;;
            6)
                echo -e "${BLUE}Running ALL tests in sequence...${NC}"
                echo -e "${YELLOW}This will take approximately 2+ hours${NC}"
                read -p "Continue? (yes/no): " confirm
                if [ "$confirm" = "yes" ]; then
                    run_test "LOW" "low"
                    sleep 60  # 1 minute cooldown
                    run_test "MEDIUM" "medium"
                    sleep 60
                    run_test "HIGH" "high"
                    sleep 60
                    run_test "STRESS" "stress"
                    echo -e "${GREEN}✓ All tests completed!${NC}"
                else
                    echo "Tests cancelled."
                fi
                ;;
            7)
                run_custom_test
                ;;
            0)
                echo -e "${GREEN}Exiting...${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid option. Please try again.${NC}"
                ;;
        esac

        read -p "Press Enter to continue..."
    done
}

# Run main function
main
