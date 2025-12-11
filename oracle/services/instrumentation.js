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
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

// Create SDK - following New Relic example pattern
const sdk = new opentelemetry.NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log('✅ OpenTelemetry instrumentation started');
