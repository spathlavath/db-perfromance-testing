FROM node:20-alpine

# Install curl for health checks and required build tools
RUN apk add --no-cache curl libaio libnsl libc6-compat python3 make g++ wget unzip

WORKDIR /usr/src/app

# Install Oracle Instant Client BASIC (not lite) for Thick Mode with encryption support
RUN wget https://download.oracle.com/otn_software/linux/instantclient/2113000/instantclient-basic-linux.x64-21.13.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-21.13.0.0.0dbru.zip \
    && rm -f instantclient-basic-linux.x64-21.13.0.0.0dbru.zip

# Set Oracle Instant Client environment variables
ENV LD_LIBRARY_PATH=/usr/src/app/instantclient_21_13:$LD_LIBRARY_PATH \
    OCI_LIB_DIR=/usr/src/app/instantclient_21_13 \
    OCI_INC_DIR=/usr/src/app/instantclient_21_13/sdk/include

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

# Start the application with OpenTelemetry instrumentation
CMD ["node", "--require", "./instrumentation.js", "--max-old-space-size=2048", "app.js"]
