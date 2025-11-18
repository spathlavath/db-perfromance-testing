#!/bin/bash
# Apply Thick Mode Fix to Oracle VM
# This script updates the Dockerfile and app.js to enable Oracle Thick Mode

set -e

echo "🔧 Applying Oracle Thick Mode Fix..."
echo ""

# Check if we're in the oracle directory
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found"
    echo "Please run this script from the db-perfromance-testing/oracle directory"
    exit 1
fi

# Backup existing files
echo "📦 Creating backups..."
cp services/Dockerfile services/Dockerfile.backup
cp services/app.js services/app.js.backup
echo "✅ Backups created"
echo ""

# Update Dockerfile
echo "📝 Updating Dockerfile to install Oracle Instant Client..."
cat > services/Dockerfile << 'EOF'
FROM node:20-alpine

# Install curl for health checks and required build tools
RUN apk add --no-cache curl libaio libnsl libc6-compat python3 make g++ wget unzip

WORKDIR /usr/src/app

# Install Oracle Instant Client for Thick Mode
RUN wget https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip \
    && unzip instantclient-basiclite-linuxx64.zip \
    && rm -f instantclient-basiclite-linuxx64.zip \
    && mv instantclient_* instantclient \
    && echo /usr/src/app/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf

# Set Oracle Instant Client environment variables
ENV LD_LIBRARY_PATH=/usr/src/app/instantclient:$LD_LIBRARY_PATH

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "--max-old-space-size=2048", "app.js"]
EOF
echo "✅ Dockerfile updated"
echo ""

# Update app.js to initialize thick mode
echo "📝 Updating app.js to enable Oracle Thick Mode..."

# Find the line with "const oracledb = require('oracledb');" and add thick mode initialization after it
sed -i.bak '/^const oracledb = require/a\
\
// Initialize Oracle Thick Mode - MUST be called before any oracledb operations\
try {\
  oracledb.initOracleClient();\
  console.log('\''✅ Oracle Thick Mode initialized successfully'\'');\
} catch (err) {\
  console.error('\''⚠️  Failed to initialize Oracle Thick Mode:'\'', err.message);\
  console.log('\''ℹ️  Continuing in Thin Mode (encryption may not be supported)'\'');\
}
' services/app.js

echo "✅ app.js updated"
echo ""

echo "🎉 All changes applied successfully!"
echo ""
echo "Next steps:"
echo "1. Stop containers: docker-compose down"
echo "2. Rebuild with fix: docker-compose up --build"
echo ""
echo "Note: The first build will take longer as it downloads Oracle Instant Client (~50MB)"
