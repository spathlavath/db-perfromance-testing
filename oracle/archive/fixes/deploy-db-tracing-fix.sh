#!/bin/bash

# Deploy Database Tracing Fix to Oracle VM
# This script copies the updated instrumentation file and restarts containers

set -e

echo "================================================"
echo "Deploying Oracle DB Tracing Fix"
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

echo "📦 Step 1: Copying updated instrumentation file..."
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "✅ File copied successfully"
echo ""

echo "🔄 Step 2: Restarting Docker containers..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping containers..."
    docker-compose down
    
    echo "Rebuilding and starting containers..."
    docker-compose up --build -d
    
    echo "Waiting for application to start..."
    sleep 15
    
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    
    echo ""
    echo "📝 Recent Application Logs:"
    docker-compose logs --tail=30 oracle-test-app | grep -E "(✅|Oracle DB instrumentation|OTEL|tracing)" || echo "No specific logs found yet"
    
    echo ""
    echo "🏥 Health Check:"
    curl -s http://localhost:3000/health | jq '.' || echo "Health check failed"
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Wait 5-10 minutes for data to appear in New Relic"
echo "2. Check 'Databases' view in APM for database operations"
echo "3. Check 'Transactions' view for detailed queries"
echo "4. Look for transaction names like:"
echo "   - Datastore/statement/Oracle/employees/SELECT"
echo "   - Datastore/statement/Oracle/departments/SELECT"
echo "   - Datastore/statement/Oracle/job_history/INSERT"
echo ""
echo "🔍 Monitor logs with:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'cd $REMOTE_DIR && docker-compose logs -f oracle-test-app'"
echo ""
