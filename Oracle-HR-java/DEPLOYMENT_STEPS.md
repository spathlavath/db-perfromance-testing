# Deployment Steps for Oracle Java Application with Custom New Relic Agent

## Prerequisites
- Custom newrelic.jar file is at `~/newrelic.jar` on VM (150.136.71.213)
- Code has been pulled via `git pull`
- Docker and Docker Compose are installed

## Step 1: Copy Custom New Relic JAR to Build Context

Before building the Docker image, copy your custom newrelic.jar into the oracle-java directory:

```bash
cd ~/otel/db-perfromance-testing/oracle-java
cp ~/newrelic.jar .
```

This makes the JAR file available to the Docker build context.

## Step 2: Verify Required Files

Ensure all required files are in place:

```bash
ls -lh newrelic.jar
ls -lh .env
ls -lh docker-compose.yml
```

## Step 3: Build and Start the Application

Build and start the application with Docker Compose:

```bash
# Build and start in detached mode
docker-compose up -d --build

# View logs to verify New Relic agent startup
docker-compose logs -f oracle-test-app
```

## Step 4: Verify Application Health

Check that the application is running:

```bash
# Health check endpoint
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","database":"connected","timestamp":"..."}
```

## Step 5: Verify New Relic Agent

Look for these messages in the logs:

```bash
docker-compose logs oracle-test-app | grep -i "nr_trace_id"
```

Expected output should show:
- New Relic agent starting
- Connection to New Relic collector
- Application instrumented message

## Step 6: Test API Endpoints

Test a few endpoints to generate traffic:

```bash
# Get all employees
curl http://localhost:3000/employees

# Get pool statistics
curl http://localhost:3000/pool-stats

# Get departments
curl http://localhost:3000/departments
```

## Step 7: Monitor in New Relic Dashboard

1. Log in to your New Relic account
2. Navigate to APM & Services
3. Look for application: **Oracle-HR-Portal-Java**
4. Verify transactions are appearing

## Common Commands

```bash
# View logs
docker-compose logs -f oracle-test-app

# Stop application
docker-compose down

# Restart application
docker-compose restart oracle-test-app

# Rebuild and restart
docker-compose up -d --build

# Check container status
docker-compose ps

# Execute commands inside container
docker-compose exec oracle-test-app /bin/sh
```

## Troubleshooting

### Issue: Docker build fails with "newrelic.jar not found"
**Solution**: Ensure you copied the JAR file to the oracle-java directory before building:
```bash
cp ~/newrelic.jar ~/otel/db-perfromance-testing/oracle-java/
```

### Issue: New Relic agent not starting
**Solution**: Check the logs for errors:
```bash
docker-compose logs oracle-test-app | grep -i "error"
```

Verify environment variables in .env file:
- NEW_RELIC_LICENSE_KEY
- NEW_RELIC_APP_NAME
- NEW_RELIC_HOST

### Issue: Application cannot connect to Oracle database
**Solution**: Verify database connectivity:
```bash
# From VM
telnet 10.0.1.36 1521
```

Check .env file has correct credentials:
- ORACLE_USER=hr
- ORACLE_PASSWORD=NewRelic_PW_7663_
- ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com

## Important Notes

1. **Custom JAR File**: The Dockerfile now uses your uploaded newrelic.jar file which contains your latest changes
2. **Build Context**: The newrelic.jar must be in the oracle-java directory for Docker to copy it during build
3. **No Internet Download**: The Dockerfile no longer downloads the agent from New Relic website
4. **Staging Environment**: Application reports to staging-collector.newrelic.com

## Next Steps

After successful deployment:
1. Run k6 load tests to generate traffic
2. Monitor performance in New Relic dashboard
3. Check for any errors or performance issues
4. Adjust connection pool settings if needed
