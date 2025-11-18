#!/bin/bash

# CRITICAL: Verify Database Instrumentation on VM
# Run this on the VM to check if oracledb-instrumented.js is working

echo "🔍 Verifying Database Instrumentation on VM"
echo "============================================"
echo ""

VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"

echo "1. Check if oracledb-instrumented.js exists..."
ssh -i "$SSH_KEY" opc@$VM_HOST << 'ENDSSH'
    if [ -f ~/db-perfromance-testing/oracle/services/oracledb-instrumented.js ]; then
        echo "✅ File exists"
        echo ""
        echo "2. Check for instrumentation message in file..."
        if grep -q "Oracle DB instrumentation enabled" ~/db-perfromance-testing/oracle/services/oracledb-instrumented.js; then
            echo "✅ Instrumentation message found in file"
        else
            echo "❌ Instrumentation message NOT found!"
        fi
    else
        echo "❌ File does NOT exist!"
    fi
    
    echo ""
    echo "3. Check if app.js requires the instrumented version..."
    if grep -q "require('./oracledb-instrumented')" ~/db-perfromance-testing/oracle/services/app.js; then
        echo "✅ app.js requires instrumented version"
    else
        echo "❌ app.js requires regular oracledb!"
        grep "require.*oracledb" ~/db-perfromance-testing/oracle/services/app.js
    fi
    
    echo ""
    echo "4. Check container logs for instrumentation message..."
    if docker logs oracle-oracle-test-app-1 2>&1 | grep -q "Oracle DB instrumentation enabled"; then
        echo "✅ Instrumentation message found in logs"
        docker logs oracle-oracle-test-app-1 2>&1 | grep "Oracle DB instrumentation"
    else
        echo "❌ Instrumentation message NOT in logs!"
        echo ""
        echo "Last 30 lines of container logs:"
        docker logs --tail=30 oracle-oracle-test-app-1 2>&1
    fi
    
    echo ""
    echo "5. Check if semantic-conventions is installed..."
    if docker exec oracle-oracle-test-app-1 ls /usr/src/app/node_modules/@opentelemetry/semantic-conventions 2>/dev/null; then
        echo "✅ semantic-conventions installed"
    else
        echo "❌ semantic-conventions NOT installed!"
    fi
    
    echo ""
    echo "6. Check if the file in container matches local..."
    echo "First line of instrumented file in container:"
    docker exec oracle-oracle-test-app-1 head -n 1 /usr/src/app/services/oracledb-instrumented.js
ENDSSH

echo ""
echo "============================================"
echo "If any checks fail, the instrumentation isn't working!"
echo ""
