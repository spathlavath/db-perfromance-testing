#!/bin/bash
# Test Blocking Scenarios for Oracle Java Application
# This script demonstrates database blocking and locking scenarios

BASE_URL="http://localhost:3001"

echo "=========================================="
echo "Database Blocking Scenarios Test Suite"
echo "=========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_step() {
    echo -e "${GREEN}==>${NC} $1"
}

function print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

function print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_warning "jq is not installed. Output will not be formatted."
    JQ_CMD="cat"
else
    JQ_CMD="jq ."
fi

echo "Select a blocking scenario to test:"
echo ""
echo "1. Simple Row Lock (lock employee 100 for 30 seconds)"
echo "2. Department Lock (lock all employees in dept 50 for 30 seconds)"
echo "3. Concurrent Update Test (lock employee, then try to update)"
echo "4. Deadlock Scenario (create intentional deadlock)"
echo "5. Long-Running Batch Update (salary increase with delay)"
echo "6. View Current Locks"
echo "7. View Blocking Sessions"
echo "8. Run All Scenarios (Demo Mode)"
echo "9. Exit"
echo ""
read -p "Enter choice [1-9]: " choice

case $choice in
    1)
        print_step "Locking employee 100 for 30 seconds..."
        curl -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=30" | $JQ_CMD
        echo ""
        print_step "Employee 100 is locked for 30 seconds."
        print_warning "Try updating the same employee in another terminal:"
        echo "  curl -X PUT \"$BASE_URL/blocking/update-salary/100?newSalary=15000\""
        ;;

    2)
        print_step "Locking all employees in department 50 for 30 seconds..."
        curl -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=30" | $JQ_CMD
        echo ""
        print_step "All employees in department 50 are locked."
        print_warning "Try updating any employee in dept 50 to see blocking."
        ;;

    3)
        print_step "Starting concurrent update test..."
        print_step "Step 1: Locking employee 100 for 20 seconds in background..."
        curl -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=20" > /tmp/lock_result.json 2>&1 &
        LOCK_PID=$!

        sleep 2

        print_step "Step 2: Attempting to update employee 100 (this will block)..."
        echo ""
        print_warning "This will wait until the lock is released..."
        START_TIME=$(date +%s)
        curl -X PUT "$BASE_URL/blocking/update-salary/100?newSalary=16000" | $JQ_CMD
        END_TIME=$(date +%s)
        WAIT_TIME=$((END_TIME - START_TIME))
        echo ""
        print_step "Update completed after waiting ${WAIT_TIME} seconds."

        wait $LOCK_PID
        cat /tmp/lock_result.json | $JQ_CMD
        rm /tmp/lock_result.json
        ;;

    4)
        print_step "Creating deadlock between employees 100 and 101..."
        echo ""
        print_warning "One transaction will be rolled back by Oracle."
        echo ""
        curl -X POST "$BASE_URL/blocking/create-deadlock?employeeId1=100&employeeId2=101" | $JQ_CMD
        echo ""
        print_step "Check application logs for deadlock details:"
        echo "  docker-compose logs oracle-test-app | grep -i deadlock"
        ;;

    5)
        print_step "Starting batch salary increase for department 60..."
        echo ""
        print_warning "This will increase salaries by 5% with a 10-second delay."
        print_warning "During this time, updates to dept 60 employees will block."
        echo ""

        curl -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=5&delaySeconds=10" > /tmp/batch_result.json 2>&1 &
        BATCH_PID=$!

        sleep 2

        print_step "Batch update is running. You can try this in another terminal:"
        echo "  curl -X PUT \"$BASE_URL/blocking/update-salary/103?newSalary=20000\""
        echo ""
        print_step "Waiting for batch update to complete..."

        wait $BATCH_PID
        cat /tmp/batch_result.json | $JQ_CMD
        rm /tmp/batch_result.json
        ;;

    6)
        print_step "Querying current locks in the database..."
        echo ""
        curl -s "$BASE_URL/blocking/locks" | $JQ_CMD
        ;;

    7)
        print_step "Querying blocking sessions..."
        echo ""
        curl -s "$BASE_URL/blocking/blocking-sessions" | $JQ_CMD
        echo ""
        if [ $? -eq 0 ]; then
            print_step "No blocking sessions found or query succeeded."
        fi
        ;;

    8)
        print_step "Running all scenarios in demo mode..."
        echo ""

        print_step "[1/7] Viewing current locks..."
        curl -s "$BASE_URL/blocking/locks" | $JQ_CMD | head -20
        echo ""
        sleep 2

        print_step "[2/7] Viewing blocking sessions..."
        curl -s "$BASE_URL/blocking/blocking-sessions" | $JQ_CMD
        echo ""
        sleep 2

        print_step "[3/7] Testing simple row lock (5 seconds)..."
        curl -X POST "$BASE_URL/blocking/lock-employee/100?durationSeconds=5" | $JQ_CMD
        echo ""
        sleep 6

        print_step "[4/7] Testing department lock (5 seconds)..."
        curl -X POST "$BASE_URL/blocking/lock-department-employees/50?durationSeconds=5" | $JQ_CMD
        echo ""
        sleep 6

        print_step "[5/7] Testing update after lock released..."
        curl -X PUT "$BASE_URL/blocking/update-salary/100?newSalary=14500" | $JQ_CMD
        echo ""
        sleep 2

        print_step "[6/7] Testing batch salary increase (3 seconds delay)..."
        curl -X POST "$BASE_URL/blocking/batch-salary-increase/60?increasePercent=2&delaySeconds=3" | $JQ_CMD
        echo ""
        sleep 4

        print_step "[7/7] Testing deadlock scenario..."
        curl -X POST "$BASE_URL/blocking/create-deadlock?employeeId1=100&employeeId2=101" | $JQ_CMD
        echo ""

        print_step "Demo mode completed!"
        echo ""
        print_step "Check application logs for detailed blocking information:"
        echo "  docker-compose logs oracle-test-app | grep -E 'Locking|locked|Deadlock|BlockingService'"
        ;;

    9)
        print_step "Exiting..."
        exit 0
        ;;

    *)
        print_error "Invalid choice. Please run the script again."
        exit 1
        ;;
esac

echo ""
echo "=========================================="
echo "Additional Commands for Monitoring:"
echo "=========================================="
echo ""
echo "1. View application logs:"
echo "   docker-compose logs -f oracle-test-app"
echo ""
echo "2. Check for blocking in logs:"
echo "   docker-compose logs oracle-test-app | grep -i 'lock\\|block\\|deadlock'"
echo ""
echo "3. Query Oracle for locks (from database):"
echo "   SELECT * FROM v\$lock WHERE type IN ('TM', 'TX');"
echo ""
echo "4. Query New Relic for blocking metrics:"
echo "   SELECT * FROM Metric WHERE metricName LIKE 'newrelicoracledb%'"
echo "   FACET client_name, normalised_sql_hash LIMIT MAX"
echo ""
echo "5. View SQL with comments in Oracle:"
echo "   SELECT sql_fulltext FROM v\$sql"
echo "   WHERE sql_fulltext LIKE '%nr_service%'"
echo "   ORDER BY last_active_time DESC FETCH FIRST 10 ROWS ONLY;"
echo ""
