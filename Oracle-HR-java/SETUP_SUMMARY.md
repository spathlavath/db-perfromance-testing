# Oracle-HR-java Setup Summary

## What Was Created

A complete copy of the oracle-java application with the following modifications to allow it to run alongside the original application.

## Directory Structure

```
/Users/spathlavath/otel/db-perfromance-testing/
├── oracle-java/              # Original application (port 3001)
└── Oracle-HR-java/           # New V2 application (port 3002)
    ├── src/
    │   └── main/
    │       ├── java/com/oracle/test/
    │       │   ├── OracleHrPortalApplication.java
    │       │   ├── config/DatabaseConfig.java
    │       │   ├── controller/
    │       │   └── service/
    │       └── resources/
    │           ├── application.properties
    │           └── newrelic.yml
    ├── pom.xml
    ├── Dockerfile
    ├── docker-compose.yml
    ├── .env
    ├── test-api.sh
    ├── README_V2.md
    └── SETUP_SUMMARY.md (this file)
```

## Key Configuration Changes

### 1. Maven Configuration (pom.xml)
```xml
<groupId>com.oracle.hr.test</groupId>
<artifactId>oracle-hr-portal-v2</artifactId>
<name>Oracle HR Portal V2</name>
```

### 2. Application Properties
```properties
server.port=3002
logging.level.com.oracle.hr.test=info
```

### 3. Docker Compose
```yaml
services:
  oracle-hr-app:  # Changed from oracle-test-app
    ports:
      - "3002:3002"  # Changed from 3001:3000
    environment:
      - NEW_RELIC_APP_NAME=Oracle-HR-Portal-Java-V2
```

### 4. Database Configuration
```java
// DatabaseConfig.java
config.setPoolName("OracleHRPoolV2");  // Changed from OracleHRPool
```

### 5. Environment Variables (.env)
```bash
NEW_RELIC_APP_NAME=Oracle-HR-Portal-Java-V2
```

## HikariCP Connection Pool Details

Both applications use **HikariCP** for database connection pooling with the following configuration:

### Default Configuration
```java
Pool Name: OracleHRPoolV2
Minimum Idle Connections: 2
Maximum Pool Size: 10
Connection Timeout: 60 seconds
Idle Timeout: 10 minutes (600 seconds)
Max Connection Lifetime: 30 minutes (1800 seconds)
```

### Performance Optimizations
```java
// Prepared Statement Caching
cachePrepStmts: true
prepStmtCacheSize: 250
prepStmtCacheSqlLimit: 2048

// Oracle-Specific Settings
oracle.jdbc.implicitStatementCacheSize: 25
oracle.net.CONNECT_TIMEOUT: 10000 ms
oracle.jdbc.ReadTimeout: 60000 ms
```

### Environment Variable Overrides
The connection pool can be configured via environment variables:
```bash
POOL_MIN=5          # Minimum idle connections (default: 2)
POOL_MAX=20         # Maximum pool size (default: 10)
POOL_TIMEOUT=60     # Connection timeout in seconds (default: 60)
```

### Monitoring Pool Statistics
```bash
# Via API endpoint
curl http://localhost:3002/pool-stats

# Via application logs
docker-compose logs oracle-hr-app | grep -i hikari

# Via New Relic (JMX metrics)
# Pool Name: OracleHRPoolV2
```

## How to Build and Run

### Prerequisites
1. Copy `newrelic.jar` to the project root
   ```bash
   cp /path/to/newrelic.jar /Users/spathlavath/otel/db-perfromance-testing/Oracle-HR-java/
   ```

2. Verify `.env` file has correct database credentials

### Build and Start
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/Oracle-HR-java

# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f oracle-hr-app

# Check health
curl http://localhost:3002/health
```

### Test the Application
```bash
# Run test script
chmod +x test-api.sh
./test-api.sh

# Or test manually
curl http://localhost:3002/employees | jq .
curl http://localhost:3002/departments | jq .
curl http://localhost:3002/pool-stats | jq .
```

## Running Both Applications Simultaneously

### Start Both Applications
```bash
# Terminal 1 - Start oracle-java (port 3001)
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
docker-compose up -d

# Terminal 2 - Start Oracle-HR-java (port 3002)
cd /Users/spathlavath/otel/db-perfromance-testing/Oracle-HR-java
docker-compose up -d
```

### Test Both Applications
```bash
# Test original application
curl http://localhost:3001/health

# Test V2 application
curl http://localhost:3002/health
```

### View in New Relic
Both applications will appear separately in New Relic APM:
- **Oracle-HR-Portal-Java** (original, port 3001)
- **Oracle-HR-Portal-Java-V2** (new, port 3002)

## Connection Pool Comparison

| Feature | oracle-java | Oracle-HR-java |
|---------|-------------|----------------|
| Pool Name | OracleHRPool | OracleHRPoolV2 |
| Service Port | 3000 (→3001) | 3002 (→3002) |
| Min Connections | 2 (configurable) | 2 (configurable) |
| Max Connections | 10 (configurable) | 10 (configurable) |
| Statement Cache | 250 prepared statements | 250 prepared statements |
| Monitoring Endpoint | :3001/pool-stats | :3002/pool-stats |

## Network Configuration

Both applications connect to the same Oracle database and can be configured with:

```bash
# Database Connection String
ORACLE_CONNECT_STRING=host:port/service

# Connection Pool Settings
POOL_MIN=2          # Start with 2 idle connections
POOL_MAX=10         # Allow up to 10 total connections
POOL_TIMEOUT=60     # Wait 60s for connection before timeout
```

### Connection Pool Behavior

1. **Initial State**: 2 idle connections created on startup
2. **Under Load**: Pool grows up to 10 connections as needed
3. **Idle Connections**: Connections idle for >10min are closed
4. **Max Lifetime**: All connections recycled after 30min
5. **Statement Caching**: Each connection caches up to 250 prepared statements

## Verifying the Setup

### 1. Check Both Applications Are Running
```bash
docker ps | grep -E "oracle-test-app|oracle-hr-app"
```

### 2. Test Endpoints
```bash
# Original application
curl http://localhost:3001/health | jq .status

# V2 application
curl http://localhost:3002/health | jq .status
```

### 3. Check Connection Pool Stats
```bash
# Original pool (OracleHRPool)
curl http://localhost:3001/pool-stats | jq .

# V2 pool (OracleHRPoolV2)
curl http://localhost:3002/pool-stats | jq .
```

### 4. Verify New Relic Reporting
```bash
# Check logs for New Relic agent startup
docker-compose logs oracle-hr-app | grep -i "new relic"

# Look for transaction name format
docker-compose logs oracle-hr-app | grep -i "nr_txn"
```

## Stopping the Applications

```bash
# Stop V2 application
cd /Users/spathlavath/otel/db-perfromance-testing/Oracle-HR-java
docker-compose down

# Stop original application
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
docker-compose down
```

## Files That Were Modified

1. **pom.xml** - Maven coordinates and artifact name
2. **application.properties** - Server port and logging package
3. **docker-compose.yml** - Service name, ports, and New Relic app name
4. **Dockerfile** - Health check port
5. **newrelic.yml** - Default application name
6. **.env** - New Relic app name
7. **test-api.sh** - Base URL and service references
8. **DatabaseConfig.java** - Connection pool name

## Unchanged Features

Both applications have **identical functionality**:
- ✅ All REST API endpoints
- ✅ Complex SQL queries with JOINs
- ✅ Prepared statement caching
- ✅ HikariCP connection pooling
- ✅ New Relic APM instrumentation
- ✅ Transaction name extraction with HTTP methods
- ✅ SQL query obfuscation
- ✅ Distributed tracing

## Quick Reference

| Item | oracle-java | Oracle-HR-java |
|------|-------------|----------------|
| Port | 3001 | 3002 |
| Service Name | oracle-test-app | oracle-hr-app |
| Pool Name | OracleHRPool | OracleHRPoolV2 |
| NR App Name | Oracle-HR-Portal-Java | Oracle-HR-Portal-Java-V2 |
| Health Check | localhost:3001/health | localhost:3002/health |
| Pool Stats | localhost:3001/pool-stats | localhost:3002/pool-stats |
| Test Script | ./test-api.sh (port 3001) | ./test-api.sh (port 3002) |

## Next Steps

1. ✅ Copy `newrelic.jar` to project directory
2. ✅ Update `.env` with your database credentials
3. ✅ Build and start the application
4. ✅ Run test script to verify endpoints
5. ✅ Check New Relic dashboard for metrics
6. ✅ Monitor connection pool statistics

## Troubleshooting

### Port Conflict
If port 3002 is already in use:
```bash
# Check what's using the port
lsof -i :3002

# Update port in:
# - application.properties
# - docker-compose.yml
# - Dockerfile
# - test-api.sh
```

### Connection Pool Issues
```bash
# View pool metrics
curl http://localhost:3002/pool-stats

# Check for connection leaks
docker-compose logs oracle-hr-app | grep -i "leak"

# View HikariCP debug logs
# Set LOG_LEVEL=debug in .env
```

### New Relic Not Reporting
```bash
# Verify agent is loaded
docker-compose logs oracle-hr-app | grep "New Relic Agent"

# Check license key
docker-compose exec oracle-hr-app env | grep NEW_RELIC

# Verify network connectivity
docker-compose exec oracle-hr-app curl -I https://staging-collector.newrelic.com
```

## Summary

You now have **two independent Java applications** running with:
- ✅ Different ports (3001 vs 3002)
- ✅ Different New Relic app names
- ✅ Different connection pool names
- ✅ Identical functionality and HikariCP configuration
- ✅ Ability to run simultaneously for load testing or comparison
