# K6 Stress Testing Guide

This directory contains K6 load testing scripts designed to stress test the Oracle database and monitor CPU/memory usage.

## Available Test Scripts

### 1. `load-test.js` - HR Portal Load Test
**Purpose:** Realistic user simulation with gradual load increase

**Configuration:**
- Max Virtual Users: 100
- Duration: ~40 minutes
- Peak Load: 100 concurrent users
- Traffic Pattern: 30% reads, 25% detail views, 15% reports, mixed writes

**Best For:**
- General application testing
- Realistic user behavior simulation
- Application performance baseline

**Run Command:**
```bash
# Using Docker Compose (default test)
docker-compose up k6

# Using K6 directly
k6 run k6/scripts/load-test.js
```

---

### 2. `oracle-metrics.js` - Oracle Metrics Stimulation
**Purpose:** Generate all Oracle database metrics under stress

**Configuration:**
- Max Virtual Users: 100
- Duration: ~27 minutes
- Peak Load: 100 concurrent users
- Operations: 24 different workload types (parse, sort, I/O, locks, etc.)

**Best For:**
- Database metrics validation
- Oracle receiver testing
- Comprehensive database workload

**Metrics Generated:**
- Parse metrics (hard/soft)
- Disk I/O operations
- Sort operations (small/medium/large)
- Redo/Rollback activity
- Cursor operations
- Lock contention
- Wait events
- PDB metrics
- Buffer operations

**Run Command:**
```bash
# Using K6 directly
k6 run k6/scripts/oracle-metrics.js
```

---

### 3. `cpu-memory-stress-test.js` - CPU & Memory Stress Test
**Purpose:** Maximum stress on VM CPU and memory resources

**Configuration:**
- 3 Concurrent Scenarios:
  1. **CPU Stress:** 100 VUs (complex queries, parsing, aggregations)
  2. **Memory Stress:** 60 VUs (large result sets, sorting, temp space)
  3. **Connection Stress:** Up to 50 connections/sec (rapid connect/disconnect)
- Total Duration: ~25 minutes
- Peak Combined Load: 160+ concurrent operations

**Expected Impact:**
- ✓ CPU Usage: 70-90%
- ✓ Memory Usage: 60-80%
- ✓ Connection Pool: Near maximum utilization
- ✓ Query Response Times: 2-5x normal under peak load

**Best For:**
- VM resource monitoring
- CPU and memory stress testing
- Connection pool validation
- Performance degradation analysis

**Run Command:**
```bash
# Using K6 directly
k6 run k6/scripts/cpu-memory-stress-test.js
```

---

## Quick Start

### Prerequisites
```bash
# Ensure Oracle test application is running
docker-compose up -d oracle-test-app

# Wait for application to be healthy
docker-compose ps
```

### Run Tests

```bash
# Install K6 first
brew install k6  # macOS
# or download from https://k6.io/docs/getting-started/installation/

# Run standard load test (default with Docker Compose)
docker-compose up k6

# Or run tests directly with K6 CLI
export BASE_URL=http://localhost:3000

k6 run k6/scripts/load-test.js
k6 run k6/scripts/cpu-memory-stress-test.js
k6 run k6/scripts/oracle-metrics.js
```

---

## Monitoring During Tests

### Application Logs
```bash
# Follow application logs
docker-compose logs -f oracle-test-app
```

### K6 Metrics
K6 displays real-time metrics in the terminal:
- `http_req_duration`: Request response times
- `http_req_failed`: Failed request rate
- `errors`: Error rate
- `cpu_intensive_operations`: CPU stress operations count
- `memory_intensive_operations`: Memory stress operations count
- `query_throughput`: Queries per second

### VM Monitoring
Monitor your VM while tests run:
```bash
# CPU and Memory (macOS/Linux)
top

# Or use htop for better visualization
htop

# Docker stats
docker stats
```

### Database Monitoring
```sql
-- Active sessions
SELECT COUNT(*) FROM v$session WHERE status = 'ACTIVE';

-- CPU usage
SELECT value FROM v$sysmetric WHERE metric_name = 'Host CPU Utilization (%)';

-- Memory usage
SELECT value FROM v$sysmetric WHERE metric_name = 'Physical Memory Total';

-- Connection pool
SELECT * FROM v$resource_limit WHERE resource_name = 'processes';
```

---

## Test Results

Results are stored in `k6/results/` directory:
- Real-time console output
- Metrics summary
- Performance trends

---

## Customization

### Adjust Load Levels
Edit the `stages` array in each script:

```javascript
export const options = {
  scenarios: {
    stress_test: {
      stages: [
        { duration: '2m', target: 20 },   // Lower for less stress
        { duration: '5m', target: 50 },   // Adjust target VUs
        { duration: '3m', target: 0 },    // Cool down
      ],
    },
  },
};
```

### Environment Variables
```bash
# Change base URL
export BASE_URL=http://your-host:3000

# Enable verbose logging
export K6_LOG_LEVEL=DEBUG
export K6_DETAILED_LOGGING=true

# Adjust slow request threshold
export K6_LOG_SLOW_REQUESTS_MS=3000
```

---

## Troubleshooting

### High Error Rates
- Normal under extreme stress (up to 25-30%)
- Check application logs for specific errors
- Verify database connection pool settings
- Ensure Oracle database has adequate resources

### Test Won't Start
```bash
# Check application health
curl http://localhost:3000/health

# Restart application
docker-compose restart oracle-test-app

# Check k6 service logs
docker-compose logs k6
```

### Low CPU/Memory Usage
- Increase VU count in test scripts
- Reduce sleep times between operations
- Run multiple test scripts simultaneously
- Check database query execution plans

---

## Best Practices

1. **Start Small:** Begin with `load-test.js` to establish baseline
2. **Monitor First:** Set up monitoring before running stress tests
3. **Gradual Increase:** Don't jump directly to maximum load
4. **Cool Down:** Allow system to recover between test runs
5. **Document Results:** Record CPU/memory metrics for comparison
6. **Check Errors:** Review error logs after each test
7. **Database Health:** Verify database is healthy before testing

---

## Performance Targets

### Load Test (load-test.js)
- ✓ p95 Response Time: < 5s
- ✓ Error Rate: < 15%
- ✓ CPU Usage: 40-60%
- ✓ Memory Usage: 40-60%

### CPU/Memory Stress (cpu-memory-stress-test.js)
- ✓ p95 Response Time: < 20s
- ✓ Error Rate: < 30%
- ✓ CPU Usage: 70-90%
- ✓ Memory Usage: 60-80%

### Oracle Metrics (oracle-metrics.js)
- ✓ p95 Response Time: < 30s
- ✓ Error Rate: < 40%
- ✓ All metric types generated
- ✓ Sustained high throughput

---

## Support

For issues or questions:
1. Check application health endpoint: `/health`
2. Review application logs: `docker-compose logs oracle-test-app`
3. Verify Oracle database connectivity
4. Check connection pool statistics: `/pool-stats`
