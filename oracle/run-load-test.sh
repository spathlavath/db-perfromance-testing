#!/bin/bash

# Load Test Runner with Appropriate Connection Pool Sizing
# This script automatically sets connection pool sizes based on test intensity

set -e

INTENSITY=${1:-medium}

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Oracle K6 Load Test Runner with Auto-Scaling          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Set connection pool based on intensity
# NOTE: Pool size fixed at 80 for 4-core Oracle DB (CPU cores × 20 = 80)
# VUs will share these 80 connections through connection pooling with queuing
case $INTENSITY in
  low)
    POOL_MAX=80
    POOL_MIN=20
    MAX_VUS=50
    ;;
  medium)
    POOL_MAX=80
    POOL_MIN=20
    MAX_VUS=100
    ;;
  high)
    POOL_MAX=80
    POOL_MIN=20
    MAX_VUS=200
    ;;
  stress)
    POOL_MAX=80
    POOL_MIN=20
    MAX_VUS=300
    ;;
  max)
    POOL_MAX=80
    POOL_MIN=20
    MAX_VUS=400
    ;;
  *)
    echo -e "${RED}❌ Invalid intensity: $INTENSITY${NC}"
    echo -e "${YELLOW}Usage: ./run-load-test.sh [low|medium|high|stress|max]${NC}"
    exit 1
    ;;
esac

echo -e "${GREEN}📊 Test Configuration:${NC}"
echo -e "   Intensity Level: ${YELLOW}$INTENSITY${NC}"
echo -e "   Max Virtual Users: ${YELLOW}$MAX_VUS${NC}"
echo -e "   Connection Pool Min: ${YELLOW}$POOL_MIN${NC}"
echo -e "   Connection Pool Max: ${YELLOW}$POOL_MAX${NC}"
echo -e "   Pool/VU Ratio: ${YELLOW}$(echo "scale=1; $POOL_MAX/$MAX_VUS*100" | bc)%${NC}"
echo ""

# Warning for stress/max tests
if [[ "$INTENSITY" == "stress" ]] || [[ "$INTENSITY" == "max" ]]; then
    echo -e "${YELLOW}⚠️  WARNING: $INTENSITY intensity test will consume significant resources!${NC}"
    echo -e "${YELLOW}   - Pool connections: $POOL_MAX${NC}"
    echo -e "${YELLOW}   - Ensure your Oracle DB can handle this many sessions${NC}"
    echo ""
    read -p "Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Test cancelled.${NC}"
        exit 0
    fi
fi

echo -e "${BLUE}🔄 Stopping existing containers...${NC}"
docker-compose down

echo ""
echo -e "${BLUE}🚀 Starting services with optimized pool size...${NC}"
export TEST_INTENSITY=$INTENSITY
export POOL_MAX=$POOL_MAX
export POOL_MIN=$POOL_MIN
export POOL_INCREMENT=50
export QUEUE_TIMEOUT=60000
export POOL_TIMEOUT=30

docker-compose up -d oracle-test-app

echo ""
echo -e "${GREEN}✅ Application started with pool configuration${NC}"
echo -e "${YELLOW}⏳ Waiting 10 seconds for application to initialize...${NC}"
sleep 10

echo ""
echo -e "${BLUE}🧪 Running K6 Load Test...${NC}"
docker-compose up k6

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Test Complete!                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📋 Test Summary:${NC}"
echo -e "   Intensity: ${YELLOW}$INTENSITY${NC}"
echo -e "   Pool Size: ${YELLOW}$POOL_MIN-$POOL_MAX${NC}"
echo -e "   Max VUs: ${YELLOW}$MAX_VUS${NC}"
echo ""
echo -e "${BLUE}💡 Next Steps:${NC}"
echo -e "   • Check application logs: ${YELLOW}docker-compose logs oracle-test-app${NC}"
echo -e "   • Check resource usage in your monitoring dashboard"
echo -e "   • Run different intensity: ${YELLOW}./run-load-test.sh [low|medium|high|stress|max]${NC}"
echo ""
echo -e "${BLUE}📊 Resource Expectations for $INTENSITY:${NC}"

case $INTENSITY in
  low|medium)
    echo -e "   • CPU: Moderate usage (10-30%)"
    echo -e "   • Memory: Moderate (~500MB-1GB)"
    echo -e "   • Success Rate: Should be >95%"
    ;;
  high)
    echo -e "   • CPU: High usage (30-60%)"
    echo -e "   • Memory: High (~1-2GB)"
    echo -e "   • Success Rate: Should be >85%"
    ;;
  stress)
    echo -e "   • CPU: Very high usage (60-90%)"
    echo -e "   • Memory: Very high (~2-4GB)"
    echo -e "   • Success Rate: Should be >80%"
    echo -e "   • ${YELLOW}Note: System may show degradation${NC}"
    ;;
  max)
    echo -e "   • CPU: Maximum usage (80-100%)"
    echo -e "   • Memory: Maximum (~4-8GB)"
    echo -e "   • Success Rate: Should be >70%"
    echo -e "   • ${RED}Note: Finding breaking point - failures expected${NC}"
    ;;
esac

echo ""
