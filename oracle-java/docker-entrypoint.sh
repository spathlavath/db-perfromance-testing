#!/bin/sh

# Docker entrypoint script to start Java application with appropriate agent
# Supports both OpenTelemetry and New Relic APM agents

set -e

# Base Java options
JAVA_OPTS="-Xms512m -Xmx2048m -Djava.security.egd=file:/dev/./urandom"

# Determine which agent to use based on environment variables
USE_NEW_RELIC="${USE_NEW_RELIC:-false}"
USE_OTEL="${USE_OTEL:-true}"

echo "=========================================="
echo "Starting Oracle HR Portal Java Application"
echo "=========================================="
echo "USE_NEW_RELIC: $USE_NEW_RELIC"
echo "USE_OTEL: $USE_OTEL"
echo ""

# Build java agent arguments
AGENT_ARGS=""

if [ "$USE_NEW_RELIC" = "true" ]; then
    echo "Enabling New Relic Java APM Agent..."
    if [ -n "$NEW_RELIC_LICENSE_KEY" ]; then
        AGENT_ARGS="$AGENT_ARGS -javaagent:/app/newrelic/newrelic.jar"
        echo "  ✓ New Relic agent configured"
        echo "  - App Name: ${NEW_RELIC_APP_NAME:-Oracle-HR-Portal-Java}"
        echo "  - Host: ${NEW_RELIC_HOST:-collector.newrelic.com}"
    else
        echo "  ⚠ Warning: NEW_RELIC_LICENSE_KEY not set, skipping New Relic agent"
    fi
fi

if [ "$USE_OTEL" = "true" ]; then
    echo "Enabling OpenTelemetry Java Agent..."
    if [ -n "$OTEL_EXPORTER_OTLP_ENDPOINT" ]; then
        AGENT_ARGS="$AGENT_ARGS -javaagent:/app/opentelemetry-javaagent.jar"
        echo "  ✓ OpenTelemetry agent configured"
        echo "  - Service Name: ${OTEL_SERVICE_NAME:-HR-Portal}"
        echo "  - OTLP Endpoint: $OTEL_EXPORTER_OTLP_ENDPOINT"
    else
        echo "  ⚠ Warning: OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping OTEL agent"
    fi
fi

if [ -z "$AGENT_ARGS" ]; then
    echo "No agents configured, starting without instrumentation"
fi

echo ""
echo "Starting application..."
echo "=========================================="
echo ""

# Start the application
exec java $JAVA_OPTS $AGENT_ARGS -jar /app/app.jar
