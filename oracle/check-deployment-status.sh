#!/bin/bash

# Check Current Deployment Status
# Run this on the VM to see what version is deployed

echo "=== Checking Oracle DB Instrumentation Version ==="
echo ""

# Check if semantic-conventions package is installed
echo "1. Checking for @opentelemetry/semantic-conventions package:"
if [ -f "/app/node_modules/@opentelemetry/semantic-conventions/package.json" ]; then
    echo "✅ Package found"
    cat /app/node_modules/@opentelemetry/semantic-conventions/package.json | grep '"version"' | head -1
else
    echo "❌ Package NOT found - OLD VERSION DEPLOYED"
fi

echo ""
echo "2. Checking instrumentation message:"
docker logs oracle-oracle-test-app-1 2>&1 | grep -i "instrumentation enabled" | tail -1

echo ""
echo "3. Checking for semantic conventions import:"
docker exec oracle-oracle-test-app-1 grep -n "semantic-conventions" /app/oracledb-instrumented.js 2>/dev/null || echo "❌ semantic-conventions NOT imported - OLD VERSION"

echo ""
echo "4. Checking package.json for semantic-conventions:"
docker exec oracle-oracle-test-app-1 grep "semantic-conventions" /app/package.json 2>/dev/null || echo "❌ NOT in package.json - OLD VERSION"

echo ""
echo "=== CONCLUSION ==="
echo "If you see '❌ OLD VERSION' messages above, you need to deploy the fixes."
echo "Run: ./deploy-all-fixes.sh"
