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
const { 
  SEMRESATTRS_SERVICE_NAME, 
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_SERVICE_INSTANCE_ID 
} = require('@opentelemetry/semantic-conventions');
const { AlwaysOnSampler } = require('@opentelemetry/sdk-trace-node');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

console.log('🔍 OTEL Configuration:');
console.log('   OTEL_EXPORTER_OTLP_ENDPOINT:', process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
console.log('   OTEL_SERVICE_NAME:', process.env.OTEL_SERVICE_NAME);
console.log('   OTEL_TRACES_SAMPLER:', process.env.OTEL_TRACES_SAMPLER || 'parentbased_always_on');

// Parse resource attributes
const resourceAttributes = {
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'Oracle-HR-Portal',
  [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
};

// Parse additional resource attributes from OTEL_RESOURCE_ATTRIBUTES
if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
  const attrs = process.env.OTEL_RESOURCE_ATTRIBUTES.split(',');
  attrs.forEach(attr => {
    const [key, value] = attr.split('=');
    if (key && value) {
      resourceAttributes[key.trim()] = value.trim();
    }
  });
}

// Create resource
const resource = new Resource(resourceAttributes);

console.log('📋 Resource Attributes:', resourceAttributes);

// Parse API key from headers
const apiKey = process.env.OTEL_EXPORTER_OTLP_HEADERS?.includes('=') 
  ? process.env.OTEL_EXPORTER_OTLP_HEADERS.split('=')[1] 
  : process.env.OTEL_EXPORTER_OTLP_HEADERS || process.env.NEW_RELIC_LICENSE_KEY;

// Configure OTLP Trace Exporter
const traceExporter = new OTLPTraceExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
  headers: {
    'api-key': apiKey
  },
  compression: 'gzip',
});

// Configure OTLP Metric Exporter
const metricExporter = new OTLPMetricExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
  headers: {
    'api-key': apiKey
  },
  compression: 'gzip',
});

// Initialize the SDK with complete configuration
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
  sampler: new AlwaysOnSampler(), // Ensure all spans are sampled
  spanLimits: {
    attributeValueLengthLimit: parseInt(process.env.OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT) || 4095,
    attributeCountLimit: parseInt(process.env.OTEL_SPAN_ATTRIBUTE_COUNT_LIMIT) || 128,
    eventCountLimit: parseInt(process.env.OTEL_SPAN_EVENT_COUNT_LIMIT) || 128,
    linkCountLimit: parseInt(process.env.OTEL_SPAN_LINK_COUNT_LIMIT) || 128,
  },
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60000, // Export metrics every 60 seconds
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingRequestHook: (req) => {
          // Don't trace health checks
          return req.url === '/health';
        },
        // Critical: Capture ALL required attributes for New Relic APM transactions
        requestHook: (span, request) => {
          // HTTP semantic convention attributes (required for New Relic)
          span.setAttribute('http.method', request.method);
          span.setAttribute('http.scheme', 'http');
          span.setAttribute('http.target', request.url);
          span.setAttribute('http.host', request.headers?.host || 'localhost:3000');
          
          // New Relic APM specific attributes for transaction naming
          span.setAttribute('http.url', `http://${request.headers?.host || 'localhost:3000'}${request.url}`);
          span.setAttribute('request.method', request.method);
          span.setAttribute('request.uri', request.url?.split('?')[0]);
          
          // User agent for better APM insights
          if (request.headers?.['user-agent']) {
            span.setAttribute('http.user_agent', request.headers['user-agent']);
          }
        },
        responseHook: (span, response) => {
          span.setAttribute('http.status_code', response.statusCode);
          span.setAttribute('http.response.status_code', response.statusCode);
        },
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
        // Critical: Set proper transaction name from Express route
        requestHook: (span, info) => {
          const req = info.request;
          
          // Get the Express route pattern (e.g., /employees/:id)
          const route = req.route?.path;
          const method = req.method;
          const baseUrl = req.baseUrl || '';
          
          if (route) {
            // Use Express route pattern for consistent transaction names
            const fullRoute = baseUrl + route;
            const transactionName = `${method} ${fullRoute}`;
            
            // Update the span name to the transaction name
            span.updateName(transactionName);
            
            // Set attributes that New Relic uses for transaction grouping
            span.setAttribute('http.route', fullRoute);
            span.setAttribute('express.route', fullRoute);
            span.setAttribute('transaction.name', transactionName);
          } else {
            // Fallback for routes without patterns
            const path = req.path || req.url?.split('?')[0] || req.url;
            span.updateName(`${method} ${path}`);
            span.setAttribute('http.route', path);
          }
        },
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
