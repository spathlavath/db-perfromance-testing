# Using Custom New Relic Snapshot JAR

This guide shows you how to use a custom/snapshot New Relic Java agent JAR for testing SQL comment prepending.

## Option 1: Local Snapshot JAR File (Recommended)

### Step 1: Place Your Snapshot JAR

Copy your snapshot JAR to the oracle-java directory:

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
cp /path/to/newrelic-agent-SNAPSHOT.jar ./newrelic-agent-custom.jar
```

### Step 2: Modify Dockerfile

Edit the `Dockerfile` and replace lines 27-33 with:

```dockerfile
# Use custom New Relic Java agent snapshot
RUN mkdir -p /app/newrelic
COPY newrelic-agent-custom.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
```

### Step 3: Update .gitignore

Add to `.gitignore`:
```
newrelic-agent-custom.jar
newrelic-agent-*.jar
```

## Option 2: New Relic JAR from ZIP/TAR

If you have a full New Relic distribution (ZIP file):

### Step 1: Place ZIP File

```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java
cp /path/to/newrelic-java-snapshot.zip ./newrelic-snapshot.zip
```

### Step 2: Modify Dockerfile

```dockerfile
# Use custom New Relic Java agent from local ZIP
RUN apk add --no-cache unzip
COPY newrelic-snapshot.zip /tmp/newrelic-snapshot.zip
RUN unzip /tmp/newrelic-snapshot.zip -d /app && \
    rm /tmp/newrelic-snapshot.zip && \
    chmod 644 /app/newrelic/newrelic.jar
```

## Option 3: Download from Custom URL

If the snapshot is hosted somewhere:

```dockerfile
# Download custom New Relic Java agent
RUN mkdir -p /app/newrelic
ADD https://your-server.com/path/to/newrelic-snapshot.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
```

## Complete Modified Dockerfile Example

Here's the full Dockerfile with Option 1 (local JAR):

```dockerfile
# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Download OpenTelemetry Java agent (keep for comparison)
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v1.32.0/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar

# ===== MODIFIED SECTION: Use Custom New Relic Agent =====
# Use custom New Relic Java agent snapshot for testing SQL comments
RUN mkdir -p /app/newrelic
COPY newrelic-agent-custom.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
# ========================================================

# Copy New Relic configuration
COPY src/main/resources/newrelic.yml /app/newrelic/newrelic.yml

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start script to handle both OTEL and New Relic agents
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
```

## Verification Steps

After modifying the Dockerfile:

### 1. Verify the JAR is Copied
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle-java

# Check file exists
ls -lh newrelic-agent-custom.jar

# Check file size (should be around 10-15 MB)
du -h newrelic-agent-custom.jar
```

### 2. Build and Test Locally (Optional)
```bash
# Build the Docker image
docker build -t oracle-hr-test:snapshot .

# Check if the JAR was copied correctly
docker run --rm oracle-hr-test:snapshot ls -lh /app/newrelic/

# You should see newrelic.jar and newrelic.yml
```

### 3. Deploy to VM

Transfer everything to the VM:
```bash
# From your Mac
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ <user>@<vm-ip>:~/oracle-java/
```

On the VM:
```bash
cd ~/oracle-java

# Verify custom JAR was transferred
ls -lh newrelic-agent-custom.jar

# Deploy
./deploy.sh up
```

### 4. Verify Agent in Container

```bash
# SSH to VM
ssh <user>@<vm-ip>

# Check the New Relic JAR inside the container
docker exec oracle-test-app ls -lh /app/newrelic/

# Check New Relic version
docker exec oracle-test-app java -jar /app/newrelic/newrelic.jar version

# Check agent logs
docker logs oracle-test-app 2>&1 | grep -i "New Relic"
```

## Troubleshooting

### Issue: JAR file not found during build

**Error:**
```
COPY failed: file not found in build context
```

**Solution:**
- Ensure `newrelic-agent-custom.jar` is in the `oracle-java/` directory
- Check the filename matches exactly in Dockerfile
- Run `ls -la newrelic-agent-custom.jar` to verify

### Issue: Agent doesn't start

**Check:**
```bash
docker logs oracle-test-app 2>&1 | head -100
```

Look for:
- "New Relic Agent" startup messages
- Any Java errors
- Class loading issues

### Issue: Wrong agent version loaded

**Verify agent version:**
```bash
docker exec oracle-test-app java -jar /app/newrelic/newrelic.jar version
```

Should show your snapshot version.

## Quick Reference

### File Checklist
- [ ] `newrelic-agent-custom.jar` in oracle-java/ directory
- [ ] `Dockerfile` modified to use custom JAR
- [ ] `.env` has `USE_NEW_RELIC=true`
- [ ] `.env` has `NEW_RELIC_LICENSE_KEY` set
- [ ] `newrelic.yml` has appropriate config
- [ ] Custom JAR added to `.gitignore`

### Commands Summary
```bash
# 1. Copy snapshot JAR
cp /path/to/snapshot.jar newrelic-agent-custom.jar

# 2. Modify Dockerfile (manual edit)

# 3. Transfer to VM
rsync -avz oracle-java/ user@vm:~/oracle-java/

# 4. Deploy on VM
ssh user@vm
cd ~/oracle-java
./deploy.sh up

# 5. Verify
./test-sql-comments.sh
```

## Reverting to Official Agent

To switch back to the official New Relic agent:

1. Edit `Dockerfile` and restore original lines:
```dockerfile
# Download New Relic Java agent
ADD https://download.newrelic.com/newrelic/java-agent/newrelic-agent/current/newrelic-java.zip /tmp/newrelic-java.zip
RUN apk add --no-cache unzip && \
    unzip /tmp/newrelic-java.zip -d /app && \
    rm /tmp/newrelic-java.zip && \
    chmod 644 /app/newrelic/newrelic.jar
```

2. Rebuild and redeploy:
```bash
./deploy.sh rebuild
```
