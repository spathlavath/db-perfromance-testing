# Oracle Java HR Portal - New Relic APM Application

A Java Spring Boot application for testing Oracle Database with New Relic Java APM agent.

## Features

- Spring Boot 3.2 with Java 17
- Oracle JDBC Driver with HikariCP connection pooling
- **New Relic Java APM** native instrumentation
- REST API for HR operations (employees, departments, jobs, reports)
- k6 load testing setup
- Docker containerization with health checks

## Prerequisites

- Docker and Docker Compose
- Oracle Database with HR schema
- New Relic account and license key
- Environment variables configured (see `.env.example`)

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Oracle Database
- `ORACLE_USER` - Oracle database username
- `ORACLE_PASSWORD` - Oracle database password
- `ORACLE_CONNECT_STRING` - Connection string (host:port/service_name)

### Connection Pool
- `POOL_MIN` - Minimum pool size (default: 2)
- `POOL_MAX` - Maximum pool size (default: 10)
- `POOL_TIMEOUT` - Connection timeout in seconds (default: 60)

### New Relic APM Configuration
Native New Relic Java agent support:
- `NEW_RELIC_LICENSE_KEY` - Your New Relic license key
- `NEW_RELIC_APP_NAME` - Application name in New Relic (default: Oracle-HR-Portal-Java)
- `NEW_RELIC_HOST` - Collector endpoint (default: collector.newrelic.com)
- `NEW_RELIC_LOG_LEVEL` - Agent log level (default: info)

## API Endpoints

### Health
- `GET /health` - Health check endpoint
- `GET /pool-stats` - Connection pool statistics

### Employees
- `GET /employees` - List all employees
- `GET /employees/{id}` - Get employee by ID
- `POST /employees` - Create new employee
- `PUT /employees/{id}` - Update employee
- `GET /employees/{id}/history` - Get employee job history
- `POST /employees/{id}/promote` - Promote employee

### Departments
- `GET /departments` - List all departments with stats
- `GET /departments/{id}/employees` - Get department employees

### Reports
- `GET /reports/salary-by-department` - Salary report by department

### Jobs
- `GET /jobs` - List all jobs

## Running the Application

### Using Docker Compose

```bash
# Start the application and k6 load test
docker-compose up

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f oracle-test-app

# Stop the application
docker-compose down
```

### Local Development

```bash
# Build the application
mvn clean package

# Run with New Relic agent
java -javaagent:newrelic/newrelic.jar \\
     -jar target/oracle-hr-portal-1.0.0.jar
```

## Load Testing with k6

The k6 load test script is located at `k6/scripts/load-test.js` and tests various HR operations:

- Employee list queries (30%)
- Employee details (25%)
- Department lists (15%)
- Department employees (10%)
- Salary reports (5%)
- Job lists (5%)
- Employee updates (3%)
- Employee history (5%)
- Create employee (1%)
- Promote employee (1%)

## Project Structure

```
oracle-java/
├── src/
│   └── main/
│       ├── java/com/oracle/test/
│       │   ├── OracleHrPortalApplication.java
│       │   ├── config/
│       │   │   └── DatabaseConfig.java
│       │   ├── controller/
│       │   │   ├── EmployeeController.java
│       │   │   ├── DepartmentController.java
│       │   │   ├── ReportController.java
│       │   │   ├── JobController.java
│       │   │   └── HealthController.java
│       │   └── service/
│       │       ├── EmployeeService.java
│       │       ├── DepartmentService.java
│       │       ├── ReportService.java
│       │       └── JobService.java
│       └── resources/
│           ├── application.properties
│           └── newrelic.yml
├── k6/
│   └── scripts/
│       └── load-test.js
├── Dockerfile
├── docker-compose.yml
├── pom.xml
└── README.md
```

## New Relic APM Instrumentation

The application uses New Relic Java APM agent which provides:
- Native New Relic Java agent instrumentation
- Automatic code-level metrics
- Transaction traces with SQL details
- Error analytics and tracking
- Application logs forwarding
- JVM monitoring and metrics
- Custom instrumentation support

### Monitored Data in New Relic

When running, check your New Relic dashboard:
- **Application Name**: Oracle-HR-Portal-Java
- **Environment**: Staging (configurable)
- **Transactions**: All REST API endpoints
- **Database**: SQL queries with execution times
- **JVM**: Memory, GC, thread metrics
- **Errors**: Exception tracking
- **Logs**: Application logs with context

## Notes

- Uses New Relic Java APM agent for comprehensive monitoring
- All database queries are automatically instrumented
- Transaction traces include full SQL statements (obfuscated)
- Error tracking with full stack traces
- Distributed tracing support
- Real-time performance monitoring

