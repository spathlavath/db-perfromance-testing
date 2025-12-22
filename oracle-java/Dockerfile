# Build stage
FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code and build
COPY src ./src
RUN mvn clean package -DskipTests

# Runtime stage
FROM eclipse-temurin:17-jre-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Download OpenTelemetry Java agent
ADD https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/download/v1.32.0/opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar
RUN chmod 644 /app/opentelemetry-javaagent.jar

# Download New Relic Java agent
ADD https://download.newrelic.com/newrelic/java-agent/newrelic-agent/current/newrelic-java.zip /tmp/newrelic-java.zip
RUN apk add --no-cache unzip && \
    unzip /tmp/newrelic-java.zip -d /app && \
    rm /tmp/newrelic-java.zip && \
    chmod 644 /app/newrelic/newrelic.jar

# Copy New Relic configuration
COPY src/main/resources/newrelic.yml /app/newrelic/newrelic.yml

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start script to handle both OTEL and New Relic agents
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"]
