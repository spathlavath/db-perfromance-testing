#!/bin/bash
# Complete Setup and Test Script for HR Workload Simulator
# Run this on your VM to set up everything and test the receiver

set -e

echo "=========================================="
echo "HR Workload Simulator - Complete Setup"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'


echo -e "${BLUE}Step 1: Verify Go installation${NC}"
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+"
    exit 1
fi
echo "✅ Go $(go version | awk '{print $3}')"
echo ""

echo -e "${BLUE}Step 2: Set up environment variables${NC}"
cat > .env << 'EOF'
ORACLE_USER=hr
ORACLE_PASSWORD=NewRelic_PW_7663_
ORACLE_CONNECT_STRING=10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com
EOF
echo "✅ Created .env file with credentials"
echo ""

echo -e "${BLUE}Step 3: Build the simulator${NC}"
chmod +x run-simulator.sh
./run-simulator.sh build
echo ""

echo -e "${BLUE}Step 4: Test database connection${NC}"
./run-simulator.sh test
echo ""

echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Quick test (5 minutes):"
echo "   ./run-simulator.sh run"
echo ""
echo "2. Medium load (15 minutes):"
echo "   ./run-simulator.sh medium"
echo ""
echo "3. Verify workload (in another terminal):"
echo "   sqlplus hr/NewRelic_PW_7663_@10.0.1.36:1521/pdb1.privatesubnet.oracledb.oraclevcn.com @verify_workload.sql"
echo ""
echo "4. Start your receiver (in another terminal):"
echo "   cd /Users/spathlavath/otel/opentelemetry-collector-contrib"
echo "   ./bin/otelcol_linux_amd64 --config=your-config.yaml"
echo ""
echo "Ready to test? Run: ./run-simulator.sh run"
echo ""
