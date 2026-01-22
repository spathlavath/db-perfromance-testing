# Oracle HR Portal Java V2

This is a second instance of the Oracle HR Portal Java application with identical functionality but running on a different port and with a different New Relic application name.

## Key Differences from oracle-java

| Property | oracle-java | Oracle-HR-java (V2) |
|----------|-------------|---------------------|
| Application Port | 3000 (mapped to 3001) | 3002 (mapped to 3002) |
| New Relic App Name | Oracle-HR-Portal-Java | Oracle-HR-Portal-Java-V2 |
| Service Name | oracle-test-app | oracle-hr-app |
| Connection Pool Name | OracleHRPool | OracleHRPoolV2 |
| Maven Artifact | oracle-hr-portal | oracle-hr-portal-v2 |
| Group ID | com.oracle.test | com.oracle.hr.test |

## Features

✅ **Same Functionality**
- All REST API endpoints identical to oracle-java
- Employee, Department, Job, and Report endpoints
- Complex SQL queries with JOINs and aggregations

✅ **HikariCP Connection Pooling**
- Pool Name: OracleHRPoolV2
- Minimum Idle: 2 (configurable via POOL_MIN)
- Maximum Pool Size: 10 (configurable via POOL_MAX)
- Connection Timeout: 60 seconds (configurable via POOL_TIMEOUT)
- Idle Timeout: 10 minutes
- Max Connection Lifetime: 30 minutes
- Prepared Statement Caching: Enabled (250 statements, 2048 bytes SQL limit)

✅ **New Relic APM Integration**
- Application Name: Oracle-HR-Portal-Java-V2
- Transaction tracking with HTTP method annotations
- SQL query obfuscation
- Distributed tracing enabled
- Application log forwarding

## Quick Start

### 1. Prerequisites

- Docker and Docker Compose installed
- Oracle Database accessible
- New Relic license key
- `newrelic.jar` file in the project root

### 2. Configure Environment Variables

Edit the `.env` file:

```bash
# Oracle Database Configuration
ORACLE_USER=hr
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=host:port/service

# Connection Pool Settings
POOL_MIN=5
POOL_MAX=20
POOL_TIMEOUT=60

# New Relic Configuration
NEW_RELIC_LICENSE_KEY=your_license_key
NEW_RELIC_APP_NAME=Oracle-HR-Portal-Java-V2
NEW_RELIC_HOST=staging-collector.newrelic.com
NEW_RELIC_LOG_LEVEL=info
```

### 3. Build and Run

```bash
# Build and start the application
docker-compose up -d --build

# Check logs
docker-compose logs -f oracle-hr-app

# Check health
curl http://localhost:3002/health
```

### 4. Test API Endpoints

```bash
# Run the test script
chmod +x test-api.sh
./test-api.sh

# Or test manually
curl http://localhost:3002/employees | jq .
curl http://localhost:3002/departments | jq .
curl http://localhost:3002/health | jq .
```

## Available Endpoints

All endpoints are accessible at `http://localhost:3002`

### Health & Monitoring
- `GET /health` - Health check with database connectivity
- `GET /pool-stats` - HikariCP connection pool statistics

### Employees
- `GET /employees` - List all employees
- `GET /employees/{id}` - Get employee by ID
- `POST /employees` - Create new employee
- `PUT /employees/{id}` - Update employee
- `GET /employees/{id}/history` - Employee job history
- `POST /employees/{id}/promote` - Promote employee

### Departments
- `GET /departments` - List all departments
- `GET /departments/{id}/employees` - Employees in department
- `GET /departments/metrics` - Department metrics

### Jobs
- `GET /jobs` - List all jobs
- `GET /jobs/compensation-analysis` - Compensation analysis

### Reports
- `GET /reports/salary-by-department` - Salary by department
- `GET /reports/employee-turnover` - Employee turnover
- `GET /reports/location-wise` - Location-based analysis

## HikariCP Connection Pool Configuration

The application uses HikariCP with the following optimizations:

```java
// Connection Pool Settings
Minimum Idle: 2 (configurable)
Maximum Pool Size: 10 (configurable)
Connection Timeout: 60 seconds (configurable)
Idle Timeout: 10 minutes
Max Connection Lifetime: 30 minutes

// Performance Optimizations
Prepared Statement Caching: Enabled
PrepStmt Cache Size: 250
PrepStmt Cache SQL Limit: 2048 bytes

// Oracle-Specific Settings
Implicit Statement Cache: 25
Connection Timeout: 10 seconds
Read Timeout: 60 seconds
```

### View Pool Statistics

```bash
# Via API
curl http://localhost:3002/pool-stats | jq .

# Via JMX (requires JMX access)
# Pool name: OracleHRPoolV2
```

## Running Multiple Instances

You can run both oracle-java and Oracle-HR-java simultaneously:

```bash
# Terminal 1 - oracle-java (port 3001)
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
docker-compose up -d

# Terminal 2 - Oracle-HR-java (port 3002)
cd /Users/spathlavath/otel/db-perfromance-testing/Oracle-HR-java
docker-compose up -d

# Test both
curl http://localhost:3001/health  # oracle-java
curl http://localhost:3002/health  # Oracle-HR-java V2
```

Both will show up as separate applications in New Relic:
- Oracle-HR-Portal-Java (port 3001)
- Oracle-HR-Portal-Java-V2 (port 3002)

## Stopping the Application

```bash
# Stop and remove containers
docker-compose down

# Stop and remove with volumes
docker-compose down -v
```

## Troubleshooting

### Connection Pool Issues

```bash
# Check pool statistics
curl http://localhost:3002/pool-stats

# View logs for connection events
docker-compose logs oracle-hr-app | grep -i hikari

# Check for connection leaks
docker-compose logs oracle-hr-app | grep -i "connection leak"
```

### Database Connection Issues

```bash
# Test database connectivity
docker-compose exec oracle-hr-app curl http://localhost:3002/health

# Check Oracle connection string
docker-compose exec oracle-hr-app env | grep ORACLE
```

### Port Already in Use

If port 3002 is already in use, update in:
1. `application.properties` - `server.port=3002`
2. `docker-compose.yml` - ports mapping
3. `Dockerfile` - EXPOSE and health check
4. `test-api.sh` - BASE_URL

## Files Modified from oracle-java

- `pom.xml` - Updated artifact name and group ID
- `application.properties` - Changed port to 3002
- `docker-compose.yml` - Updated service name and port mappings
- `Dockerfile` - Updated health check port
- `newrelic.yml` - Changed default app name
- `.env` - Updated NEW_RELIC_APP_NAME
- `test-api.sh` - Updated BASE_URL and service references
- `DatabaseConfig.java` - Changed pool name to OracleHRPoolV2

## Technology Stack

- **Framework**: Spring Boot 3.2
- **Java**: 17
- **Database**: Oracle Database 19c
- **Connection Pool**: HikariCP
- **APM**: New Relic Java Agent
- **Build**: Maven 3.9
- **Container**: Docker with Alpine Linux

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f oracle-hr-app`
2. Verify environment variables in `.env`
3. Ensure `newrelic.jar` is present in the project root
4. Test database connectivity separately
