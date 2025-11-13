#!/bin/bash

# Verify Semantic Conventions Deployment
# Run this on your VM to check if the new code is active

echo "================================================"
echo "Verifying OpenTelemetry Semantic Conventions"
echo "================================================"
echo ""

echo "1. Checking instrumentation startup message:"
docker logs oracle-oracle-test-app-1 2>&1 | grep "instrumentation enabled" | tail -1
echo ""

echo "2. Checking if semantic-conventions package exists:"
docker exec oracle-oracle-test-app-1 ls -la /app/node_modules/@opentelemetry/semantic-conventions 2>/dev/null && echo "✅ Package found" || echo "❌ Package NOT found"
echo ""

echo "3. Checking oracledb-instrumented.js for new imports:"
docker exec oracle-oracle-test-app-1 head -20 /app/oracledb-instrumented.js | grep -E "semantic-conventions|ATTR_DB"
echo ""

echo "4. Checking for SpanKind usage (new code):"
docker exec oracle-oracle-test-app-1 grep -n "SpanKind.CLIENT" /app/oracledb-instrumented.js | head -2
echo ""

echo "5. Sample recent database span names from logs:"
docker logs oracle-oracle-test-app-1 2>&1 | grep -E "SELECT|INSERT|UPDATE|DELETE" | tail -5
echo ""

echo "6. Checking New Relic with NRQL (copy this query):"
echo ""
echo "FROM Span SELECT count(*) WHERE db.system = 'oracle' FACET name SINCE 10 minutes ago LIMIT 20"
echo ""

echo "================================================"
echo "If you see the new format, wait 5-10 minutes for"
echo "New Relic to populate the Database Operations view"
echo "================================================"
