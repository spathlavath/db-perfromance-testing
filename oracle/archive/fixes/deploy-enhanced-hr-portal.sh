#!/bin/bash

# ============================================================================
# Deploy Enhanced Oracle HR Portal with Multiple Endpoints
# ============================================================================
# This deployment includes:
# - 10 realistic HR portal endpoints demonstrating different DB operations
# - Context-aware database spans that link to parent HTTP spans
# - Comprehensive K6 load test exercising all endpoints
# - Clean OpenTelemetry configuration for New Relic
# ============================================================================

set -e

echo "================================================"
echo "🚀 Deploying Enhanced Oracle HR Portal"
echo "================================================"
echo ""

# Configuration
VM_USER="opc"
VM_HOST="150.136.71.213"
SSH_KEY="$HOME/Downloads/ssh-key-2025-11-03.key"
REMOTE_DIR="~/db-perfromance-testing/oracle"
LOCAL_DIR="/Users/spathlavath/otel/db-perfromance-testing/oracle"

# Check SSH key
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ ERROR: SSH key not found at $SSH_KEY"
    exit 1
fi

echo "📦 Step 1: Copying updated files to VM..."
echo ""

# Copy updated app.js with 10 new endpoints
echo "  → app.js (10 realistic HR endpoints)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/app.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

# Copy simplified tracing.js
echo "  → tracing.js (simplified OpenTelemetry config)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/tracing.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

# Copy context-aware oracledb-instrumented.js
echo "  → oracledb-instrumented.js (context propagation fix)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/services/oracledb-instrumented.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/services/"

# Copy new K6 load test script
echo "  → hr-portal-load-test.js (comprehensive load test)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/k6/scripts/hr-portal-load-test.js" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/k6/scripts/"

# Copy updated docker-compose.yml
echo "  → docker-compose.yml (updated K6 configuration)"
scp -i "$SSH_KEY" \
    "$LOCAL_DIR/docker-compose.yml" \
    "$VM_USER@$VM_HOST:$REMOTE_DIR/"

echo ""
echo "✅ Files copied successfully"
echo ""

echo "🔄 Step 2: Restarting containers on VM..."
echo ""

ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" << 'ENDSSH'
    cd ~/db-perfromance-testing/oracle
    
    echo "Stopping containers..."
    docker-compose down
    
    echo ""
    echo "Starting containers with new configuration..."
    docker-compose up -d
    
    echo ""
    echo "Waiting for application to start..."
    sleep 15
    
    echo ""
    echo "📊 Container Status:"
    docker-compose ps
    
    echo ""
    echo "🏥 Health Check:"
    curl -s http://localhost:3000/health | jq '.' || echo "Waiting for app..."
    
    echo ""
    echo "📝 Recent Application Logs:"
    docker logs --tail=30 oracle-test-app-1
    
    echo ""
    echo "📝 K6 Load Test Status:"
    docker logs --tail=20 k6-1 | tail -10 || echo "K6 starting..."
    
ENDSSH

echo ""
echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "🎯 What's New:"
echo ""
echo "📋 10 Realistic HR Portal Endpoints:"
echo "   1. GET  /employees - List all employees (SELECT with JOIN)"
echo "   2. GET  /employees/:id - Employee details (SELECT with multiple JOINs)"
echo "   3. POST /employees - Create employee (INSERT)"
echo "   4. PUT  /employees/:id - Update employee (UPDATE)"
echo "   5. GET  /employees/:id/history - Job history (SELECT with date filter)"
echo "   6. POST /employees/:id/promote - Promote employee (Transaction)"
echo "   7. GET  /departments - Department stats (SELECT with aggregation)"
echo "   8. GET  /departments/:id/employees - Dept employees (SELECT with filter)"
echo "   9. GET  /jobs - List jobs (Simple SELECT)"
echo "   10. GET /reports/salary-by-department - Analytics (Complex aggregation)"
echo ""
echo "🔧 Technical Improvements:"
echo "   ✓ Database spans linked to parent HTTP spans (context propagation)"
echo "   ✓ OpenTelemetry semantic conventions v1.38.0"
echo "   ✓ Simplified tracing configuration (no custom metrics needed)"
echo "   ✓ Comprehensive K6 load test exercising all endpoints"
echo ""
echo "📊 Load Test Distribution:"
echo "   • 30% - List employees"
echo "   • 25% - Employee details"
echo "   • 15% - Department stats"
echo "   • 10% - Department employees"
echo "   • 5%  - Salary reports"
echo "   • 5%  - Jobs list"
echo "   • 5%  - Job history"
echo "   • 3%  - Update employee"
echo "   • 1%  - Create employee"
echo "   • 1%  - Promote employee"
echo ""
echo "🔍 Verify in New Relic (wait 2-3 minutes):"
echo ""
echo "1. Check Transactions:"
echo "   APM & Services → Oracle-HR-Portal → Transactions"
echo "   You should see 10+ different endpoints!"
echo ""
echo "2. Check Database Operations:"
echo "   APM & Services → Oracle-HR-Portal → Databases"
echo "   Should show: SELECT employees, UPDATE employees, INSERT employees, etc."
echo ""
echo "3. Check Distributed Tracing:"
echo "   APM & Services → Oracle-HR-Portal → Distributed tracing"
echo "   Click any trace → Should see database spans as children of HTTP spans"
echo ""
echo "4. Run NRQL Query:"
echo "   FROM Span SELECT count(*) WHERE db.system = 'oracle' "
echo "   FACET name SINCE 10 minutes ago"
echo ""
echo "📝 Monitor logs:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'docker logs -f oracle-test-app-1'"
echo ""
echo "🔍 Check K6 load generation:"
echo "ssh -i $SSH_KEY $VM_USER@$VM_HOST 'docker logs -f k6-1'"
echo ""
