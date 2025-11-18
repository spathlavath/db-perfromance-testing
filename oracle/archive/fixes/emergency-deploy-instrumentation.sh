#!/bin/bash

# EMERGENCY FIX: Deploy oracledb-instrumented.js to VM and Restart

set -e

echo "🚨 EMERGENCY: Deploying Database Instrumentation"
echo "================================================"
echo ""

VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"
LOCAL_FILE="/Users/spathlavath/otel/db-perfromance-testing/oracle/services/oracledb-instrumented.js"

# Verify local file exists
if [ ! -f "$LOCAL_FILE" ]; then
    echo "❌ ERROR: Local file not found: $LOCAL_FILE"
    exit 1
fi

echo "✅ Local file exists"
echo ""

# Check if file has instrumentation code
if grep -q "Oracle DB instrumentation enabled" "$LOCAL_FILE"; then
    echo "✅ Local file has instrumentation code"
else
    echo "❌ ERROR: Local file missing instrumentation code!"
    exit 1
fi

echo ""
echo "📦 Step 1: Copying oracledb-instrumented.js to VM..."
scp -i "$SSH_KEY" "$LOCAL_FILE" "opc@$VM_HOST:~/db-perfromance-testing/oracle/services/"

echo "✅ File copied to VM"
echo ""

echo "🔄 Step 2: Stopping container..."
ssh -i "$SSH_KEY" "opc@$VM_HOST" "cd ~/db-perfromance-testing/oracle && docker-compose stop oracle-test-app"

echo "✅ Container stopped"
echo ""

echo "🔄 Step 3: Starting container..."
ssh -i "$SSH_KEY" "opc@$VM_HOST" "cd ~/db-perfromance-testing/oracle && docker-compose start oracle-test-app"

echo "✅ Container started"
echo ""

echo "⏳ Step 4: Waiting 10 seconds for startup..."
sleep 10

echo ""
echo "🔍 Step 5: Verifying deployment..."
ssh -i "$SSH_KEY" "opc@$VM_HOST" << 'ENDSSH'
    echo "Checking file in container..."
    if docker exec oracle-oracle-test-app-1 test -f /usr/src/app/services/oracledb-instrumented.js; then
        echo "✅ File exists in container"
        
        if docker exec oracle-oracle-test-app-1 grep -q "Oracle DB instrumentation enabled" /usr/src/app/services/oracledb-instrumented.js; then
            echo "✅ File has instrumentation code"
        else
            echo "❌ File exists but missing instrumentation code!"
            exit 1
        fi
        
        echo ""
        echo "Checking container logs for instrumentation message..."
        if docker logs oracle-oracle-test-app-1 2>&1 | tail -50 | grep -q "Oracle DB instrumentation enabled"; then
            echo "✅ Instrumentation loaded successfully!"
            docker logs oracle-oracle-test-app-1 2>&1 | grep "Oracle DB instrumentation"
        else
            echo "⚠️  Instrumentation message not in logs yet (may still be starting)"
            echo ""
            echo "Recent logs:"
            docker logs --tail=20 oracle-oracle-test-app-1 2>&1
        fi
    else
        echo "❌ File NOT in container!"
        exit 1
    fi
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for new requests to generate database spans"
echo "2. Run this NRQL query:"
echo ""
echo "FROM Span"
echo "SELECT count(*)"
echo "WHERE service.name = 'HR-Portal'"
echo "  AND span.kind = 'client'"
echo "  AND db.system IS NOT NULL"
echo "SINCE 5 minutes ago"
echo "FACET name"
echo ""
echo "You should now see database operations!"
echo ""
