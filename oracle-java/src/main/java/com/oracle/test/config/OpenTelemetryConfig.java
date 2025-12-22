package com.oracle.test.config;

/**
 * OpenTelemetry Configuration
 *
 * NOTE: This configuration class is disabled because we use the OpenTelemetry Java Agent
 * for automatic instrumentation. The Java agent is attached at JVM startup via the
 * docker-entrypoint.sh script using: -javaagent:/app/opentelemetry-javaagent.jar
 *
 * Manual configuration is not needed when using the Java agent.
 * All OpenTelemetry settings are configured via environment variables:
 * - OTEL_SERVICE_NAME
 * - OTEL_EXPORTER_OTLP_ENDPOINT
 * - OTEL_EXPORTER_OTLP_HEADERS
 * - OTEL_TRACES_EXPORTER
 * - OTEL_METRICS_EXPORTER
 * - etc.
 *
 * If you need to enable manual configuration:
 * 1. Remove the Java agent from docker-entrypoint.sh
 * 2. Uncomment the @Configuration annotation below
 * 3. Uncomment the openTelemetry() method
 * 4. Rebuild and redeploy the application
 */

// @Configuration
public class OpenTelemetryConfig {

    // Manual OpenTelemetry configuration is disabled
    // Using OpenTelemetry Java Agent for automatic instrumentation

    /*
    @Value("${otel.service.name:HR-Portal}")
    private String serviceName;

    @Value("${otel.exporter.otlp.endpoint:http://localhost:4317}")
    private String otlpEndpoint;

    @Value("${otel.exporter.otlp.timeout:30000}")
    private long otlpTimeout;

    @Bean
    public OpenTelemetry openTelemetry() {
        // Implementation would go here
        // Currently using Java agent instead
        return null;
    }
    */
}
