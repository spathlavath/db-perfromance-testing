#!/bin/bash
# Quick Test Script for New Relic SQL Comment Prepending
# Run this on your Oracle VM after deploying the application

set -e

# Configuration
APP_HOST="localhost"
APP_PORT=3000
ORACLE_HOST="10.0.1.36"
ORACLE_PORT=1521
ORACLE_SERVICE="pdb1.privatesubnet.oracledb.oraclevcn.com"
ORACLE_USER="hr"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=================================================="
echo "New Relic SQL Comment Prepending - Quick Test"
echo "=================================================="
echo ""

# Step 1: Check if app is running
echo -e "${YELLOW}Step 1: Checking application status...${NC}"
if curl -s http://$APP_HOST:$APP_PORT/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is running${NC}"
else
    echo -e "${RED}✗ Application is not responding${NC}"
    echo "Start the application first: ./deploy.sh up"
    exit 1
fi
echo ""

# Step 2: Generate test traffic
echo -e "${YELLOW}Step 2: Generating test traffic...${NC}"

echo "  - GET /employees (SELECT with JOIN)"
curl -s http://$APP_HOST:$APP_PORT/employees > /dev/null
sleep 1

echo "  - GET /employees/100 (SELECT with WHERE)"
curl -s http://$APP_HOST:$APP_PORT/employees/100 > /dev/null 2>&1 || true
sleep 1

echo "  - GET /departments (SELECT departments)"
curl -s http://$APP_HOST:$APP_PORT/departments > /dev/null
sleep 1

echo "  - GET /departments/10/employees (SELECT with JOIN and WHERE)"
curl -s http://$APP_HOST:$APP_PORT/departments/10/employees > /dev/null 2>&1 || true
sleep 1

echo "  - GET /reports/salary-by-department (Complex aggregate query)"
curl -s http://$APP_HOST:$APP_PORT/reports/salary-by-department > /dev/null
sleep 1

echo "  - GET /employees/101/history (Job history query)"
curl -s http://$APP_HOST:$APP_PORT/employees/101/history > /dev/null 2>&1 || true
sleep 1

echo -e "${GREEN}✓ Test traffic generated${NC}"
echo ""

# Step 3: Check application logs
echo -e "${YELLOW}Step 3: Checking application logs for New Relic agent...${NC}"
if docker logs oracle-test-app 2>&1 | grep -i "New Relic Agent" | head -1; then
    echo -e "${GREEN}✓ New Relic agent is loaded${NC}"
else
    echo -e "${RED}⚠ New Relic agent may not be loaded${NC}"
fi
echo ""

# Step 4: Instructions for Oracle SQL verification
echo -e "${YELLOW}Step 4: Verify SQL comments in Oracle${NC}"
echo ""
echo "Now run these SQL queries in Oracle to check for prepended comments:"
echo ""
echo "Connect to Oracle:"
echo "  sqlplus $ORACLE_USER@//$ORACLE_HOST:$ORACLE_PORT/$ORACLE_SERVICE"
echo ""
echo "Then run the SQL queries in: check_sql_comments.sql"
echo ""
echo "OR if you have sqlplus available, run:"
echo "  ./check_sql_comments.sh"
echo ""

# Step 5: Show recent application logs
echo -e "${YELLOW}Step 5: Recent application logs (last 30 lines):${NC}"
echo "========================================"
docker logs oracle-test-app 2>&1 | tail -30
echo "========================================"
echo ""

echo -e "${GREEN}Test script completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Check Oracle v\$sql for comments with trace_id and span_id"
echo "2. Review full logs: docker logs oracle-test-app"
echo "3. Check New Relic UI for transaction traces"
echo ""
echo "For detailed testing guide, see: NEWRELIC_SQL_COMMENT_TEST_GUIDE.md"
