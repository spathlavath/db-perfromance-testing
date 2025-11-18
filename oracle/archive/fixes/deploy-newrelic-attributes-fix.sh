#!/bin/bash

# CRITICAL FIX: Add New Relic APM-specific attributes for database operation display
# This ensures database operations appear in the breakdown table like MySQL does

set -e

echo "========================================================================"
echo "🔧 CRITICAL FIX: Add New Relic APM Database Attributes"
echo "========================================================================"
echo ""
echo "PROBLEM:"
echo "- Database spans were created but NOT shown in breakdown table"
echo "- Showed 'unknown - all' instead of 'Oracle employees select'"
echo "- MySQL shows 'MySQL departments select' properly"
echo ""
echo "ROOT CAUSE:"
echo "- New Relic APM requires LEGACY attributes alongside OTel conventions"
echo "- Missing: db.sql.table, db.operation, db.statement, db.instance"
echo ""
echo "SOLUTION:"
echo "- Keep OpenTelemetry semantic conventions (db.collection.name, etc.)"
echo "- ADD New Relic legacy attributes (db.sql.table, db.operation, etc.)"
echo "- This dual-attribute approach ensures compatibility with both standards"
echo ""
echo "========================================================================"
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

echo "📦 Step 1: Copy updated oracledb-instrumented.js with New Relic attributes..."
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

echo "✅ File copied"
echo ""

echo "🔄 Step 2: Restart Docker container to apply changes..."
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping container..."
    docker-compose stop oracle-test-app
    
    echo "Starting container..."
    docker-compose start oracle-test-app
    
    echo "Waiting for application..."
    sleep 15
    
    echo ""
    echo "📊 Container Status:"
    docker ps | grep oracle-test-app
    
    echo ""
    echo "🏥 Health Check:"
    curl -s http://localhost:3000/health | jq '.' || echo "Waiting for health check..."
    
    echo ""
    echo "📝 Verify instrumentation is loaded:"
    docker logs --tail=5 oracle-test-app-1 | grep "instrumentation" || echo "Check logs manually"
ENDSSH

echo ""
echo "========================================================================"
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================================================"
echo ""
echo "What was fixed:"
echo "1. Added 'db.sql.table' attribute (New Relic's legacy name for table)"
echo "2. Added 'db.operation' attribute (lowercase operation name)"
echo "3. Added 'db.statement' attribute (full SQL statement)"
echo "4. Added 'db.instance' attribute (connection string)"
echo "5. Added 'peer.hostname' attribute (database server hostname)"
echo ""
echo "Expected Result in New Relic:"
echo "- Breakdown table should now show:"
echo "  • 'Oracle employees select'"
echo "  • 'Oracle departments select'"
echo "  • 'Oracle job_history insert'"
echo "  • etc."
echo ""
echo "Next Steps:"
echo "1. Wait 3-5 minutes for new data to flow to New Relic"
echo "2. Click on any transaction (e.g., GET /employees)"
echo "3. Check 'Breakdown table' section"
echo "4. You should see 'Database' category with 'Oracle {table} {operation}'"
echo ""
echo "Monitor with:"
echo "  ssh -i $SSH_KEY $VM_USER@$VM_HOST 'docker logs -f oracle-test-app-1 | grep -i select'"
echo ""
echo "NRQL Query to verify attributes:"
echo "  FROM Span SELECT * WHERE db.system = 'oracle' LIMIT 1 SINCE 5 minutes ago"
echo ""
