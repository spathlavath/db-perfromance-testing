#!/bin/bash

# ==============================================================================
# Oracle Performance Testing - Apply Performance Fixes
# ==============================================================================
# This script applies optimizations to handle HIGH and MAX load test profiles
# 
# Key Changes:
# - Connection Pool: 50-200 connections (was 10-50)
# - Queue Management: 500 max queue, 2min timeout
# - Docker Resources: 4GB memory, 2 CPU cores
# ==============================================================================

set -e

echo "=========================================="
echo "Applying Performance Optimizations"
echo "=========================================="
echo ""

# Check if docker-compose is running
if docker-compose ps | grep -q "oracle-test-app"; then
    echo "📍 Current container status:"
    docker-compose ps oracle-test-app
    echo ""
    
    echo "⚠️  Stopping existing containers..."
    docker-compose down
    echo "✅ Containers stopped"
    echo ""
fi

# Rebuild with new configuration
echo "🔨 Rebuilding application with optimized settings..."
docker-compose build oracle-test-app

echo ""
echo "🚀 Starting optimized application..."
docker-compose up -d oracle-test-app

echo ""
echo "⏳ Waiting for application to become healthy..."
sleep 5

# Wait for health check
for i in {1..30}; do
    if docker-compose ps oracle-test-app | grep -q "healthy"; then
        echo "✅ Application is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Health check timeout - check logs with: docker-compose logs oracle-test-app"
        exit 1
    fi
    echo -n "."
    sleep 2
done

echo ""
echo "=========================================="
echo "✅ Performance Optimizations Applied!"
echo "=========================================="
echo ""
echo "📊 New Configuration:"
echo "   - Pool Min: 50 connections"
echo "   - Pool Max: 200 connections"
echo "   - Pool Increment: 10 connections"
echo "   - Queue Max: 500 requests"
echo "   - Queue Timeout: 2 minutes"
echo "   - Memory Limit: 4GB"
echo "   - CPU Limit: 2 cores"
echo ""
echo "🧪 Ready for load testing:"
echo "   - LOW (100 VUs): ./run-k6-tests.sh"
echo "   - MEDIUM (200 VUs): Should now succeed"
echo "   - HIGH (500 VUs): Should now be achievable"
echo "   - STRESS (1000 VUs): Test system limits"
echo "   - MAX (2000 VUs): Maximum stress test"
echo ""
echo "📝 Monitor performance:"
echo "   docker stats oracle-oracle-test-app-1"
echo "   docker-compose logs -f oracle-test-app"
echo ""
