/**
 * OpenTelemetry Instrumentation for New Relic APM
 * Based on: https://github.com/newrelic/newrelic-opentelemetry-examples
 * 
 * Load this file BEFORE your application:
 * node --require ./instrumentation.js app.js
 */

const opentelemetry = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { diag, DiagConsoleLogger, DiagLogLevel } = require('@opentelemetry/api');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Enable diagnostic logging
const logLevel = process.env.OTEL_LOG_LEVEL === 'debug' ? DiagLogLevel.DEBUG : DiagLogLevel.INFO;
diag.setLogger(new DiagConsoleLogger(), logLevel);

console.log('🚀 OpenTelemetry Instrumentation');
console.log('   Service:', process.env.OTEL_SERVICE_NAME);
console.log('   Endpoint:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

// Create SDK - following New Relic example pattern
const sdk = new opentelemetry.NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 60000, // Export every 60 seconds
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('✅ OpenTelemetry instrumentation started');

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('✅ OpenTelemetry shut down'))
    .catch((err) => console.error('❌ Shutdown error:', err))
    .finally(() => process.exit(0));
});
