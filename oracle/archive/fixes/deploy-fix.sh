#!/bin/bash
# Deploy database span context fix to VM

set -e

echo "================================================"
echo "Deploying Database Span Context Fix"
echo "================================================"

VM_USER="opc"
VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"
REMOTE_DIR="~/db-perfromance-testing/oracle"

echo "📦 Step 1: Copy tracing.js (simplified version)..."
scp -i "$SSH_KEY" \
    services/tracing.js \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "📦 Step 2: Copy oracledb-instrumented.js (with context propagation)..."
scp -i "$SSH_KEY" \
    services/oracledb-instrumented.js \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo ""
echo "🔄 Step 3: Restart Docker container..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    docker-compose restart oracle-test-app
    sleep 5
    
    echo ""
    echo "✅ Container Status:"
    docker ps | grep oracle-test-app
    
    echo ""
    echo "📝 Application Logs (last 30 lines):"
    docker logs --tail=30 oracle-test-app-1
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "What was deployed:"
echo "1. ✅ Simplified tracing.js (New Relic auto-generates DB metrics)"
echo "2. ✅ oracledb-instrumented.js with context propagation fix"
echo ""
echo "The fix ensures database spans are children of HTTP spans."
echo "This makes them appear in New Relic's Database queries tab."
echo ""
echo "Wait 2-3 minutes, then check New Relic:"
echo "- APM & Services → Oracle-HR-Portal → Databases"
echo "- You should see database operations grouped by table"
echo ""
