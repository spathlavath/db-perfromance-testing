/**
 * OpenTelemetry APM Instrumentation for Oracle HR Portal
 * This file must be required BEFORE any other application code
 * 
 * SIMPLIFIED VERSION: New Relic automatically generates database metrics from spans
 * No need for custom metric generation - just ensure spans have correct attributes
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-proto');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔍 OTEL Configuration:');
console.log('   OTEL_EXPORTER_OTLP_ENDPOINT:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
console.log('   OTEL_SERVICE_NAME:', process.env.OTEL_SERVICE_NAME);

// Create resource
const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'HR-Portal',
  [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
});

// Configure OTLP Trace Exporter
const traceExporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers: {
    'api-key': process.env.OTEL_EXPORTER_OTLP_HEADERS?.split('=')[1] || process.env.NEW_RELIC_LICENSE_KEY
  },
  compression: 'gzip',
});

// Configure OTLP Metric Exporter
const metricExporter = new OTLPMetricExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
  headers: {
    'api-key': process.env.OTEL_EXPORTER_OTLP_HEADERS?.split('=')[1] || process.env.NEW_RELIC_LICENSE_KEY
  },
  compression: 'gzip',
});

// Initialize the SDK - SIMPLE CONFIGURATION
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          return req.url === '/health';
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
    }),
  ],
});

// Start SDK
sdk.start();

console.log('✅ OpenTelemetry instrumentation initialized');
console.log(`📡 Exporting to: ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`);
console.log(`🏷️  Service: ${process.env.OTEL_SERVICE_NAME || 'Oracle-HR-Portal'}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('✅ OpenTelemetry SDK shut down'))
    .catch((err) => console.error('❌ Error shutting down SDK:', err))
    .finally(() => process.exit(0));
});

module.exports = sdk;
