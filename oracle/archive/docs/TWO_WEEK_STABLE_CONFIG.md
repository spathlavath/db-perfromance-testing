# 2-Week Continuous Stable Load Configuration

## Overview
Configuration optimized for **continuous 2-week (336 hour)** operation with medium load that won't crash the server.

## Key Changes for Stability

### 1. K6 Load Test Configuration
**Duration**: 336 hours (2 weeks)
**Virtual Users**: 5 (steady, sustainable load)
**Sleep Intervals**: Extended to reduce request rate

```javascript
stages: [
  { duration: '2m', target: 5 },      // Gradual ramp-up
  { duration: '336h', target: 5 },    // 2 weeks continuous
]
```

### 2. Request Pattern (Per Iteration)
- Health check (2s wait)
- Pool stats check (3s wait)
- Start workload (5s wait)
- Pool stats check (8s wait)
- **Total cycle**: ~20 seconds per iteration per user

### 3. Load Characteristics

#### Request Rates (5 users):
- **Total iterations**: ~15 per minute (3 per user)
- **HTTP requests**: ~60 per minute
- **Database operations**: ~40-60 per minute
- **Sustainable for weeks**: ✅

#### Resource Usage (Estimated):
- **CPU**: 5-15% average
- **Memory**: 
  - Application: ~600-800MB stable
  - K6: ~100-150MB
  - Total: <1GB
- **Network**: 2-5 KB/s to New Relic
- **Database Load**: <5% CPU on Oracle 19c

### 4. Application Configuration (.env)

```bash
# Medium intensity for balanced load
TEST_INTENSITY=medium

# Infinite duration (0 = continuous)
TEST_DURATION=0

# Connection pool - stable settings
POOL_MIN=5
POOL_MAX=20
POOL_INCREMENT=2
POOL_TIMEOUT=60
```

### 5. Docker Stability Settings

```yaml
restart: always  # Always restart on failure

healthcheck:
  interval: 60s    # Check every minute (reduced frequency)
  timeout: 15s     # More generous timeout
  retries: 5       # More retries before marking unhealthy
  start_period: 60s # Longer startup grace period

resources:
  limits:
    memory: 2G     # Generous memory limit
  reservations:
    memory: 2G     # Reserved memory

restart_policy:
  condition: on-failure
  delay: 5s
  max_attempts: 0  # Unlimited restart attempts
```

## Monitoring for 2-Week Run

### Check Every Day:

```bash
# 1. Check container health
ssh -A -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.RunningFor}}"

# 2. Check memory usage
docker stats --no-stream

# 3. Check application logs (last hour)
docker-compose logs --since 1h oracle-test-app | tail -100

# 4. Verify workloads are running
curl http://localhost:3000/health
curl http://localhost:3000/pool-stats

# 5. Check for errors
docker-compose logs oracle-test-app 2>&1 | grep -i error | tail -20
```

### Weekly Checks:

```bash
# 1. Disk space
df -h

# 2. Log rotation (logs are limited to 10MB x 3 files)
docker inspect oracle-oracle-test-app-1 | grep -A 5 LogConfig

# 3. Database connections
# Connect to Oracle and check:
# SELECT count(*) FROM v$session WHERE username = 'HR';
```

## Expected Telemetry in New Relic (2 Weeks)

### Transaction Types:
- **DB SELECT**: 50,000+ transactions
- **DB INSERT**: 10,000+ transactions  
- **DB UPDATE**: 8,000+ transactions
- **DB DELETE**: 5,000+ transactions
- **GET /health**: Filtered (reduced noise)
- **POST /workload/start**: 50,000+ transactions
- **GET /pool-stats**: 50,000+ transactions

### Service Map:
Continuous visibility of:
- Application → Oracle Database 19c
- All 5 workload types
- Connection pool metrics

### Distributed Traces:
- Diverse trace samples every minute
- Full visibility into SQL statements
- Transaction timing and errors

## Troubleshooting

### If Container Crashes:

```bash
# Check crash reason
docker logs oracle-oracle-test-app-1 --tail 200

# Check memory issues
docker stats --no-stream

# Reduce load if needed
docker-compose down
# Edit .env: TEST_INTENSITY=low
docker-compose up -d
```

### If Database Connections Pile Up:

```bash
# Check pool stats
curl http://localhost:3000/pool-stats

# Restart application
docker-compose restart oracle-test-app
```

### If K6 Stops:

```bash
# Check K6 logs
docker-compose logs k6 --tail 100

# K6 should run for 336 hours (2 weeks)
# Restart if needed
docker-compose restart k6
```

## Deployment for 2-Week Run

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Copy all updated files
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  .env \
  docker-compose.yml \
  k6/scripts/load-test.js \
  services/oracledb-instrumented.js \
  services/tracing.js \
  services/app.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/

scp -i ~/Downloads/ssh-key-2025-11-03.key \
  k6/scripts/load-test.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/k6/scripts/

# Deploy
ssh -A -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle

# Clean start
docker-compose down
docker volume prune -f  # Clean up any old data
docker-compose up --build -d

# Monitor startup
docker-compose logs -f
```

## Success Criteria

After 2 weeks, you should see:

✅ **Application uptime**: 336 hours (2 weeks)  
✅ **No crashes**: 0 unrecoverable failures  
✅ **Stable memory**: <1GB throughout  
✅ **Continuous data**: No gaps in New Relic telemetry  
✅ **Database health**: Connection pool stable (5-20 connections)  
✅ **Error rate**: <0.1% (per thresholds)  
✅ **P95 latency**: <5 seconds (per thresholds)  

## Load Profile Summary

| Metric | Value | Notes |
|--------|-------|-------|
| Duration | 336 hours | 2 weeks continuous |
| Virtual Users | 5 | Stable, sustainable |
| Iterations/min | ~15 | Low request rate |
| DB Ops/min | ~50 | Medium intensity |
| Memory | <1GB | Stable footprint |
| CPU | <15% | Low utilization |
| Network | <5 KB/s | Minimal bandwidth |
| Restart Policy | Always | Auto-recovery |
| Health Checks | Every 60s | Proactive monitoring |

Perfect for a **2-week demonstration** of New Relic Oracle DB receiver with realistic, sustainable workload! 🚀
