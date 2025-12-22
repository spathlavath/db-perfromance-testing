# APM Agent Configuration Guide

The Oracle Java HR Portal supports both **OpenTelemetry** and **New Relic Java APM** agents. You can use either one or both simultaneously.

## Quick Configuration

Edit your `.env` file:

```bash
# Agent Selection
USE_OTEL=true          # Enable OpenTelemetry (default: true)
USE_NEW_RELIC=false    # Enable New Relic APM (default: false)
```

## OpenTelemetry Configuration (Default)

OpenTelemetry is enabled by default and configured to send data to New Relic via OTLP.

### Environment Variables

```bash
USE_OTEL=true
OTEL_SERVICE_NAME=HR-Portal
OTEL_EXPORTER_OTLP_ENDPOINT=https://staging-otlp.nr-data.net:4318
OTEL_EXPORTER_OTLP_HEADERS=api-key=your-api-key
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

### Features
- ✅ Automatic instrumentation via Java agent
- ✅ Distributed tracing
- ✅ Metrics collection
- ✅ Database instrumentation
- ✅ HTTP/REST instrumentation
- ✅ No code changes required

### Data in New Relic
- Service Name: `HR-Portal`
- Traces: Database queries, HTTP requests
- Metrics: JVM, throughput, latency

## New Relic Java APM Configuration

The New Relic Java agent provides native APM capabilities.

### Enable New Relic APM

Edit `.env`:

```bash
USE_NEW_RELIC=true
NEW_RELIC_LICENSE_KEY=2d8fd61a6a207b8d52ed5d52c9acdcefFFFFNRAL
NEW_RELIC_APP_NAME=Oracle-HR-Portal-Java
NEW_RELIC_HOST=staging-collector.newrelic.com
NEW_RELIC_LOG_LEVEL=info
```

### Features
- ✅ Native New Relic instrumentation
- ✅ Automatic code-level metrics
- ✅ Transaction traces
- ✅ SQL query analysis
- ✅ Error tracking
- ✅ Application logs forwarding
- ✅ JVM metrics

### Data in New Relic
- Application Name: `Oracle-HR-Portal-Java`
- Full APM capabilities
- Deeper Java-specific insights

## Using Both Agents (Dual Instrumentation)

You can run both agents simultaneously for comprehensive observability:

```bash
USE_OTEL=true
USE_NEW_RELIC=true
```

### Benefits
- OpenTelemetry: Vendor-neutral, standard traces
- New Relic APM: Native features, deeper insights
- Compare data from both sources

### Performance Impact
- Each agent adds overhead (~5-10%)
- Dual agents: ~10-15% overhead
- Recommended: Use one agent in production

## Switching Between Agents

### Use Only OpenTelemetry
```bash
USE_OTEL=true
USE_NEW_RELIC=false
```
Restart: `./deploy.sh restart`

### Use Only New Relic APM
```bash
USE_OTEL=false
USE_NEW_RELIC=true
```
Restart: `./deploy.sh restart`

### Use Both
```bash
USE_OTEL=true
USE_NEW_RELIC=true
```
Restart: `./deploy.sh restart`

### Use Neither (No Instrumentation)
```bash
USE_OTEL=false
USE_NEW_RELIC=false
```
Application runs without any APM agent.

## Configuration Files

### OpenTelemetry
Configuration via environment variables only. No config file needed.

Key variables:
- `OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`
- `OTEL_TRACES_EXPORTER`
- `OTEL_METRICS_EXPORTER`

### New Relic
Configuration file: `src/main/resources/newrelic.yml`

Key variables (override config file):
- `NEW_RELIC_LICENSE_KEY`
- `NEW_RELIC_APP_NAME`
- `NEW_RELIC_HOST`
- `NEW_RELIC_LOG_LEVEL`

## Verifying Agent Activation

Check application logs on startup:

```bash
./deploy.sh logs
```

### OpenTelemetry Enabled
```
Enabling OpenTelemetry Java Agent...
  ✓ OpenTelemetry agent configured
  - Service Name: HR-Portal
  - OTLP Endpoint: https://staging-otlp.nr-data.net:4318
```

### New Relic Enabled
```
Enabling New Relic Java APM Agent...
  ✓ New Relic agent configured
  - App Name: Oracle-HR-Portal-Java
  - Host: staging-collector.newrelic.com
```

## Troubleshooting

### No Data in New Relic (OTEL)
1. Check `OTEL_EXPORTER_OTLP_ENDPOINT` is set
2. Verify `OTEL_EXPORTER_OTLP_HEADERS` has valid API key
3. Check logs: `./deploy.sh logs | grep -i otel`
4. Ensure `USE_OTEL=true`

### No Data in New Relic (APM)
1. Check `NEW_RELIC_LICENSE_KEY` is set
2. Verify license key is valid
3. Check logs: `./deploy.sh logs | grep -i newrelic`
4. Ensure `USE_NEW_RELIC=true`

### Agent Not Loading
1. Verify environment variables: `docker compose exec oracle-test-app env | grep USE_`
2. Check agent files exist in container:
   ```bash
   docker compose exec oracle-test-app ls -la /app/*.jar
   docker compose exec oracle-test-app ls -la /app/newrelic/
   ```
3. Rebuild: `./deploy.sh rebuild`

### High Memory Usage
Both agents consume memory. If running both:
- Increase memory limit in docker-compose.yml
- Consider using only one agent
- Monitor with: `docker stats`

## Comparison: OpenTelemetry vs New Relic APM

### OpenTelemetry
**Pros:**
- Vendor-neutral, open standard
- Works with any OTLP-compatible backend
- Lighter weight
- Community-driven

**Cons:**
- Less Java-specific features
- Configuration via env vars only
- Limited custom instrumentation

**Best For:**
- Multi-vendor observability
- Cloud-native applications
- Kubernetes environments

### New Relic Java APM
**Pros:**
- Native New Relic integration
- Deep Java instrumentation
- Code-level metrics
- Advanced error analysis
- Application logs forwarding

**Cons:**
- Vendor-specific
- Slightly higher overhead
- Requires license key

**Best For:**
- New Relic-exclusive environments
- Deep application insights
- Production troubleshooting

## Recommendations

### Development
Use OpenTelemetry for development:
```bash
USE_OTEL=true
USE_NEW_RELIC=false
```

### Staging
Use New Relic APM for comprehensive testing:
```bash
USE_OTEL=false
USE_NEW_RELIC=true
```

### Production
Choose based on your observability strategy:
- **Multi-vendor**: Use OpenTelemetry
- **New Relic Only**: Use New Relic APM
- **Maximum Visibility**: Use both (with higher resource allocation)

## Getting Help

- OpenTelemetry Docs: https://opentelemetry.io/docs/instrumentation/java/
- New Relic Java Agent Docs: https://docs.newrelic.com/docs/apm/agents/java-agent/
- Check logs: `./deploy.sh logs`
- Test configuration: `./deploy.sh status`
