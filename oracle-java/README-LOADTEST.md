# Oracle Load Test - Parallel Scenarios

Simple load testing tool for Oracle database with 3 concurrent scenarios.

## Quick Start

### On Oracle Linux Server

```bash
# Clone repo
git clone https://github.com/spathlavath/db-perfromance-testing.git
cd db-perfromance-testing
git checkout test-qpm-v1
cd oracle-java

# Test manually first
./run-parallel.sh

# Install as systemd service
sudo cp oracle-loadtest.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start oracle-loadtest
sudo systemctl status oracle-loadtest

# View logs
sudo journalctl -u oracle-loadtest -f

# Enable on boot
sudo systemctl enable oracle-loadtest
```

## Test Scenarios

### Scenario 1: Read-Only Queries (`scenario-read-only.sh`)
- Fast SELECT queries
- No locks or blocking
- Simulates normal application reads

**APIs:**
- GET /employees/{id}
- GET /departments/{id}/employees
- GET /jobs

### Scenario 2: Slow Queries (`scenario-slow-queries.sh`)
- Complex JOINs and aggregations
- Heavy reporting queries
- Potential slow query candidates

**APIs:**
- GET /employees (with JOINs)
- GET /employees/{id}/history
- GET /departments/metrics
- GET /jobs/compensation-analysis
- GET /reports/salary-by-department
- GET /reports/employee-turnover
- GET /reports/location-wise

### Scenario 3: Blocking & Wait Events (`scenario-blocking.sh`)
- Row-level locks
- Table locks
- Blocking sessions
- Wait events

**APIs:**
- POST /blocking/lock-employee/{id}
- POST /blocking/lock-department-employees/{deptId}
- POST /blocking/batch-salary-increase/{deptId}
- GET /blocking/locks
- GET /blocking/blocking-sessions

## Configuration

Edit environment variables in service file or export before running:

```bash
export BASE_URL="http://localhost:3001"
export INTERVAL=60  # Seconds between iterations
./run-parallel.sh
```

## Monitoring

```bash
# View real-time logs
sudo journalctl -u oracle-loadtest -f

# Check worker processes
ps aux | grep scenario

# Stop service
sudo systemctl stop oracle-loadtest
```

## File Structure

```
oracle-java/
├── scenario-read-only.sh       # Fast read queries
├── scenario-slow-queries.sh    # Slow aggregation queries
├── scenario-blocking.sh        # Blocking/locking scenarios
├── run-parallel.sh             # Parallel runner (3 workers)
├── oracle-loadtest.service     # Systemd service file
├── test-api.sh                 # Original manual test
└── test-blocking.sh            # Original interactive blocking test
```
