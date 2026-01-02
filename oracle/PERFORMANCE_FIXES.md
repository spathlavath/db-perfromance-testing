# Performance Optimization Summary

## Problem

Load tests were timing out at 163 VUs during MEDIUM profile (target: 200 VUs), indicating:

- Connection pool exhaustion (only 50 max connections)
- Insufficient resources for concurrent load
- Queue management issues

## Root Causes

1. **Connection Pool Too Small**: 10-50 connections couldn't handle 163+ concurrent VUs
2. **Unlimited Queue**: Queue had no limit, causing memory pressure
3. **Resource Constraints**: Only 2GB memory allocated
4. **Slow Pool Scaling**: Only 5 connections added at a time

## Applied Fixes

### 1. Connection Pool Optimization

**File**: `services/app.js`

```javascript
poolMin: 50,           // Was: 10 (start with high capacity)
poolMax: 200,          // Was: 50 (support 200+ VUs)
poolIncrement: 10,     // Was: 5 (scale faster)
queueMax: 500,         // Was: -1 unlimited (prevent memory issues)
queueTimeout: 120000,  // Was: 300000 (fail faster at 2min)
poolTimeout: 60        // Was: 120 (release idle faster)
```

### 2. Docker Resource Limits

**File**: `docker-compose.yml`

```yaml
resources:
  limits:
    cpus: "2.0" # Added: 2 CPU cores limit
    memory: 4G # Was: 2G (doubled memory)
  reservations:
    cpus: "1.0" # Added: guaranteed 1 CPU core
    memory: 2G # Guaranteed 2GB baseline
```

### 3. Environment Defaults

**File**: `docker-compose.yml`

```yaml
POOL_MIN: 50 # Was: 2
POOL_MAX: 200 # Was: 10
POOL_INCREMENT: 10 # Was: 1
QUEUE_TIMEOUT: 120000 # Added
```

## Expected Results

### Before Optimization

- **Timeouts at**: ~90-163 VUs
- **Max throughput**: ~1.5 req/sec
- **Avg response**: 27 seconds
- **Connection pool**: 10-50 connections

### After Optimization

- **MEDIUM (200 VUs)**: Should complete without timeouts
- **HIGH (500 VUs)**: Should be achievable
- **STRESS (1000 VUs)**: Will test true system limits
- **MAX (2000 VUs)**: May still timeout (depends on Oracle DB capacity)

## Deployment

### Quick Apply

```bash
cd /Users/pkudikyala/Documents/forked_repos/db-perfromance-testing/oracle
./apply-performance-fixes.sh
```

### Manual Steps

```bash
# 1. Stop current containers
docker-compose down

# 2. Rebuild with new config
docker-compose build oracle-test-app

# 3. Start optimized application
docker-compose up -d oracle-test-app

# 4. Verify health
docker-compose ps oracle-test-app
```

## Validation Tests

### 1. Verify Pool Settings

```bash
docker-compose logs oracle-test-app | grep "pool created"
# Should show: "min: 50, max: 200"
```

### 2. Monitor Resources

```bash
docker stats oracle-oracle-test-app-1
```

### 3. Re-run MEDIUM Test

```bash
sudo -E docker-compose run --rm -e TEST_INTENSITY=medium k6 run /scripts/load-test.js
```

Expected: Significantly fewer timeouts, should handle 200 VUs.

### 4. Try HIGH Test

```bash
sudo -E docker-compose run --rm -e TEST_INTENSITY=high k6 run /scripts/load-test.js
```

Expected: Should reach 500 VUs with acceptable performance.

## Monitoring During Tests

### Application Logs

```bash
docker-compose logs -f oracle-test-app
```

### Resource Usage

```bash
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Connection Pool Stats

Check application logs for pool statistics during load.

## Remaining Limitations

Even with these optimizations, you may still hit limits at:

1. **Oracle Database Capacity**: External Oracle DB has its own connection limits
2. **Network Bandwidth**: Between containers and database
3. **Query Performance**: Slow queries still slow regardless of pool size
4. **CPU/Memory**: System resources are finite

## Next Steps if Issues Persist

### If MEDIUM still times out:

1. Check Oracle DB is healthy: `docker-compose logs | grep oracle`
2. Verify network latency to Oracle DB
3. Check for slow queries in application logs

### If HIGH (500 VUs) times out:

1. This may be the actual system capacity
2. Consider optimizing specific SQL queries
3. Add database indexes if missing
4. Monitor Oracle DB CPU/memory

### If MAX (2000 VUs) times out:

This is expected - 2000 concurrent connections is extremely high. System may legitimately max out around 500-1000 VUs depending on:

- Oracle DB hardware
- Network capacity
- Query complexity
- Think time (currently 0.05-0.2s for MAX profile)

## Files Modified

1. `/oracle/services/app.js` - Connection pool configuration
2. `/oracle/docker-compose.yml` - Environment defaults and resource limits
3. `/oracle/apply-performance-fixes.sh` - Deployment script (new)
4. `/oracle/PERFORMANCE_FIXES.md` - This documentation (new)
