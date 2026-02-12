# Oracle HR Load Test - Parallel Scenarios

Simple load testing tool for Oracle HR application with 2 concurrent scenarios.

## Quick Start

### On Oracle Linux Server

```bash
# Clone repo
cd /home/opc
git clone https://github.com/spathlavath/db-perfromance-testing.git
cd db-perfromance-testing/Oracle-HR-java
git checkout test-qpm-v1

# Test manually first
./run-parallel.sh

# Install as systemd service
sudo ./setup-loadtest.sh
sudo systemctl start oracle-hr-loadtest
sudo systemctl status oracle-hr-loadtest

# View logs
sudo journalctl -u oracle-hr-loadtest -f

# Enable on boot
sudo systemctl enable oracle-hr-loadtest
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

**Note:** Oracle-HR-java does not have blocking scenarios (no BlockingController).

## Configuration

Edit environment variables in service file or export before running:

```bash
export BASE_URL="http://localhost:3002"
export INTERVAL=30  # Seconds between iterations
./run-parallel.sh
```

## Monitoring

```bash
# View real-time logs
sudo journalctl -u oracle-hr-loadtest -f

# Check worker processes
ps aux | grep scenario

# Stop service
sudo systemctl stop oracle-hr-loadtest
```

## Differences from oracle-java

| Feature | oracle-java (port 3001) | Oracle-HR-java (port 3002) |
|---------|------------------------|----------------------------|
| Read-Only Queries | ✅ | ✅ |
| Slow Queries | ✅ | ✅ |
| Blocking Scenarios | ✅ | ❌ |
| Workers | 3 parallel | 2 parallel |
| Service Name | oracle-loadtest | oracle-hr-loadtest |
