# Oracle Test App Migration Summary

## Overview
Successfully migrated the `oracle-test-app` into the `db-perfromance-testing` repository structure and renamed it to `oracle` to match the pattern of other database testing applications (mysql-app, psql-app, mssql-perf).

## Changes Made

### 1. Directory Restructuring
```
Before:
/Users/spathlavath/otel/oracle-test-app/
├── src/
├── scripts/
├── package.json
├── .env.example
└── README.md

After:
/Users/spathlavath/otel/db-perfromance-testing/oracle/
├── services/          # Contains application code
├── k6/scripts/        # Load testing scripts
├── docker-compose.yml # Docker orchestration
├── cleanup.sh         # Cleanup script
├── start.sh          # Quick start script
├── .env.example      # Environment configuration
└── README.md         # Updated documentation
```

### 2. Docker Integration

**Created `docker-compose.yml`:**
- Containerized Oracle test application
- Integrated K6 load testing
- Health checks
- Resource limits (2GB memory)
- Automatic restart policies
- Network isolation

**Created `services/Dockerfile`:**
- Based on Node.js 20 Alpine
- Includes Oracle client dependencies
- Health check endpoint
- Optimized for production use

### 3. New Relic APM Integration

**Added `services/newrelic.js`:**
- APM configuration
- Distributed tracing enabled
- Database instrumentation
- Custom event tracking
- SQL query obfuscation

**Updated `services/app.js`:**
- Conditional APM loading (only if license key provided)
- Mock newrelic object for development
- Custom event tracking
- Error reporting
- Performance metrics

**Updated `services/package.json`:**
- Added `newrelic@^13.3.1` dependency
- Updated main entry point paths
- Updated script commands

### 4. Load Testing Integration

**Created `k6/scripts/load-test.js`:**
- Automated load testing scenarios
- Custom metrics (error rate, query duration, transaction duration)
- Configurable test stages
- Health check integration
- Workload randomization
- Detailed logging with thresholds
- Slow request detection

**Test Stages:**
1. Ramp-up: 30s to 5 users
2. Steady: 2m at 10 users
3. Peak: 1m at 20 users
4. Scale down: 2m at 10 users
5. Ramp-down: 30s to 0 users

### 5. Environment Configuration

**Updated `.env.example`:**
- Added New Relic APM variables
- Added K6 load testing configuration
- Maintained all Oracle DB settings
- Added logging configuration

**New Variables:**
```env
NEW_RELIC_LICENSE_KEY=your_newrelic_license_key_here
NEW_RELIC_APP_NAME=Oracle-Test-App
K6_LOG_LEVEL=INFO
K6_DETAILED_LOGGING=false
K6_LOG_SLOW_REQUESTS_MS=5000
```

### 6. Helper Scripts

**Created `cleanup.sh`:**
- Stop and remove containers
- Clean up dangling images
- Remove stopped containers
- Optional volume cleanup

**Created `start.sh`:**
- Check for .env file
- Create from template if missing
- Start Docker Compose with build

### 7. Documentation Updates

**Updated `README.md`:**
- Docker-first approach
- Removed VM deployment sections
- Added Docker Compose commands
- Updated project structure
- Added New Relic APM documentation
- Simplified installation steps
- Added K6 load testing information

**Updated parent `db-perfromance-testing/README.md`:**
- Added Oracle to the list of databases
- Included Oracle setup instructions
- Updated feature list

### 8. File Removals

**Removed:**
- `DEPLOYMENT.md` (VM-specific deployment guide, no longer needed with Docker)
- `scripts/` directory (VM deployment scripts, replaced with Docker)
- `src/` directory (moved to `services/`)

## New Features

### 1. Containerization
- Full Docker support
- Docker Compose orchestration
- Multi-service setup (app + k6)
- Health checks
- Resource management

### 2. APM Monitoring
- New Relic APM integration
- Custom event tracking
- Database query monitoring
- Error tracking
- Performance metrics

### 3. Load Testing
- K6 integration
- Automated test scenarios
- Custom metrics
- Configurable test stages
- Detailed logging

### 4. Consistency
- Matches mysql-app, psql-app, mssql-perf patterns
- Standardized directory structure
- Common Docker practices
- Unified configuration approach

## Testing the Application

### Quick Start
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Configure environment
cp .env.example .env
nano .env  # Add your Oracle DB credentials

# Start with Docker
docker-compose up --build

# Or use the helper script
./start.sh
```

### With New Relic APM
```bash
# Add to .env
NEW_RELIC_LICENSE_KEY=your_actual_key_here
NEW_RELIC_APP_NAME=Oracle-Test-App

# Start the application
docker-compose up --build
```

### Load Testing
```bash
# K6 will automatically run when you start with docker-compose
# To run K6 separately:
docker-compose up oracle-test-app  # Start app first
docker-compose up k6               # Then run K6 tests
```

### API Usage
```bash
# Health check
curl http://localhost:3000/health

# Pool statistics
curl http://localhost:3000/pool-stats

# Start workload
curl -X POST http://localhost:3000/workload/start \
  -H "Content-Type: application/json" \
  -d '{"type": "query", "duration": 300, "intensity": "medium"}'
```

## Benefits of the Migration

1. **Standardization**: Now matches the pattern of other DB test apps
2. **Containerization**: Easy deployment and isolation
3. **APM Integration**: Better monitoring and observability
4. **Load Testing**: Automated performance testing with K6
5. **Simplified Setup**: Docker Compose handles all dependencies
6. **Better Documentation**: Clear, Docker-focused instructions
7. **Cleanup Scripts**: Easy maintenance and cleanup
8. **Health Checks**: Built-in container health monitoring
9. **Resource Management**: Memory limits and restart policies
10. **Network Isolation**: Separate Docker network for the stack

## Next Steps

1. Configure `.env` with your Oracle DB credentials
2. Start the application with `docker-compose up --build`
3. Monitor the application in New Relic (if APM is configured)
4. Review K6 test results
5. Adjust workload intensity as needed
6. Monitor Oracle DB receiver metrics

## Files Modified

- `/Users/spathlavath/otel/db-perfromance-testing/README.md` - Updated main README
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/README.md` - Updated Oracle README
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/.env.example` - Added APM & K6 config
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/services/app.js` - Added APM integration
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/services/package.json` - Updated dependencies

## Files Created

- `/Users/spathlavath/otel/db-perfromance-testing/oracle/docker-compose.yml`
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/services/Dockerfile`
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/services/newrelic.js`
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/k6/scripts/load-test.js`
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/cleanup.sh`
- `/Users/spathlavath/otel/db-perfromance-testing/oracle/start.sh`

## Files Removed

- `DEPLOYMENT.md` (VM deployment guide)
- `scripts/` directory (VM deployment scripts)
- `src/` directory (moved to `services/`)
