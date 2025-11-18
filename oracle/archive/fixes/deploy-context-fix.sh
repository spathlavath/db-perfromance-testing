#!/bin/bash

# Critical Fix: Link Database Spans to Active Context
# This ensures database spans are exported as children of HTTP spans

set -e

echo "================================================"
echo "Deploying Critical Database Span Context Fix"
echo "================================================"
echo ""

# Configuration
VM_USER="opc"
VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"
REMOTE_DIR="~/db-perfromance-testing/oracle"
LOCAL_DIR="/Users/spathlavath/otel/db-perfromance-testing/oracle"

# Check SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ ERROR: SSH key not found at $SSH_KEY"
    exit 1
fi

echo "📦 Copying fixed oracledb-instrumented.js..."
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "✅ File copied"
echo ""

echo "🔄 Restarting Docker container..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping container..."
    docker-compose stop oracle-test-app
    
    echo "Starting container..."
    docker-compose start oracle-test-app
    
    echo "Waiting for application..."
    sleep 10
    
    echo ""
    echo "📊 Container Status:"
    docker ps | grep oracle-test-app
    
    echo ""
    echo "🏥 Health Check:"
    curl -s http://localhost:3000/health | jq '.' || echo "Waiting..."
    
    echo ""
    echo "📝 Check for context fix in logs:"
    docker logs --tail=20 oracle-test-app-1 | grep -E "(instrumentation|context|active)" || echo "No specific logs yet"
ENDSSH

echo ""
echo "================================================"
echo "✅ Critical Fix Deployed!"
echo "================================================"
echo ""
echo "What was fixed:"
echo "- Database spans now start in the active context"
echo "- Spans are properly linked to parent HTTP spans"
echo "- context.with() wraps execution to maintain context"
echo ""
echo "Next steps:"
echo "1. Wait 2-3 minutes for new spans to be generated"
echo "2. Run this NRQL query in New Relic:"
echo ""
echo "   FROM Span SELECT count(*) WHERE db.system = 'oracle' SINCE 5 minutes ago"
echo ""
echo "3. You should now see database spans!"
echo ""
echo "Monitor logs with:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'docker logs -f oracle-test-app-1'"
echo ""
