# Continuous Demo Load Configuration

## Changes Made for Continuous Demo

### 1. `.env` Configuration
```bash
TEST_INTENSITY=low          # Changed from 'medium' to 'low' for lighter continuous load
TEST_DURATION=0             # Changed from 900 to 0 (infinite duration)
```

### 2. K6 Load Test (`k6/scripts/load-test.js`)
**Before** (6 minute test cycle):
```javascript
stages: [
  { duration: '30s', target: 5 },
  { duration: '2m', target: 10 },
  { duration: '1m', target: 20 },
  { duration: '2m', target: 10 },
  { duration: '30s', target: 0 },
]
```

**After** (continuous 24h load):
```javascript
stages: [
  { duration: '30s', target: 3 },    // Ramp-up
  { duration: '24h', target: 3 },    // Continuous 3 users
]
```

### 3. Docker Compose (`docker-compose.yml`)
Changed max restart attempts from 3 to 0 (unlimited) for continuous operation.

## What Runs Continuously

### Application Workloads (Infinite Duration)
All 5 workload types run on a loop with low intensity:

1. **Query Workload** - Every 2-3 seconds:
   - Fast HR queries (employee lookups)
   - Slow complex joins
   - Bind variable queries
   
2. **Transaction Workload** - Every 5 seconds:
   - Short transactions (1-2 DML operations)
   - Occasional long transactions
   - Rollback scenarios
   
3. **Connection Workload** - Every 10 seconds:
   - Burst connections
   - Sustained connections
   - Connection pool cycling

4. **Lock Workload** - Every 8 seconds:
   - Table locks
   - Row locks (SELECT FOR UPDATE)
   - Occasional deadlock attempts

5. **Memory Workload** - Every 15 seconds:
   - PL/SQL operations
   - Sort operations
   - Large result set queries

### K6 Load Testing (Continuous)
- **3 virtual users** making requests continuously
- Health checks every ~10 seconds
- Pool stats checks every ~15 seconds
- Workload start/stop API calls
- Random workload triggering

## Load Characteristics

### Low Intensity Settings:
- **Queries**: 5-10 per minute per workload type
- **Transactions**: 2-5 per minute
- **Connections**: 3-5 operations per minute
- **Total Database Operations**: ~30-50 per minute
- **HTTP Requests** (K6): ~15-20 per minute

### Resource Usage:
- **CPU**: 5-10% average
- **Memory**: ~500MB application + 100MB K6
- **Network**: Minimal (~1-5 KB/s to New Relic)
- **Database**: Negligible load on Oracle 19c

## Deployment

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Copy updated files
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  .env \
  docker-compose.yml \
  k6/scripts/load-test.js \
  services/oracledb-instrumented.js \
  services/tracing.js \
  services/app.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/

# Copy K6 script
scp -i ~/Downloads/ssh-key-2025-11-03.key \
  k6/scripts/load-test.js \
  opc@150.136.71.213:~/db-perfromance-testing/oracle/k6/scripts/

# SSH and restart
ssh -A -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle
docker-compose down
docker-compose up --build -d
```

## Monitoring

### Check Running Status:
```bash
docker ps
# Both containers should show "Up X hours"
```

### Monitor Logs:
```bash
# Application logs
docker-compose logs -f oracle-test-app | grep -E "Starting|Completed"

# K6 logs (minimal output in continuous mode)
docker-compose logs -f k6

# Check workload activity
docker-compose logs --tail=50 oracle-test-app
```

### Verify Continuous Operation:
```bash
# Check uptime
docker ps --format "table {{.Names}}\t{{.Status}}"

# Check if workloads are running
curl http://localhost:3000/health
curl http://localhost:3000/pool-stats
```

## New Relic Visualization

With continuous load, you'll see:

1. **Steady throughput** in APM dashboard
2. **Consistent transaction patterns**:
   - DB SELECT transactions every few seconds
   - Periodic INSERT/UPDATE/DELETE operations
   - Regular PL/SQL executions
3. **Service map** showing continuous Oracle DB connections
4. **Distributed traces** available for sampling
5. **No gaps in metrics** - continuous data flow

## Stopping the Demo

To stop:
```bash
docker-compose down
```

To restart:
```bash
docker-compose up -d
```

## Benefits for Demo

✅ **Always ready**: No need to start workloads manually  
✅ **Realistic data**: Continuous traces and metrics in New Relic  
✅ **Low resource usage**: Won't overload your VM or database  
✅ **Self-healing**: Automatically restarts on errors  
✅ **24/7 operation**: Runs indefinitely for long-term demos  
✅ **Diverse transactions**: All 5 workload types constantly generating data  

Perfect for showcasing New Relic Oracle DB receiver features! 🎉
