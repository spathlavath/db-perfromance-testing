#!/bin/bash

# CRITICAL FIX: Generate Database Metrics from Spans
# New Relic's "Top 20 database operations" view requires METRICS, not just SPANS
# This adds a span processor that generates apm.service.datastore.operation.duration metrics

set -e

echo "================================================"
echo "Deploying Database Metrics Generation Fix"
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

echo "📦 Copying fixed files..."
echo "   1. tracing.js (with database metrics span processor)"
echo "   2. oracledb-instrumented.js (with context propagation)"
echo ""

scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/tracing.js" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "✅ Files copied"
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
    echo "📝 Startup logs (checking for metrics processor):"
    docker logs --tail=30 oracle-test-app-1 | grep -E "(instrumentation|metrics|processor|Database)" || echo "No specific logs yet"
ENDSSH

echo ""
echo "================================================"
echo "✅ Database Metrics Fix Deployed!"
echo "================================================"
echo ""
echo "What was fixed:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 PROBLEM IDENTIFIED:"
echo "   - Database SPANS were being created correctly ✅"
echo "   - But New Relic's 'Top 20 database operations' queries METRICS"
echo "   - NRQL: FROM Metric WHERE apm.service.datastore.operation.duration"
echo "   - We were only sending spans, not metrics!"
echo ""
echo "🔧 SOLUTION IMPLEMENTED:"
echo "   1. Added DatabaseMetricsSpanProcessor"
echo "   2. Processes every database span (SpanKind.CLIENT + db.system)"
echo "   3. Generates metric: apm.service.datastore.operation.duration"
echo "   4. Includes attributes: db.system, db.operation, db.sql.table"
echo ""
echo "📊 EXPECTED RESULTS:"
echo "   - Metrics exported every 60 seconds"
echo "   - 'Top 20 database operations' will populate"
echo "   - 'Database queries' tab will show queries"
echo "   - Spans AND metrics both visible"
echo ""
echo "⏰ TIMELINE:"
echo "   - Wait 2-3 minutes for new metrics to be generated"
echo "   - Metrics export every 60 seconds"
echo "   - Allow 1-2 minutes for New Relic processing"
echo ""
echo "🧪 VERIFICATION:"
echo ""
echo "1. Check for database metrics:"
echo "   FROM Metric SELECT count(*) WHERE metricName = 'apm.service.datastore.operation.duration' SINCE 5 minutes ago"
echo ""
echo "2. Check top database operations:"
echo "   FROM Metric SELECT sum(apm.service.datastore.operation.duration) FACET db.system, db.sql.table, db.operation SINCE 5 minutes ago"
echo ""
echo "3. Navigate to: APM & Services → Oracle-HR-Portal → Databases"
echo "   Should now see 'Top 20 database operations' populated!"
echo ""
echo "Monitor logs:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'docker logs -f oracle-test-app-1'"
echo ""
