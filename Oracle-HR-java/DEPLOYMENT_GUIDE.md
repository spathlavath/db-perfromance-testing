# Oracle Java Application - Deployment Guide for Oracle Linux VM

## Prerequisites

### 1. Install Docker and Docker Compose on Oracle Linux

```bash
# Update system packages
sudo dnf update -y

# Install Docker
sudo dnf install -y dnf-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Add your user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER

# Log out and log back in for group changes to take effect
# Or run: newgrp docker

# Verify Docker installation
docker --version
docker compose version
```

### 2. Install Git (if not already installed)

```bash
sudo dnf install -y git
```

## Deployment Steps

### 1. Transfer Application Files to Oracle Linux VM

**Option A: Using Git (if your code is in a repository)**
```bash
# Clone the repository
cd ~
git clone <your-repo-url>
cd db-perfromance-testing/oracle-java
```

**Option B: Using SCP from your local machine**
```bash
# From your local machine, run:
cd /Users/spathlavath/otel/db-perfromance-testing
scp -r oracle-java username@your-vm-ip:~/
```

**Option C: Using rsync (recommended for incremental updates)**
```bash
# From your local machine, run:
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ username@your-vm-ip:~/oracle-java/
```

### 2. Navigate to the Application Directory

```bash
cd ~/oracle-java
```

### 3. Verify the .env File

The .env file has been copied with your Oracle database credentials. Verify it's present:

```bash
cat .env
```

Expected configuration:
- ORACLE_USER=hr
- ORACLE_PASSWORD=NewRelic_PW_7663_
- ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
- OTEL_EXPORTER_OTLP_ENDPOINT=https://staging-otlp.nr-data.net:4318

### 4. Build and Start the Application

```bash
# Build and start all services (application + k6 load test)
docker compose up --build -d

# View logs
docker compose logs -f

# View only application logs
docker compose logs -f oracle-test-app

# View only k6 logs
docker compose logs -f k6
```

### 5. Verify Application is Running

```bash
# Check container status
docker compose ps

# Test health endpoint
curl http://localhost:3000/health

# Test an API endpoint
curl http://localhost:3000/employees

# Check pool stats
curl http://localhost:3000/pool-stats
```

## Managing the Application

### View Logs

```bash
# Follow all logs
docker compose logs -f

# View last 100 lines
docker compose logs --tail=100

# View logs from specific service
docker compose logs -f oracle-test-app
```

### Stop the Application

```bash
# Stop without removing containers
docker compose stop

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes
docker compose down -v
```

### Restart the Application

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart oracle-test-app
```

### Update and Rebuild

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker compose up --build -d

# Or force rebuild
docker compose build --no-cache
docker compose up -d
```

## Running Without k6 Load Test

If you want to run only the application without k6:

```bash
# Start only the oracle-test-app service
docker compose up -d oracle-test-app

# Or edit docker-compose.yml and comment out the k6 service
```

## Running k6 Separately

```bash
# Run k6 manually with different options
docker run --rm -i --network oracle-java_oracle-network \
  -v $(pwd)/k6/scripts:/scripts \
  -e BASE_URL=http://oracle-test-app:3000 \
  grafana/k6 run /scripts/load-test.js

# Run with custom VUs and duration
docker run --rm -i --network oracle-java_oracle-network \
  -v $(pwd)/k6/scripts:/scripts \
  -e BASE_URL=http://oracle-test-app:3000 \
  grafana/k6 run --vus 10 --duration 30m /scripts/load-test.js

# Run the workload simulator test
docker run --rm -i --network oracle-java_oracle-network \
  -v $(pwd)/k6/scripts:/scripts \
  -e BASE_URL=http://oracle-test-app:3000 \
  grafana/k6 run /scripts/workload-simulator-test.js

# Run the oracle metrics test
docker run --rm -i --network oracle-java_oracle-network \
  -v $(pwd)/k6/scripts:/scripts \
  -e API_URL=http://oracle-test-app:3000 \
  grafana/k6 run /scripts/oracle-metrics.js
```

## Monitoring and Troubleshooting

### Check Container Health

```bash
# Check health status
docker compose ps

# Inspect container
docker inspect oracle-java-oracle-test-app-1

# Check resource usage
docker stats
```

### Application Logs

```bash
# Real-time logs
docker compose logs -f oracle-test-app

# Search logs for errors
docker compose logs oracle-test-app | grep -i error

# Export logs to file
docker compose logs oracle-test-app > app.log
```

### Database Connection Issues

```bash
# Test database connectivity from container
docker compose exec oracle-test-app curl http://localhost:3000/health

# Check if database is reachable
docker compose exec oracle-test-app nc -zv 10.0.1.36 1521

# Test with SQL*Plus (if needed)
docker compose exec oracle-test-app bash
# Then inside container, you can debug
```

### OpenTelemetry Issues

```bash
# Check OTEL environment variables
docker compose exec oracle-test-app env | grep OTEL

# Test OTLP endpoint connectivity
docker compose exec oracle-test-app curl -v https://staging-otlp.nr-data.net:4318
```

### Clean Everything and Start Fresh

```bash
# Stop and remove everything
docker compose down -v

# Remove all related images
docker rmi $(docker images | grep oracle-java | awk '{print $3}')

# Rebuild from scratch
docker compose build --no-cache
docker compose up -d
```

## Firewall Configuration (if needed)

```bash
# Allow port 3000 for application access
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload

# Or disable firewall temporarily for testing
sudo systemctl stop firewalld
```

## Performance Tuning

### Adjust Memory Limits

Edit docker-compose.yml and modify:
```yaml
deploy:
  resources:
    limits:
      memory: 4G  # Increase if needed
    reservations:
      memory: 2G
```

### Adjust Connection Pool

Edit .env file:
```bash
POOL_MIN=10
POOL_MAX=50
POOL_TIMEOUT=120
```

Then restart:
```bash
docker compose restart oracle-test-app
```

## API Endpoints Reference

```bash
# Health check
curl http://localhost:3000/health

# Pool statistics
curl http://localhost:3000/pool-stats

# List employees
curl http://localhost:3000/employees

# Get employee by ID
curl http://localhost:3000/employees/100

# List departments
curl http://localhost:3000/departments

# Get department employees
curl http://localhost:3000/departments/60/employees

# Salary report
curl http://localhost:3000/reports/salary-by-department

# List jobs
curl http://localhost:3000/jobs

# Create employee (POST)
curl -X POST http://localhost:3000/employees \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@company.com",
    "phone_number": "650.555.1234",
    "hire_date": "2024-01-15",
    "job_id": "IT_PROG",
    "salary": 70000,
    "department_id": 60,
    "manager_id": 103
  }'

# Update employee (PUT)
curl -X PUT http://localhost:3000/employees/207 \
  -H "Content-Type: application/json" \
  -d '{
    "salary": 75000,
    "job_id": "IT_PROG",
    "department_id": 60,
    "manager_id": 103
  }'

# Get employee history
curl http://localhost:3000/employees/101/history

# Promote employee (POST)
curl -X POST http://localhost:3000/employees/101/promote \
  -H "Content-Type: application/json" \
  -d '{
    "new_job_id": "IT_PROG",
    "new_salary": 85000,
    "new_department_id": 90
  }'
```

## Quick Reference Commands

```bash
# One-liner to deploy everything
cd ~/oracle-java && docker compose up --build -d && docker compose logs -f

# One-liner to check status
docker compose ps && curl http://localhost:3000/health

# One-liner to restart
docker compose down && docker compose up -d

# One-liner to view logs with grep
docker compose logs -f | grep -E "ERROR|WARN|Exception"

# One-liner to check resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

## Support

For issues or questions:
1. Check application logs: `docker compose logs -f oracle-test-app`
2. Verify database connectivity: `curl http://localhost:3000/health`
3. Check environment variables: `docker compose exec oracle-test-app env | grep ORACLE`
4. Review OpenTelemetry logs for export issues

## Environment Variables Reference

See `.env` file for all available configuration options including:
- Oracle database connection settings
- Connection pool configuration
- OpenTelemetry/OTLP settings
- K6 load testing parameters
- Logging configuration
