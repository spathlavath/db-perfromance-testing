# K6 Load Testing Guide for Oracle HR Portal

This guide explains how to run different load test intensities and stress tests to find your application's maximum capacity.

## 📋 Available Test Profiles

All test profiles use a single unified `load-test.js` file. The intensity is controlled via the `TEST_INTENSITY` environment variable.

### 1. **LOW Intensity** (`TEST_INTENSITY=low`)

- **Virtual Users (VUs):** 20 concurrent users
- **Think Time:** 3-5 seconds between requests
- **Duration:** 30 minutes
- **Use Case:** Simulates light usage, baseline performance
- **Expected Load:** ~5-10 requests/second

### 2. **MEDIUM Intensity** (`TEST_INTENSITY=medium`)

- **Virtual Users (VUs):** 50 concurrent users
- **Think Time:** 1-3 seconds between requests
- **Duration:** 30 minutes
- **Use Case:** Normal business hours traffic
- **Expected Load:** ~20-30 requests/second

### 3. **HIGH Intensity** (`TEST_INTENSITY=high`)

- **Virtual Users (VUs):** 120 concurrent users
- **Think Time:** 0.5-2 seconds between requests
- **Duration:** 30 minutes
- **Use Case:** Peak business hours, heavy usage
- **Expected Load:** ~60-80 requests/second

### 4. **STRESS Test** (`TEST_INTENSITY=stress`)

- **Virtual Users (VUs):** Gradually increases from 50 to 400
- **Think Time:** 0.1-0.5 seconds between requests
- **Duration:** ~35 minutes
- **Use Case:** Find the breaking point
- **Expected Load:** Increases from ~50 to 200+ requests/second
- **Goal:** Identify maximum capacity before degradation

### 5. **MAXIMUM/CRASH Test** (`TEST_INTENSITY=max`)

- **Virtual Users (VUs):** Rapidly increases from 100 to 500
- **Think Time:** NONE (continuous requests)
- **Duration:** ~13 minutes
- **Use Case:** Intentionally crash/overwhelm the system
- **Expected Load:** 500+ requests/second
- **Goal:** Find absolute limits and failure modes

## 🚀 Quick Start

### Option 1: Using Environment Variables (Recommended)

Edit your `.env` file:

```bash
# Set the desired intensity
TEST_INTENSITY=medium  # Options: low, medium, high, stress, max
```

Then start the tests:

```bash
cd oracle
docker-compose up k6
```

### Option 2: Using the Interactive Script

```bash
cd oracle
./run-k6-tests.sh
```

The script will show you a menu to select which test to run:

```
╔════════════════════════════════════════════════════════════════╗
║         Oracle HR Portal - K6 Load Test Suite                 ║
╚════════════════════════════════════════════════════════════════╝

Select a test to run:

1) LOW Intensity    - 20 VUs max    | 3-5s think time  | 30 min
2) MEDIUM Intensity - 50 VUs max    | 1-3s think time  | 30 min
3) HIGH Intensity   - 120 VUs max   | 0.5-2s think time| 30 min
4) STRESS Test      - 50→400 VUs    | 0.1-0.5s think  | 35 min
5) MAXIMUM/CRASH    - 100→500 VUs   | NO think time   | 13 min
6) Run ALL tests in sequence
7) Custom test (specify VUs and duration)
0) Exit
```

### Option 3: Running Tests Directly with Docker Compose

```bash
cd oracle

# LOW intensity
docker-compose run --rm -e TEST_INTENSITY=low k6 run /scripts/load-test.js

# MEDIUM intensity
docker-compose run --rm -e TEST_INTENSITY=medium k6 run /scripts/load-test.js

# HIGH intensity
docker-compose run --rm -e TEST_INTENSITY=high k6 run /scripts/load-test.js

# STRESS test
docker-compose run --rm -e TEST_INTENSITY=stress k6 run /scripts/load-test.js

# MAXIMUM/CRASH test
docker-compose run --rm -e TEST_INTENSITY=max k6 run /scripts/load-test.js
```

### Option 4: Running Tests with K6 CLI (if installed locally)

```bash
cd oracle/k6/scripts

export BASE_URL="http://localhost:3000"
export TEST_INTENSITY="medium"  # or low, high, stress, max

# Run the unified test
k6 run load-test.js
```

## 📊 Understanding the Results

### Key Metrics to Monitor

1. **http_req_duration**

   - Response time for each request
   - p(95) = 95th percentile (most important)
   - If this increases significantly, system is degrading

2. **http_reqs**

   - Total number of requests
   - Divide by test duration to get requests/second
   - Higher = more queries the system handled

3. **http_req_failed**

   - Percentage of failed requests
   - <5% = Excellent
   - 5-10% = Acceptable
   - > 10% = System under stress
   - > 50% = System failing

4. **VUs (Virtual Users)**
   - Number of concurrent users
   - Track at what VU level errors spike
   - This is your maximum concurrent user capacity

### Example Output Interpretation

```
scenarios: (100.00%) 1 scenario, 100 max VUs, 30m30s max duration

✓ employee list status 200
✗ http_req_duration...: p(95)=2845ms  <-- Response time degrading
✓ http_reqs............ 45234         <-- Total requests
✗ http_req_failed...... 12.5%         <-- 12.5% failure rate - system stressed!

   VUs: 85/100                         <-- At 85 VUs, system degrading
```

**Interpretation:** System can handle ~80 concurrent users before degradation starts.

## 🎯 Finding Maximum Capacity

### Step-by-Step Process

1. **Start with MEDIUM test**

   ```bash
   ./run-k6-tests.sh
   # Select option 2
   ```

   - Establishes baseline performance
   - Should have <5% error rate

2. **Run HIGH test**

   ```bash
   # Select option 3
   ```

   - Tests peak load handling
   - Note when error rate increases

3. **Run STRESS test**

   ```bash
   # Select option 4
   ```

   - Gradually increases load
   - Identifies breaking point
   - **KEY METRIC:** Note the VU level when error rate exceeds 10%

4. **Run MAXIMUM test (optional)**
   ```bash
   # Select option 5
   ```
   - Tests failure modes
   - Verifies system recovery
   - **WARNING:** Will crash/overwhelm the app

### Analyzing Results

After stress test, review the output:

```bash
# Look for the stage where errors started
# Example output:
Stage 1 (10 VUs): 0.2% error rate   ← Healthy
Stage 2 (20 VUs): 0.8% error rate   ← Healthy
Stage 3 (30 VUs): 2.1% error rate   ← Good
Stage 4 (40 VUs): 5.4% error rate   ← Acceptable
Stage 5 (50 VUs): 8.9% error rate   ← Getting stressed
Stage 6 (60 VUs): 15.3% error rate  ← BREAKING POINT!
Stage 7 (80 VUs): 45.2% error rate  ← System failing
```

**Conclusion:** Maximum capacity is ~50-55 concurrent users.

## 🔧 Tuning Based on Results

### If error rate is high even at low VUs:

1. **Increase connection pool size**

   ```env
   POOL_MIN=5
   POOL_MAX=50  # Increase from 10
   ```

2. **Check database performance**

   - Review slow queries in New Relic
   - Add indexes if needed
   - Optimize query patterns

3. **Increase application resources**
   ```yaml
   # docker-compose.yml
   deploy:
     resources:
       limits:
         memory: 4G # Increase from 2G
   ```

### If you want to test higher loads:

Modify the intensity profiles in `load-test.js` to increase VUs:

```javascript
// In load-test.js - Edit the intensityProfiles object
const intensityProfiles = {
  stress: {
    stages: [
      { duration: "2m", target: 50 },
      { duration: "5m", target: 100 },
      { duration: "10m", target: 200 },
      { duration: "10m", target: 300 },
      { duration: "5m", target: 400 },
      { duration: "5m", target: 500 }, // Add more stages for higher load
      { duration: "3m", target: 0 },
    ],
    // ... rest of config
  },
};
```

## 📈 Monitoring During Tests

### View Real-Time Logs

```bash
# In another terminal
docker-compose logs -f oracle-test-app
```

Watch for:

- Database connection errors
- Memory issues
- Connection pool exhaustion
- Application restarts

### Monitor in New Relic

1. Open New Relic APM
2. Navigate to your application
3. Watch during test:
   - Transaction times
   - Database query performance
   - Error rates
   - Throughput (requests/min)

## 🎨 Database Operations Tested

Each test exercises these database operations:

| Operation        | % of Load | Database Operation            |
| ---------------- | --------- | ----------------------------- |
| List Employees   | 30%       | SELECT with JOIN              |
| Employee Details | 25%       | SELECT with multiple JOINs    |
| Departments      | 15%       | SELECT with aggregation       |
| Dept Employees   | 10%       | SELECT with filter            |
| Salary Report    | 5%        | Complex GROUP BY query        |
| Jobs List        | 5%        | Simple SELECT                 |
| Update Employee  | 3%        | UPDATE                        |
| Job History      | 5%        | SELECT with date filter       |
| Create Employee  | 1%        | INSERT                        |
| Promote Employee | 1%        | Transaction (UPDATE + INSERT) |

## 🔍 Troubleshooting

### Test fails to start

```bash
# Ensure app is running
docker-compose up -d oracle-test-app

# Check app health
curl http://localhost:3000/health
```

### Database locked error during test

This is expected if SYSTEM account is locked. See main README for unlocking instructions.

### High memory usage

```bash
# Reduce max VUs or add more memory
# Edit test files or docker-compose.yml
```

### Connection refused errors

```bash
# Increase connection pool settings
# In .env:
POOL_MAX=50
POOL_TIMEOUT=120
```

## 📁 Test Results

Results are saved to `k6/results/` directory:

```
k6/results/
├── LOW_20231231_143022.json
├── MEDIUM_20231231_150000.json
├── HIGH_20231231_153000.json
├── STRESS_20231231_160000.json
└── MAXIMUM_20231231_163000.json
```

You can analyze these JSON files with k6 or import to other tools.

## 🎯 Best Practices

1. **Always start with LOW or MEDIUM** before running stress tests
2. **Monitor application logs** during tests
3. **Run tests during off-hours** to avoid affecting production
4. **Let system recover** between high-intensity tests (5-10 minutes)
5. **Document your findings** - record the max VUs and queries/sec
6. **Compare with New Relic** - cross-reference k6 metrics with APM data
7. **Test after changes** - rerun after tuning to measure improvement

## 📞 Support

For issues or questions about load testing, check:

- K6 documentation: https://k6.io/docs/
- Oracle connection tuning: Oracle docs
- Application logs: `docker-compose logs oracle-test-app`
