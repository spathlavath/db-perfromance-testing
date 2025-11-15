# Oracle Test Application - HR Portal

A comprehensive Node.js application designed to test all New Relic Oracle DB receiver features by generating various database workloads against the Oracle HR schema. This application simulates a real HR portal with employee, department, job, and location management operations. It is containerized and follows the same pattern as other database performance testing applications in this repository.

## Quick Start

```bash
# Copy environment configuration
cp .env.example .env

# Edit with your Oracle DB credentials
nano .env

# Start with Docker Compose
docker-compose up --build

# Cleanup when done
./cleanup.sh
```

## 🔒 Blocking Query Workload

Tests SELECT queries blocked by UPDATE operations in real-time.

### Quick Test (2 Steps)

**Terminal 1 - Start Docker:**
```bash
docker-compose up --build
```

**Terminal 2 - Run Scenarios:**
```bash
# Test blocking scenario
curl -X POST http://localhost:3000/blocking/basic

# Or run continuous blocking workload (5 minutes)
curl -X POST http://localhost:3000/workload/start \
  -H "Content-Type: application/json" \
  -d '{"type": "blocking", "duration": 300, "intensity": "medium"}'
```

**Watch Terminal 1** - See blocking with detailed logs!

### What You'll See:
```
🔒 SELECT Query Blocked by UPDATE Query
📝 Step 1: UPDATE query locks IT Department employees
📊 Step 2: SELECT query BLOCKED, waiting...
🔓 Step 3: Locks released
⏳ Step 4: SELECT completed in 5.23 seconds ✅
```

### Available Scenarios:
- `/blocking/basic` - Simple SELECT blocked by UPDATE
- `/blocking/multiple` - 3 SELECTs blocked by 1 UPDATE
- `/blocking/review` - Multi-step salary update blocking

📄 **Full commands**: See [BLOCKING_TEST_COMMANDS.md](BLOCKING_TEST_COMMANDS.md)

## Features

This application generates workloads to test the following Oracle DB metrics:

### 1. Query Performance Metrics (QPM)
- Fast queries (employee lookups, department searches, job queries)
- Slow queries (complex joins across employees, departments, locations, countries)
- Full table scans (salary analysis, employee name searches)
- Parse-intensive queries (department-based employee queries with variations)
- Bind variable queries (parameterized employee and department lookups)

### 2. Transaction Metrics
- Short transactions (quick salary lookups)
- Long-running transactions (comprehensive HR reports with all relationships)
- Rollback transactions (simulated failed salary updates)
- Multi-statement transactions (employee profile views with job history and department info)

### 3. Connection Metrics
- Burst connections
- Sustained connections
- Short-lived connections
- Idle connections
- Connection pool utilization

### 4. Lock Metrics
- Table locks (EMPLOYEES table locking for reports)
- Row locks (employee record locks simulating salary updates)
- Deadlock scenarios (concurrent employee record access)
- Lock waits and timeouts (batch salary update contention)

### 5. Blocking Query Scenarios
Tests real-world performance issues from lock contention

- **Basic Blocking**: SELECT blocked by UPDATE
- **Multiple Readers**: 3 SELECTs blocked by 1 UPDATE  
- **Annual Review**: Multi-step updates blocking reports
- **Integrated**: Runs via API or workload system

**Quick Start**: `curl -X POST http://localhost:3000/blocking/basic`
**Full Guide**: See [BLOCKING_TEST_COMMANDS.md](BLOCKING_TEST_COMMANDS.md)

### 6. Memory Metrics
- Large result sets (comprehensive employee data with all relationships)
- Sort operations (salary and hire date sorting for HR reports)
- Hash joins (complex joins across all HR tables: employees, departments, locations, countries, regions)
- Temporary space usage (DISTINCT and UNION operations on employee and job history data)
- PL/SQL memory operations (employee data processing with collections)

## Prerequisites

- Node.js >= 14.0.0
- Access to Oracle Database (11g or higher)
- **Oracle HR Schema** - The application requires the HR schema to be installed in your database
  - Tables used: EMPLOYEES, DEPARTMENTS, JOBS, JOB_HISTORY, LOCATIONS, COUNTRIES, REGIONS
  - See `db-sample-schemas` for installation instructions
- Oracle Instant Client (automatically handled by oracledb npm package for most systems)

## Installation

### Using Docker (Recommended)

```bash
# Copy environment configuration
cp .env.example .env

# Edit with your Oracle DB credentials
nano .env

# Build and start
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f oracle-test-app

# Stop
docker-compose down

# Cleanup
./cleanup.sh
```

### Local Development (Without Docker)

```bash
# Navigate to services directory
cd services

# Install dependencies
npm install

# Copy environment file
cp ../.env.example ../.env

# Edit .env with your Oracle DB credentials
nano ../.env

# Start application
npm start
```

## Configuration

Edit the `.env` file with your Oracle Database connection details:

```env
# Oracle Database Configuration (HR Schema)
ORACLE_USER=hr
ORACLE_PASSWORD=your_hr_password
ORACLE_CONNECT_STRING=your_host:1521/your_service_name

# Connection Pool Settings
POOL_MIN=2
POOL_MAX=10
POOL_INCREMENT=1
POOL_TIMEOUT=60

# Application Settings
PORT=3000
AUTO_RUN=false

# Test Configuration
TEST_INTENSITY=medium
TEST_DURATION=600

# New Relic APM (Optional)
NEW_RELIC_LICENSE_KEY=your_newrelic_license_key_here
NEW_RELIC_APP_NAME=Oracle-Test-App

# K6 Load Testing
K6_LOG_LEVEL=INFO
K6_DETAILED_LOGGING=false
K6_LOG_SLOW_REQUESTS_MS=5000
```

### Configuration Options

- **ORACLE_USER**: Database user with access to HR schema (default: hr)
- **ORACLE_PASSWORD**: Database password
- **ORACLE_CONNECT_STRING**: Connection string in format `host:port/service_name`
- **POOL_MIN/MAX**: Connection pool size limits
- **PORT**: HTTP API server port
- **AUTO_RUN**: Set to `true` to automatically run tests on startup
- **TEST_INTENSITY**: Workload intensity (`low`, `medium`, `high`)
- **TEST_DURATION**: How long to run tests (in seconds)
- **NEW_RELIC_LICENSE_KEY**: (Optional) Your New Relic license key for APM
- **NEW_RELIC_APP_NAME**: (Optional) Application name in New Relic
- **K6_LOG_LEVEL**: K6 load testing log level (DEBUG, INFO, WARN, ERROR)

## Usage

### Using Docker Compose

```bash
# Start in foreground
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Run All Tests Automatically

Set `AUTO_RUN=true` in `.env`, then start the application. Tests will begin automatically after startup.

### Using the API

The application exposes a REST API for controlling workloads:

#### Health Check
```bash
curl http://localhost:3000/health
```

#### Get Pool Statistics
```bash
curl http://localhost:3000/pool-stats
```

#### Start Specific Workload
```bash
# Start query workload
curl -X POST http://localhost:3000/workload/start \
  -H "Content-Type: application/json" \
  -d '{
    "type": "query",
    "duration": 300,
    "intensity": "medium"
  }'

# Available types: query, transaction, connection, lock, memory
```

#### Stop All Workloads
```bash
curl -X POST http://localhost:3000/workload/stop
```

## Docker Commands

```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f oracle-test-app
docker-compose logs -f k6

# Stop containers
docker-compose stop

# Remove containers
docker-compose down

# Rebuild specific service
docker-compose up --build oracle-test-app

# Execute command in running container
docker-compose exec oracle-test-app sh

# Check container health
docker-compose ps
```

## Monitoring with New Relic

While this application is running, your New Relic Oracle DB receiver should capture:

### Core Metrics
- `oracledb.cpu_time` - CPU time consumed
- `oracledb.sessions` - Active database sessions
- `oracledb.enqueue_locks` - Lock information
- `oracledb.physical_reads` - Physical I/O operations

### Query Performance
- `oracledb.parse_calls` - Parse call counts
- `oracledb.execute_count` - Query executions
- `oracledb.cursor_usage` - Cursor statistics

### Memory
- `oracledb.pga_memory` - PGA memory usage
- `oracledb.sga_memory` - SGA memory usage
- `oracledb.buffer_cache_hit_ratio` - Cache efficiency

### Transactions
- `oracledb.user_commits` - Committed transactions
- `oracledb.user_rollbacks` - Rolled back transactions
- `oracledb.transaction_count` - Active transactions

## Workload Intensity Levels

### Low
- Minimal resource usage
- Long intervals between operations
- Good for baseline testing

### Medium (Default)
- Moderate resource usage
- Balanced operation frequency
- Realistic production simulation

### High
- Heavy resource usage
- Short intervals between operations
- Stress testing

## Troubleshooting

### Connection Issues

```bash
# Test Oracle connectivity
node -e "
const oracledb = require('oracledb');
oracledb.getConnection({
  user: 'system',
  password: 'your_password',
  connectString: 'localhost:1521/FREEPDB1'
}).then(conn => {
  console.log('Connected!');
  conn.close();
}).catch(err => console.error(err));
"
```

### Permission Issues

Some workloads (like table locks) require specific privileges:

```sql
-- Grant necessary privileges
GRANT SELECT ANY TABLE TO your_user;
GRANT LOCK ANY TABLE TO your_user;
```

### Oracle Instant Client Issues

If you encounter issues with Oracle Instant Client:

```bash
# On Oracle Linux/RHEL
sudo yum install oracle-instantclient-basic

# Set environment variable
export LD_LIBRARY_PATH=/usr/lib/oracle/21/client64/lib:$LD_LIBRARY_PATH
```

## Project Structure

```
oracle/
├── services/
│   ├── app.js                      # Main application entry point
│   ├── test-all-features.js        # Test orchestration
│   ├── newrelic.js                 # New Relic APM configuration
│   ├── package.json                # Node.js dependencies
│   ├── Dockerfile                  # Docker container configuration
│   └── workloads/
│       ├── query-workload.js       # Query performance tests
│       ├── transaction-workload.js # Transaction tests
│       ├── connection-workload.js  # Connection pool tests
│       ├── lock-workload.js        # Lock scenario tests
│       └── memory-workload.js      # Memory usage tests
├── k6/
│   └── scripts/
│       └── load-test.js            # K6 load testing script
├── docker-compose.yml              # Docker Compose configuration
├── cleanup.sh                      # Cleanup script
├── .env.example                    # Environment variables template
├── .gitignore                      # Git ignore file
└── README.md                       # This file
```

## Contributing

Feel free to add more workload scenarios or improve existing ones to better test Oracle DB receiver features.

## License

MIT

## Support

For issues related to:
- **Oracle Database**: Refer to Oracle documentation
- **New Relic Receiver**: Check OpenTelemetry Collector Contrib repository
- **This Application**: Create an issue in your repository
