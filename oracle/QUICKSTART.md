# Quick Start Guide - K6 Load Testing

## 🚀 Run Tests Using .env Configuration

The easiest way to run tests is by setting `TEST_INTENSITY` in your `.env` file.

### Step 1: Create your .env file

```bash
cp .env.example .env
```

### Step 2: Edit .env and set TEST_INTENSITY

```bash
# Edit .env file
nano .env
```

Set the intensity level:
```env
# Choose one: low, medium, high, stress, max
TEST_INTENSITY=medium
```

### Step 3: Start the application and run test

```bash
# Start everything (app + k6 test)
docker-compose up

# Or run k6 test separately after app is up
docker-compose up -d oracle-test-app
docker-compose up k6
```

## 📊 Test Intensity Options

Set `TEST_INTENSITY` in your `.env` file to one of these values:

### `low` - Baseline Performance
```env
TEST_INTENSITY=low
```
- **VUs:** 20 concurrent users
- **Think Time:** 3-5 seconds
- **Duration:** 30 minutes
- **Use Case:** Baseline performance testing
- **Expected Load:** ~5-10 requests/second

### `medium` - Normal Load (Default)
```env
TEST_INTENSITY=medium
```
- **VUs:** 50 concurrent users
- **Think Time:** 1-3 seconds
- **Duration:** 30 minutes
- **Use Case:** Normal business hours traffic
- **Expected Load:** ~20-30 requests/second

### `high` - Peak Load
```env
TEST_INTENSITY=high
```
- **VUs:** 120 concurrent users
- **Think Time:** 0.5-2 seconds
- **Duration:** 30 minutes
- **Use Case:** Peak usage, heavy traffic
- **Expected Load:** ~60-80 requests/second

### `stress` - Find Breaking Point
```env
TEST_INTENSITY=stress
```
- **VUs:** Gradually increases 50 → 400
- **Think Time:** 0.1-0.5 seconds
- **Duration:** ~32 minutes
- **Use Case:** Find maximum capacity
- **Expected Load:** Increases to 200+ requests/second

### `max` - Crash Test
```env
TEST_INTENSITY=max
```
- **VUs:** Rapidly increases 100 → 500
- **Think Time:** NONE (continuous requests)
- **Duration:** ~13 minutes
- **Use Case:** Intentionally overwhelm system
- **Expected Load:** 500+ requests/second
- ⚠️ **WARNING:** Will crash/overwhelm the application!

## 🎯 Common Workflows

### Test Normal Load
```bash
# In .env
TEST_INTENSITY=medium

# Run
docker-compose up
```

### Find Maximum Capacity
```bash
# In .env
TEST_INTENSITY=stress

# Run
docker-compose up
```

### Test All Intensities (One at a Time)
```bash
# Test 1: LOW
TEST_INTENSITY=low docker-compose up k6

# Wait 5 minutes for cooldown
sleep 300

# Test 2: MEDIUM
TEST_INTENSITY=medium docker-compose up k6

# Wait 5 minutes
sleep 300

# Test 3: HIGH
TEST_INTENSITY=high docker-compose up k6

# Wait 5 minutes
sleep 300

# Test 4: STRESS
TEST_INTENSITY=stress docker-compose up k6
```

## 🎨 Alternative: Using the Interactive Script

If you prefer a menu interface:

```bash
./run-k6-tests.sh
```

This gives you an interactive menu to select test intensity.

## 📈 Monitoring Results

### Watch Application Logs
```bash
docker-compose logs -f oracle-test-app
```

### View K6 Output
K6 will display real-time metrics including:
- Request rate (requests/second)
- Response times (p95, p99)
- Error rate
- Virtual users

### Example Output
```
     ✓ employee list status 200
     ✓ http_req_duration.......: avg=245ms  p(95)=450ms
     ✓ http_reqs...............: 15234 (50.78/s)
     ✗ http_req_failed.........: 2.3%
       vus......................: 30/30
```

## 🔧 Quick Troubleshooting

### Application won't start
```bash
# Check if SYSTEM account is locked
# See main README for unlock instructions
```

### Need more aggressive testing
```bash
# Edit your test scripts in k6/scripts/
# Increase VUs or reduce think time
```

### Want custom test
```bash
# Use the interactive script
./run-k6-tests.sh
# Select option 7 for custom test
```

## 📁 File Locations

- **Test Scripts:** `k6/scripts/load-test-*.js`
- **Wrapper Script:** `k6/scripts/run-test.sh`
- **Configuration:** `.env` file
- **Docker Config:** `docker-compose.yml`
- **Full Guide:** `K6_LOAD_TESTING_GUIDE.md`

## 🎯 Next Steps

1. Set up your `.env` file
2. Unlock the SYSTEM database account (see main README)
3. Start with `TEST_INTENSITY=low` to verify everything works
4. Progress through medium, high, and stress tests
5. Analyze results to find your maximum capacity

For detailed instructions, metrics interpretation, and troubleshooting, see **K6_LOAD_TESTING_GUIDE.md**.
