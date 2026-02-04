#!/bin/bash
# Continuous Simulation Script - Runs test-api.sh and blocking scenarios back-to-back
# This generates sustained load with both normal queries and blocking scenarios

BASE_URL="http://localhost:3001"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
ITERATIONS=0  # 0 means infinite
DELAY_BETWEEN_CYCLES=5
SKIP_BLOCKING=false
QUIET_MODE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -i|--iterations)
            ITERATIONS="$2"
            shift 2
            ;;
        -d|--delay)
            DELAY_BETWEEN_CYCLES="$2"
            shift 2
            ;;
        --skip-blocking)
            SKIP_BLOCKING=true
            shift
            ;;
        -q|--quiet)
            QUIET_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -i, --iterations N     Number of iterations (0 = infinite, default: 0)"
            echo "  -d, --delay N          Delay in seconds between cycles (default: 5)"
            echo "  --skip-blocking        Skip blocking scenarios, only run regular API tests"
            echo "  -q, --quiet            Quiet mode - less verbose output"
            echo "  -h, --help             Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                              # Run infinite simulation"
            echo "  $0 -i 10                        # Run 10 iterations"
            echo "  $0 -i 5 -d 10                   # Run 5 iterations with 10s delay"
            echo "  $0 --skip-blocking              # Run only regular API tests"
            echo "  $0 -i 100 -q                    # Run 100 iterations in quiet mode"
            echo ""
            echo "Press Ctrl+C to stop the simulation at any time."
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

function print_header() {
    if [ "$QUIET_MODE" = false ]; then
        echo -e "${BLUE}=========================================="
        echo -e "$1"
        echo -e "==========================================${NC}"
    fi
}

function print_info() {
    if [ "$QUIET_MODE" = false ]; then
        echo -e "${GREEN}[INFO]${NC} $1"
    fi
}

function print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

function print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if application is running
function check_app_health() {
    if ! curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
        print_error "Application is not responding at $BASE_URL"
        print_error "Please ensure the application is running: docker-compose up -d"
        exit 1
    fi
}

# Run regular API tests
function run_api_tests() {
    local iteration=$1

    print_info "Running regular API tests (iteration $iteration)..."

    if [ "$QUIET_MODE" = true ]; then
        # In quiet mode, run silently
        curl -s "$BASE_URL/employees" > /dev/null
        curl -s "$BASE_URL/employees/100" > /dev/null
        curl -s "$BASE_URL/employees/101/history" > /dev/null
        curl -s "$BASE_URL/departments" > /dev/null
        curl -s "$BASE_URL/departments/60/employees" > /dev/null
        curl -s "$BASE_URL/departments/metrics" > /dev/null
        curl -s "$BASE_URL/jobs" > /dev/null
        curl -s "$BASE_URL/jobs/compensation-analysis" > /dev/null
        curl -s "$BASE_URL/reports/salary-by-department" > /dev/null
        curl -s "$BASE_URL/reports/employee-turnover" > /dev/null
        curl -s "$BASE_URL/reports/location-wise" > /dev/null
        print_info "Regular API tests completed"
    else
        # Verbose mode - show some output
        echo ""
        echo "1. Get employees..."
        curl -s "$BASE_URL/employees" | jq -r '.employees | length' | xargs echo "   Fetched employees:"

        echo "2. Get employee 100..."
        curl -s "$BASE_URL/employees/100" | jq -r '.FIRST_NAME + " " + .LAST_NAME' | xargs echo "   Employee:"

        echo "3. Get employee history..."
        curl -s "$BASE_URL/employees/101/history" | jq -r '.history | length' | xargs echo "   History records:"

        echo "4. Get departments..."
        curl -s "$BASE_URL/departments" | jq -r '.departments | length' | xargs echo "   Fetched departments:"

        echo "5. Get department employees..."
        curl -s "$BASE_URL/departments/60/employees" | jq -r '.employees | length' | xargs echo "   Employees in dept 60:"

        echo "6. Get departments with metrics..."
        curl -s "$BASE_URL/departments/metrics" | jq -r '.departments | length' | xargs echo "   Departments with metrics:"

        echo "7. Get jobs..."
        curl -s "$BASE_URL/jobs" | jq -r '.jobs | length' | xargs echo "   Fetched jobs:"

        echo "8. Get jobs compensation analysis..."
        curl -s "$BASE_URL/jobs/compensation-analysis" | jq -r '.jobs | length' | xargs echo "   Jobs analyzed:"

        echo "9. Get salary report..."
        curl -s "$BASE_URL/reports/salary-by-department" | jq -r '.report | length' | xargs echo "   Report rows:"

        echo "10. Get turnover report..."
        curl -s "$BASE_URL/reports/employee-turnover" | jq -r '.report | length' | xargs echo "   Report rows:"

        echo "11. Get location report..."
        curl -s "$BASE_URL/reports/location-wise" | jq -r '.report | length' | xargs echo "   Report rows:"

        print_info "Regular API tests completed"
    fi
}

# Run blocking scenarios
function run_blocking_scenarios() {
    local iteration=$1

    print_info "Running blocking scenarios (iteration $iteration)..."

    if [ "$QUIET_MODE" = true ]; then
        # Quiet mode - run blocking tests silently
        curl -s "$BASE_URL/blocking/locks" > /dev/null
        curl -s "$BASE_URL/blocking/blocking-sessions" > /dev/null
        curl -s -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=3" > /dev/null &
        sleep 1
        curl -s -X PUT "$BASE_URL/blocking/update-salary/101?newSalary=15000" > /dev/null
        sleep 3
        curl -s -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=3" > /dev/null
        sleep 4
        curl -s -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=1&delaySeconds=2" > /dev/null
        sleep 3
        curl -s -X POST "$BASE_URL/blocking/create-deadlock?employeeId1=100&employeeId2=101" > /dev/null 2>&1
        print_info "Blocking scenarios completed"
    else
        # Verbose mode
        echo ""
        echo "12. Check current locks..."
        curl -s "$BASE_URL/blocking/locks" | jq -r 'if .locks then (.locks | length) else 0 end' | xargs echo "   Current locks:"

        echo "13. Check blocking sessions..."
        curl -s "$BASE_URL/blocking/blocking-sessions" | jq -r 'if .blocking_sessions then (.blocking_sessions | length) else 0 end' | xargs echo "   Blocking sessions:"

        echo "14. Lock employee 100 (3 seconds) in background..."
        curl -s -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=3" > /dev/null &
        LOCK_PID=$!
        echo "   Lock initiated (PID: $LOCK_PID)"

        sleep 1

        echo "15. Update employee 101 salary (may block briefly)..."
        START=$(date +%s)
        curl -s -X PUT "$BASE_URL/blocking/update-salary/101?newSalary=15000" | jq -r '.message' | xargs echo "   Result:"
        END=$(date +%s)
        DURATION=$((END - START))
        echo "   Duration: ${DURATION}s"

        wait $LOCK_PID 2>/dev/null

        sleep 1

        echo "16. Lock department 50 employees (3 seconds)..."
        curl -s -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=3" | jq -r '.locked_employees' | xargs echo "   Locked employees:"

        sleep 4

        echo "17. Batch salary increase for dept 60..."
        curl -s -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=1&delaySeconds=2" | jq -r '.employees_updated' | xargs echo "   Updated employees:"

        sleep 3

        echo "18. Create deadlock scenario..."
        curl -s -X POST "$BASE_URL/blocking/create-deadlock?employeeId1=100&employeeId2=101" 2>&1 | jq -r 'if .message then .message else "Completed with expected error" end' | xargs echo "   Result:"

        print_info "Blocking scenarios completed"
    fi
}

# Statistics tracking
TOTAL_ITERATIONS=0
START_TIME=$(date +%s)

# Trap Ctrl+C to show statistics before exiting
trap 'echo ""; print_warning "Simulation interrupted by user"; show_statistics; exit 0' INT

function show_statistics() {
    local end_time=$(date +%s)
    local duration=$((end_time - START_TIME))
    local minutes=$((duration / 60))
    local seconds=$((duration % 60))

    print_header "Simulation Statistics"
    echo "Total iterations completed: $TOTAL_ITERATIONS"
    echo "Total duration: ${minutes}m ${seconds}s"
    if [ $TOTAL_ITERATIONS -gt 0 ]; then
        local avg_time=$((duration / TOTAL_ITERATIONS))
        echo "Average time per iteration: ${avg_time}s"
    fi
    echo ""
}

# Main simulation loop
print_header "Oracle Java Application - Continuous Load Simulation"
echo "Configuration:"
echo "  Iterations: $([ $ITERATIONS -eq 0 ] && echo "Infinite" || echo $ITERATIONS)"
echo "  Delay between cycles: ${DELAY_BETWEEN_CYCLES}s"
echo "  Skip blocking: $SKIP_BLOCKING"
echo "  Quiet mode: $QUIET_MODE"
echo "  Base URL: $BASE_URL"
echo ""
print_info "Press Ctrl+C to stop the simulation"
echo ""

# Check application health before starting
print_info "Checking application health..."
check_app_health
print_info "Application is running!"
echo ""

sleep 2

# Main loop
COUNTER=1
while true; do
    # Check if we've reached the iteration limit
    if [ $ITERATIONS -ne 0 ] && [ $COUNTER -gt $ITERATIONS ]; then
        print_info "Reached iteration limit ($ITERATIONS)"
        break
    fi

    print_header "Iteration $COUNTER / $([ $ITERATIONS -eq 0 ] && echo "∞" || echo $ITERATIONS)"

    # Run regular API tests
    run_api_tests $COUNTER

    # Run blocking scenarios (unless skipped)
    if [ "$SKIP_BLOCKING" = false ]; then
        run_blocking_scenarios $COUNTER
    fi

    TOTAL_ITERATIONS=$COUNTER

    # Wait before next iteration
    if [ $ITERATIONS -eq 0 ] || [ $COUNTER -lt $ITERATIONS ]; then
        if [ "$QUIET_MODE" = false ]; then
            print_info "Waiting ${DELAY_BETWEEN_CYCLES}s before next iteration..."
            echo ""
        fi
        sleep $DELAY_BETWEEN_CYCLES
    fi

    COUNTER=$((COUNTER + 1))
done

show_statistics
print_info "Simulation completed successfully!"
