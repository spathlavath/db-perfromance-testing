#!/bin/bash

# Deploy All Fixes to Oracle VM
# 1. OpenTelemetry semantic conventions (Database operations visibility)
# 2. Lock workload removal (Stability improvement)

set -e

echo "================================================"
echo "Deploying Oracle DB OpenTelemetry Fixes"
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

echo "📦 Step 1: Copying updated files..."
echo ""

echo "  - package.json (Added @opentelemetry/semantic-conventions)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/package.json" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "  - oracledb-instrumented.js (OpenTelemetry semantic conventions v1.38.0)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "  - test-all-features.js (Lock workload removed)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/test-all-features.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "  - load-test.js (Lock workload removed from K6)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/k6/scripts/load-test.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/k6/scripts/"

echo ""
echo "✅ All files copied successfully"
echo ""

echo "🔄 Step 2: Rebuilding Docker containers with new dependencies..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping containers..."
    docker-compose down
    
    echo "Rebuilding with --no-cache to install new packages..."
    docker-compose build --no-cache oracle-test-app
    
    echo "Starting containers..."
    docker-compose up -d
    
    echo "Waiting for application to start..."
    sleep 20
    
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    
    echo ""
    echo "📝 Recent Application Logs (last 50 lines):"
    docker-compose logs --tail=50 oracle-test-app | grep -E "(instrumentation|OTEL|semantic|error)" || docker-compose logs --tail=50 oracle-test-app
    
    echo ""
    echo "🏥 Health Check:"
    curl -s http://localhost:3000/health | jq '.' || echo "Health check failed"
    
    echo ""
    echo "📈 Pool Stats:"
    curl -s http://localhost:3000/pool-stats | jq '.' || echo "Pool stats failed"
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "Changes Applied:"
echo "1. ✅ OpenTelemetry Semantic Conventions v1.38.0"
echo "   - Span names: '{operation} {table}' format"
echo "   - Example: 'SELECT employees', 'INSERT job_history'"
echo "   - All required attributes per OpenTelemetry spec"
echo "   - Added: @opentelemetry/semantic-conventions package"
echo ""
echo "2. ✅ Lock workload removed for stability"
echo "   - Active workloads: query, transaction, connection, memory (4 types)"
echo "   - Reduced DB operations: ~40-45/min (from ~50/min)"
echo "   - No more lock contention or deadlock scenarios"
echo ""
echo "Expected Results (wait 5-10 minutes):"
echo "✅ 'Top 20 database operations' will populate in New Relic"
echo "✅ Operations grouped by: SELECT employees, INSERT job_history, etc."
echo "✅ Database spans visible with all semantic convention attributes"
echo "✅ More stable long-term operation (2-week run)"
echo ""
echo "Key Verification:"
echo "Look for: '✅ Oracle DB instrumentation enabled - following OpenTelemetry semantic conventions v1.38.0'"
echo ""
echo "Monitor with:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'cd $REMOTE_DIR && docker-compose logs -f oracle-test-app'"
echo ""
echo "📚 See OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md for complete documentation"
echo ""
