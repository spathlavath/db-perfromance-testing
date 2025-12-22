# Oracle Java HR Portal - OpenTelemetry Test Application

A Java Spring Boot application for testing Oracle Database with OpenTelemetry instrumentation.

## Features

- Spring Boot 3.2 with Java 17
- Oracle JDBC Driver with HikariCP connection pooling
- **Dual APM Support:**
  - OpenTelemetry automatic instrumentation via Java agent (default)
  - New Relic Java APM agent (optional)
  - Can use either one or both simultaneously
- REST API for HR operations (employees, departments, jobs, reports)
- k6 load testing setup
- Docker containerization with health checks

## Prerequisites

- Docker and Docker Compose
- Oracle Database with HR schema
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

### APM Agent Selection
Choose which agents to enable:
- `USE_OTEL` - Enable OpenTelemetry (default: true)
- `USE_NEW_RELIC` - Enable New Relic APM (default: false)

### OpenTelemetry Configuration
All OTEL environment variables are supported:
- `OTEL_SERVICE_NAME` - Service name for telemetry
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP collector endpoint
- `OTEL_EXPORTER_OTLP_HEADERS` - Headers for authentication
- And many more (see `.env.example` for complete list)

### New Relic APM Configuration
Native New Relic Java agent support:
- `NEW_RELIC_LICENSE_KEY` - Your New Relic license key
- `NEW_RELIC_APP_NAME` - Application name in New Relic
- `NEW_RELIC_HOST` - Collector endpoint (e.g., staging-collector.newrelic.com)
- `NEW_RELIC_LOG_LEVEL` - Agent log level

See `AGENT_CONFIGURATION.md` for detailed agent setup guide.

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

# Run with OpenTelemetry agent
java -javaagent:opentelemetry-javaagent.jar \\
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
│       │   │   ├── DatabaseConfig.java
│       │   │   └── OpenTelemetryConfig.java
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
│           └── application.properties
├── k6/
│   └── scripts/
│       └── load-test.js
├── Dockerfile
├── docker-compose.yml
├── pom.xml
└── README.md
```

## APM Instrumentation

### OpenTelemetry (Default)
The application uses:
- OpenTelemetry Java agent for automatic instrumentation
- Custom `@WithSpan` annotations for service methods
- OTLP exporter for traces and metrics
- All standard OTEL environment variables supported

### New Relic APM (Optional)
When enabled, provides:
- Native New Relic Java agent instrumentation
- Automatic code-level metrics
- Transaction traces with SQL details
- Error analytics
- Application logs forwarding
- JVM monitoring

### Switching Agents
Edit `.env` file:
```bash
# Use OpenTelemetry only (default)
USE_OTEL=true
USE_NEW_RELIC=false

# Use New Relic APM only
USE_OTEL=false
USE_NEW_RELIC=true

# Use both (maximum observability)
USE_OTEL=true
USE_NEW_RELIC=true
```

Then restart: `./deploy.sh restart`

See `AGENT_CONFIGURATION.md` for detailed configuration guide.

## Notes

- This Java application maintains the same environment variables as the Node.js version
- Uses HikariCP for connection pooling (same as Oracle Instant Client)
- Spring Boot provides additional features like Actuator endpoints
- OpenTelemetry Java agent provides comprehensive automatic instrumentation
