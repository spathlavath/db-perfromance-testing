#!/bin/bash

echo "================================================"
echo "OpenTelemetry Integration Test"
echo "================================================"
echo ""

echo "1. Checking if application is running..."
if docker ps | grep -q oracle-test-app; then
    echo "   ✅ Application container is running"
else
    echo "   ❌ Application container is NOT running"
    exit 1
fi
echo ""

echo "2. Checking OTEL environment variables in container..."
docker exec oracle-oracle-test-app-1 env | grep OTEL
echo ""

echo "3. Checking application logs for OTEL initialization..."
docker logs oracle-oracle-test-app-1 2>&1 | grep -E "OpenTelemetry|OTEL|Exporting to"
echo ""

echo "4. Testing application health..."
HEALTH=$(curl -s http://localhost:3000/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo "   ✅ Application is healthy"
    echo "   Response: $HEALTH"
else
    echo "   ❌ Application health check failed"
    echo "   Response: $HEALTH"
fi
echo ""

echo "5. Testing OTLP endpoint connectivity..."
ENDPOINT_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://staging-otlp.nr-data.net:4318/v1/traces \
    -H "Content-Type: application/x-protobuf" \
    -H "api-key: 2d8fd61a6a207b8d52ed5d52c9acdcefFFFFNRAL" \
    -d "" 2>&1)

echo "   HTTP Status Code: $ENDPOINT_TEST"
if [ "$ENDPOINT_TEST" = "200" ] || [ "$ENDPOINT_TEST" = "202" ] || [ "$ENDPOINT_TEST" = "400" ]; then
    echo "   ✅ OTLP endpoint is reachable"
else
    echo "   ⚠️  OTLP endpoint returned: $ENDPOINT_TEST"
fi
echo ""

echo "6. Checking for OTLP export errors in logs..."
ERROR_COUNT=$(docker logs oracle-oracle-test-app-1 2>&1 | grep -iE "otlp.*error|export.*failed" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "   ✅ No OTLP export errors found"
else
    echo "   ⚠️  Found $ERROR_COUNT potential OTLP errors:"
    docker logs oracle-oracle-test-app-1 2>&1 | grep -iE "otlp.*error|export.*failed" | tail -5
fi
echo ""

echo "7. Generating test traffic..."
curl -s -X POST http://localhost:3000/workload/start \
    -H "Content-Type: application/json" \
    -d '{"type": "query", "intensity": "low", "duration": 30}' > /dev/null

echo "   ✅ Started query workload for 30 seconds"
echo "   💡 Monitor New Relic staging for incoming telemetry data"
echo ""

echo "8. Connection pool stats..."
curl -s http://localhost:3000/pool-stats | head -20
echo ""

echo "================================================"
echo "Test Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Check New Relic staging: https://staging.newrelic.com/"
echo "2. Look for service: Oracle-HR-Portal"
echo "3. View Distributed Tracing and Metrics Explorer"
echo "4. Monitor logs: docker-compose logs -f oracle-test-app"
echo ""
