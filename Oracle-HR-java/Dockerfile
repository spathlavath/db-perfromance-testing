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

# Install curl and unzip for health checks and New Relic agent
RUN apk add --no-cache curl unzip

WORKDIR /app

# Copy the built jar from builder stage
COPY --from=builder /app/target/*.jar app.jar

# Copy the custom New Relic Java agent (uploaded to VM)
# The newrelic.jar must be present in the build context directory
COPY newrelic.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar

# Copy New Relic configuration
COPY src/main/resources/newrelic.yml /app/newrelic/newrelic.yml

# Expose application port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=15s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

# Start the application with New Relic Java agent
ENTRYPOINT ["java", \
    "-javaagent:/app/newrelic/newrelic.jar", \
    "-Xms512m", \
    "-Xmx2048m", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-jar", \
    "app.jar"]
