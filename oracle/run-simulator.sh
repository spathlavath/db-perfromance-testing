#!/bin/bash
# HR Workload Simulator - Quick Start Script
# This script simplifies running the HR workload simulator

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Binary name
BINARY="hr-workload-simulator"

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Go installation
    if ! command -v go &> /dev/null; then
        print_error "Go is not installed. Please install Go 1.21 or later."
        exit 1
    fi
    print_success "Go $(go version | awk '{print $3}') is installed"
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from example..."
        if [ -f .env.example ]; then
            cp .env.example .env
            print_info "Please edit .env file with your credentials"
            exit 1
        else
            print_error "No .env or .env.example file found"
            exit 1
        fi
    fi
    
    # Load environment variables
    export $(cat .env | grep -v '^#' | xargs)
    
    # Check required environment variables
    if [ -z "$ORACLE_PASSWORD" ] || [ -z "$ORACLE_CONNECT_STRING" ]; then
        print_error "ORACLE_PASSWORD and ORACLE_CONNECT_STRING must be set in .env"
        exit 1
    fi
    print_success "Environment variables loaded"
}

# Function to build the simulator
build_simulator() {
    print_info "Building HR Workload Simulator..."
    
    # Initialize go module if needed
    if [ ! -f go.mod ]; then
        print_info "Initializing Go module..."
        go mod init github.com/spathlavath/db-perfromance-testing/oracle || true
    fi
    
    # Get dependencies
    print_info "Getting dependencies..."
    go get github.com/godror/godror@latest
    
    # Build binary
    print_info "Compiling..."
    go build -o "$BINARY" hr-workload-simulator.go
    chmod +x "$BINARY"
    
    print_success "Build completed: $BINARY"
}

# Function to test database connection
test_connection() {
    print_info "Testing database connection..."
    
    if command -v sqlplus &> /dev/null; then
        echo "SELECT 'Connection successful' FROM DUAL;" | \
            sqlplus -S "${ORACLE_USER:-hr}/${ORACLE_PASSWORD}@${ORACLE_CONNECT_STRING}" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            print_success "Database connection successful"
            return 0
        else
            print_warning "Could not verify connection with sqlplus (continuing anyway)"
            return 0
        fi
    else
        print_warning "sqlplus not found, skipping connection test"
        return 0
    fi
}

# Function to show usage
show_usage() {
    cat << EOF

${GREEN}HR Workload Simulator - Quick Start${NC}

${YELLOW}Usage:${NC}
  $0 [command] [options]

${YELLOW}Commands:${NC}
  build              Build the simulator
  test               Test database connection
  run                Run with default settings (5 minutes)
  light              Run with light load (5 min, 1 worker each)
  medium             Run with medium load (15 min, 2-3 workers)
  heavy              Run with heavy load (30 min, 4-5 workers)
  cpu                Run CPU-intensive workload (complex queries only)
  locks              Run lock-focused workload (SQL Server equivalency test)
  comprehensive      Run all 11 worker types (20 min, complete coverage)
  metrics            Run with scheduled metrics burst enabled (recommended)
  custom             Run with custom parameters
  help               Show this help message

${YELLOW}Examples:${NC}
  $0 build           # Build the simulator
  $0 run             # Quick 5-minute test
  $0 light           # Light load for 5 minutes (all 11 worker types)
  $0 medium          # Medium load for 15 minutes
  $0 heavy           # Heavy stress test for 30 minutes
  $0 cpu             # CPU-intensive queries with complex joins and analytics
  $0 locks           # SQL Server lock equivalency test (KEY, OBJECT, PAGE)
  $0 comprehensive   # Complete Oracle wait event coverage
  $0 metrics         # Run with scheduled metrics burst (12 additional scenarios)

  # Custom run with specific workers
  $0 custom -duration 10m -slow-workers 3 -block-workers 4 -commit-workers 2 -enable-metrics

${YELLOW}Environment Variables (set in .env):${NC}
  ORACLE_USER              Oracle username (default: hr)
  ORACLE_PASSWORD          Oracle password (required)
  ORACLE_CONNECT_STRING    Connection string (required)

${YELLOW}Configuration Files:${NC}
  .env                     Database credentials
  hr-workload-simulator.go Source code
  $BINARY                  Compiled binary

EOF
}

# Main script logic
case "${1:-}" in
    build)
        check_prerequisites
        build_simulator
        print_success "Ready to run! Try: $0 run"
        ;;
    
    test)
        check_prerequisites
        test_connection
        ;;
    
    run)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection
        
        print_info "Starting simulator with default settings (5 minutes)..."
        print_info "Press Ctrl+C to stop\n"
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 5m
        ;;
    
    light)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection
        
        print_info "Starting simulator with LIGHT load (5 minutes)..."
        print_info "Workers: 1 of each type (11 worker types)"
        print_info "Note: Use './run-simulator.sh metrics' for scheduled metrics burst"
        print_info "Press Ctrl+C to stop\n"
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 5m \
            -slow-workers 1 \
            -block-workers 1 \
            -io-workers 1 \
            -child-workers 1 \
            -concurrency-workers 1 \
            -table-lock-workers 1 \
            -commit-workers 1 \
            -buffer-busy-workers 1 \
            -sequence-workers 1 \
            -index-workers 1 \
            -temp-workers 1
        ;;
    
    medium)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection
        
        print_info "Starting simulator with MEDIUM load (15 minutes)..."
        print_info "Workers: 2-3 of each type (11 worker types)"
        print_info "Press Ctrl+C to stop\n"
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 15m \
            -slow-workers 2 \
            -block-workers 3 \
            -io-workers 2 \
            -child-workers 2 \
            -concurrency-workers 2 \
            -table-lock-workers 2 \
            -commit-workers 3 \
            -buffer-busy-workers 2 \
            -sequence-workers 2 \
            -index-workers 2 \
            -temp-workers 1
        ;;
    
    heavy)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection
        
        print_warning "Starting simulator with HEAVY load (30 minutes)..."
        print_warning "This will create significant database load!"
        print_info "Workers: 4-5 of each type (11 worker types)"
        print_info "Press Ctrl+C to stop\n"
        
        read -p "Continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cancelled"
            exit 0
        fi
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 30m \
            -slow-workers 4 \
            -block-workers 5 \
            -io-workers 4 \
            -child-workers 3 \
            -concurrency-workers 4 \
            -table-lock-workers 3 \
            -commit-workers 5 \
            -buffer-busy-workers 4 \
            -sequence-workers 3 \
            -index-workers 3 \
            -temp-workers 2
        ;;

    cpu)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection

        print_info "Starting simulator with CPU-INTENSIVE workload (10 minutes)..."
        print_info "Focus: Complex queries with extreme CPU consumption"
        print_info "Query Characteristics:"
        print_info "  • 6-table joins (EMPLOYEES, DEPARTMENTS, JOBS, LOCATIONS, COUNTRIES, REGIONS, JOB_HISTORY)"
        print_info "  • 10+ window functions (RANK, DENSE_RANK, NTILE, LAG, LEAD, AVG, MAX, MIN)"
        print_info "  • Multiple subqueries with correlated expressions"
        print_info "  • Complex CASE statements with nested aggregations"
        print_info "  • Moving averages over partitioned windows"
        print_info "  • Full table scans with hash joins"
        print_info "  • GROUP BY with HAVING clauses"
        print_info "  • Multiple ORDER BY with complex expressions"
        print_info ""
        print_info "This generates:"
        print_info "  ✓ High CPU utilization (70-90%)"
        print_info "  ✓ Parse time intensive operations"
        print_info "  ✓ PGA memory pressure from sorting/hashing"
        print_info "  ✓ Temp tablespace usage for intermediate results"
        print_info "  ✓ Long-running queries in v\$sql"
        print_info "Press Ctrl+C to stop\n"

        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 10m \
            -slow-workers 5 \
            -block-workers 0 \
            -io-workers 0 \
            -child-workers 0 \
            -concurrency-workers 0 \
            -table-lock-workers 0 \
            -commit-workers 0 \
            -buffer-busy-workers 0 \
            -sequence-workers 0 \
            -index-workers 0 \
            -temp-workers 0
        ;;

    locks)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection

        print_info "Starting simulator with LOCK-FOCUSED workload (10 minutes)..."
        print_info "SQL Server Lock Type Equivalency Test"
        print_info "  • Row Locks (KEY)     → enq: TX row locks"
        print_info "  • Table Locks (OBJECT) → enq: TM table locks"
        print_info "  • Block Locks (PAGE)   → buffer busy waits"
        print_info "  • Range Locks (KEY)    → enq: TX index locks"
        print_info "Press Ctrl+C to stop\n"
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 10m \
            -slow-workers 0 \
            -block-workers 3 \
            -io-workers 0 \
            -child-workers 0 \
            -concurrency-workers 0 \
            -table-lock-workers 2 \
            -commit-workers 0 \
            -buffer-busy-workers 2 \
            -sequence-workers 0 \
            -index-workers 2 \
            -temp-workers 0
        ;;
    
    comprehensive)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection

        print_info "Starting simulator with COMPREHENSIVE workload (20 minutes)..."
        print_info "All 11 worker types generating all Oracle wait event classes"
        print_info "  • Application waits (enq: TM, SQ)"
        print_info "  • Concurrency waits (enq: TX, latch, buffer busy)"
        print_info "  • Commit waits (log file sync)"
        print_info "  • User I/O waits (db file, temp)"
        print_info "  • CPU intensive queries"
        print_info "Press Ctrl+C to stop\n"

        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 20m \
            -slow-workers 2 \
            -block-workers 3 \
            -io-workers 2 \
            -child-workers 2 \
            -concurrency-workers 2 \
            -table-lock-workers 2 \
            -commit-workers 3 \
            -buffer-busy-workers 2 \
            -sequence-workers 2 \
            -index-workers 2 \
            -temp-workers 1
        ;;

    metrics)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection

        print_info "Starting simulator with SCHEDULED METRICS enabled (15 minutes)..."
        print_info "Comprehensive metrics burst every 5 seconds includes:"
        print_info "  • Tablespace pressure (1000 inserts)"
        print_info "  • Undo segment contention (large update + rollback)"
        print_info "  • Library cache contention (50 identical SQLs)"
        print_info "  • Row cache (dictionary) contention"
        print_info "  • Checkpoint activity (heavy DML)"
        print_info "  • Archive log activity (heavy redo generation)"
        print_info "  • Parse activity (100 hard parses)"
        print_info "  • SQL*Net activity (1000 round-trips)"
        print_info "  • Control file waits (v$ view access)"
        print_info "  • Library cache pin waits (procedure compilation)"
        print_info "  • Row cache lock waits (metadata queries)"
        print_info "  • DB file sync waits (5000 inserts)"
        print_info ""
        print_info "Plus all 11 standard worker types running concurrently"
        print_info "Press Ctrl+C to stop\n"

        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            -duration 15m \
            -slow-workers 2 \
            -block-workers 3 \
            -io-workers 2 \
            -child-workers 2 \
            -concurrency-workers 2 \
            -table-lock-workers 2 \
            -commit-workers 3 \
            -buffer-busy-workers 2 \
            -sequence-workers 2 \
            -index-workers 2 \
            -temp-workers 1 \
            -enable-metrics \
            -metrics-interval 5s
        ;;

    custom)
        check_prerequisites
        if [ ! -f "$BINARY" ]; then
            build_simulator
        fi
        test_connection
        
        shift # Remove 'custom' from arguments
        
        print_info "Starting simulator with CUSTOM settings..."
        print_info "Parameters: $@"
        print_info "Press Ctrl+C to stop\n"
        
        ./"$BINARY" \
            -user "${ORACLE_USER:-hr}" \
            -password "$ORACLE_PASSWORD" \
            -connect "$ORACLE_CONNECT_STRING" \
            "$@"
        ;;
    
    help|--help|-h)
        show_usage
        ;;
    
    *)
        print_error "Unknown command: ${1:-}"
        show_usage
        exit 1
        ;;
esac
