#!/bin/bash

echo "🚀 Starting Oracle Test Application..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "❌ Please configure .env file with your Oracle DB credentials"
    exit 1
fi

# Fix K6 script permissions
if [ -d "k6/scripts" ]; then
    echo "🔧 Fixing K6 script permissions..."
    chmod -R 755 k6/scripts/
    chmod 644 k6/scripts/*.js 2>/dev/null || true
fi

# Build and start (support both docker-compose and docker compose)
if command -v docker-compose &> /dev/null; then
    docker-compose up --build
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose up --build
else
    echo "❌ Neither 'docker-compose' nor 'docker compose' command found"
    exit 1
fi
