# Quick Start Guide - Oracle Java HR Portal on Oracle Linux VM

## 🚀 Fast Deployment (3 Steps)

### Step 1: Transfer Files to VM

```bash
# From your local machine
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ username@your-vm-ip:~/oracle-java/
```

### Step 2: SSH to VM and Deploy

```bash
# SSH to your Oracle Linux VM
ssh username@your-vm-ip

# Navigate to application directory
cd ~/oracle-java

# Deploy the application
./deploy.sh up
```

### Step 3: Verify

```bash
# Check status
./deploy.sh status

# View logs
./deploy.sh logs

# Test endpoints
./deploy.sh test
```

## 📋 Prerequisites Installation (One-Time Setup)

If Docker is not installed on your VM:

```bash
# Install Docker and Docker Compose
sudo dnf update -y
sudo dnf install -y dnf-utils
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
docker compose version
```

## 🎯 Common Commands

```bash
# Start application
./deploy.sh up

# Stop application
./deploy.sh stop

# View logs
./deploy.sh logs

# Check status
./deploy.sh status

# Restart application
./deploy.sh restart

# Test all endpoints
./deploy.sh test

# Run k6 load test
./deploy.sh k6

# Rebuild from scratch
./deploy.sh rebuild

# Clean everything
./deploy.sh clean

# Show help
./deploy.sh help
```

## 🔍 Manual Docker Commands (Alternative)

```bash
# Start
docker compose up -d

# Stop
docker compose down

# View logs
docker compose logs -f

# Check status
docker compose ps

# Restart
docker compose restart
```

## 🌐 API Endpoints

Once deployed, access these endpoints:

```bash
# Health check
curl http://localhost:3000/health

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

# Pool statistics
curl http://localhost:3000/pool-stats
```

## ⚙️ Configuration

The application uses these credentials from `.env`:

```bash
ORACLE_USER=hr
ORACLE_PASSWORD=NewRelic_PW_7663_
ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
OTEL_EXPORTER_OTLP_ENDPOINT=https://staging-otlp.nr-data.net:4318
```

No changes needed - it's ready to use!

## 🐛 Troubleshooting

### Application not starting?
```bash
# Check logs
docker compose logs -f oracle-test-app

# Check container status
docker compose ps
```

### Database connection issues?
```bash
# Test database connectivity
docker compose exec oracle-test-app nc -zv 10.0.1.36 1521

# Check health endpoint
curl http://localhost:3000/health
```

### Port 3000 already in use?
```bash
# Edit .env file and change PORT
echo "PORT=3001" >> .env

# Restart
./deploy.sh restart
```

### Need to rebuild?
```bash
# Clean rebuild
./deploy.sh rebuild
```

## 📊 Monitoring

### View Application Logs
```bash
./deploy.sh logs
```

### Check Resource Usage
```bash
docker stats
```

### View OpenTelemetry Data
Check your New Relic dashboard at:
- Service: **HR-Portal**
- Environment: **Staging**

## 🔄 Updates

To update the application with new code:

```bash
# Transfer new files
rsync -avz --progress oracle-java/ username@your-vm-ip:~/oracle-java/

# SSH to VM
ssh username@your-vm-ip

# Rebuild and restart
cd ~/oracle-java
./deploy.sh rebuild
```

## 🛑 Stopping the Application

```bash
# Stop containers (keep data)
./deploy.sh stop

# Stop and remove containers
./deploy.sh down

# Full cleanup (removes everything)
./deploy.sh clean
```

## 📝 File Structure

```
oracle-java/
├── deploy.sh                    # Quick deployment script (use this!)
├── docker-compose.yml           # Docker compose configuration
├── Dockerfile                   # Container build file
├── .env                         # Environment variables (configured)
├── DEPLOYMENT_GUIDE.md          # Detailed deployment guide
├── QUICK_START.md              # This file
├── README.md                    # Application documentation
├── pom.xml                      # Maven project file
├── src/                         # Java source code
└── k6/                          # Load testing scripts
    └── scripts/
        ├── load-test.js         # Main load test
        ├── workload-simulator-test.js
        └── oracle-metrics.js
```

## ✅ Success Checklist

- [ ] Docker and Docker Compose installed
- [ ] Files transferred to VM
- [ ] Application started with `./deploy.sh up`
- [ ] Health check passes: `curl http://localhost:3000/health`
- [ ] API endpoints responding: `./deploy.sh test`
- [ ] Logs show no errors: `./deploy.sh logs`
- [ ] OpenTelemetry data visible in New Relic

## 🆘 Getting Help

1. **Check deployment guide**: `cat DEPLOYMENT_GUIDE.md`
2. **View logs**: `./deploy.sh logs`
3. **Run tests**: `./deploy.sh test`
4. **Check status**: `./deploy.sh status`

## 🎉 That's It!

Your Oracle Java HR Portal application is now running with:
- ✅ Oracle Database connected
- ✅ OpenTelemetry instrumentation active
- ✅ Sending data to New Relic Staging
- ✅ k6 load testing configured
- ✅ Health checks passing

Access your application at: **http://localhost:3000**

View telemetry data in New Relic under service: **HR-Portal**
