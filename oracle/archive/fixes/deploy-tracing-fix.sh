#!/bin/bash

# Fix: sdk.start() doesn't return a promise - call it synchronously

set -e

echo "================================================"
echo "Deploying Tracing.js Fix"
echo "================================================"

VM_USER="opc"
VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"
REMOTE_DIR="~/db-perfromance-testing/oracle"
LOCAL_DIR="/Users/spathlavath/otel/db-perfromance-testing/oracle"

echo "📦 Copying fixed tracing.js..."
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/tracing.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "✅ File copied"
echo ""

echo "🔄 Restarting Docker container..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping containers..."
    docker-compose down
    
    echo "Starting containers..."
    docker-compose up -d
    
    echo "Waiting for application to start..."
    sleep 15
    
    echo ""
    echo "📊 Container Status:"
    docker ps | grep oracle
    
    echo ""
    echo "📝 Application Logs:"
    docker logs --tail=30 oracle-oracle-test-app-1
ENDSSH

echo ""
echo "✅ Deployment Complete!"
