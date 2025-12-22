#!/bin/bash
# Rebuild and restart the Oracle Java application

set -e

echo "==> Stopping containers..."
docker-compose down

echo "==> Copying custom newrelic.jar..."
if [ -f ~/newrelic.jar ]; then
    cp ~/newrelic.jar .
    echo "✓ Custom newrelic.jar copied"
else
    echo "✗ WARNING: ~/newrelic.jar not found!"
fi

echo "==> Building and starting containers..."
docker-compose up -d --build

echo "==> Waiting for application to start..."
sleep 15

echo "==> Checking container status..."
docker-compose ps

echo "==> Testing health endpoint..."
sleep 5
curl -s http://localhost:3001/health | jq . || echo "Health check failed"

echo ""
echo "==> Application should be available at:"
echo "    http://localhost:3001"
echo ""
echo "==> View logs with:"
echo "    docker-compose logs -f oracle-test-app"
