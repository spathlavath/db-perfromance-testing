# OpenTelemetry APM Instrumentation Setup

## Summary
Added OpenTelemetry APM instrumentation to Oracle HR Portal application to send telemetry data to New Relic.

## Changes Made

### 1. Environment Variables (.env)
Added OTEL configuration:
```bash
OTEL_SERVICE_NAME=Oracle-HR-Portal
OTEL_RESOURCE_ATTRIBUTES=service.instance.id=oracle-hr-portal-001
OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp.nr-data.net
OTEL_EXPORTER_OTLP_HEADERS=api-key=2d8fd61a6a207b8d52ed5d52c9acdcefFFFFNRAL
OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT=4095
OTEL_EXPORTER_OTLP_COMPRESSION=gzip
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE=delta
```

### 2. Package Dependencies (package.json)
Added OpenTelemetry packages:
- `@opentelemetry/api`
- `@opentelemetry/sdk-node`
- `@opentelemetry/auto-instrumentations-node`
- `@opentelemetry/exporter-trace-otlp-proto`
- `@opentelemetry/exporter-metrics-otlp-proto`

### 3. New Files Created
- `services/tracing.js` - OpenTelemetry SDK initialization and configuration

### 4. Application Changes (app.js)
- Added `require('./tracing')` at the very top to initialize OTEL before any other code

## Deployment Steps

### On Local Machine:
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle

# Copy all updated files to VM
scp -i ~/Downloads/ssh-key-2025-11-03.key .env opc@150.136.71.213:~/db-perfromance-testing/oracle/
scp -i ~/Downloads/ssh-key-2025-11-03.key services/package.json opc@150.136.71.213:~/db-perfromance-testing/oracle/services/
scp -i ~/Downloads/ssh-key-2025-11-03.key services/tracing.js opc@150.136.71.213:~/db-perfromance-testing/oracle/services/
scp -i ~/Downloads/ssh-key-2025-11-03.key services/app.js opc@150.136.71.213:~/db-perfromance-testing/oracle/services/
scp -i ~/Downloads/ssh-key-2025-11-03.key services/newrelic.js opc@150.136.71.213:~/db-perfromance-testing/oracle/services/
```

### On VM (150.136.71.213):
```bash
ssh -A -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213
cd ~/db-perfromance-testing/oracle

# Rebuild Docker image with new dependencies
docker-compose down
docker-compose up --build -d

# Monitor logs
docker-compose logs -f oracle-test-app
```

## Expected Log Output
When successful, you should see:
```
✅ OpenTelemetry instrumentation initialized
📡 Exporting to: https://otlp.nr-data.net
🏷️  Service: Oracle-HR-Portal
✅ New Relic APM initialized successfully
✅ Oracle Thick Mode initialized successfully
🔌 Connected to Oracle Database: Oracle Database 19c Enterprise Edition...
```

## What Gets Monitored

### Traces
- HTTP requests to Express endpoints
- Oracle database queries
- Transaction workloads
- Memory operations
- Lock operations

### Metrics
- Request duration
- Database query performance
- Connection pool statistics
- Error rates
- Throughput

### Custom Attributes
- Service name: Oracle-HR-Portal
- Service instance: oracle-hr-portal-001
- Database: Oracle 19c
- Schema: HR

## Verification in New Relic

1. Go to https://one.newrelic.com/
2. Navigate to **APM & Services**
3. Find **Oracle-HR-Portal** service
4. Check:
   - Transactions (HTTP endpoints)
   - Databases (Oracle queries)
   - Distributed tracing
   - Service map

## Notes
- Both New Relic APM (native agent) and OpenTelemetry are configured
- OTEL data goes to: `https://otlp.nr-data.net`
- New Relic APM data goes to: `staging-collector.newrelic.com`
- License key is for staging environment
- All workloads will generate telemetry data automatically
