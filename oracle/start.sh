#!/bin/bash

echo "🚀 Starting Oracle Test Application..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "❌ Please configure .env file with your Oracle DB credentials"
    exit 1
fi

# Build and start
docker-compose up --build
