# Database Operations Not Visible in New Relic APM - Debugging Guide

## Current Status

### ✅ What's Working:
1. HTTP transactions visible (`POST /workload/start`, `GET /pool-stats`)
2. Database spans ARE being created (visible in trace details)
3. Database spans show correct names: `SELECT employees`, `EXECUTE employees`
4. OpenTelemetry semantic conventions implemented correctly
5. Context propagation working (spans linked to HTTP parents)

### ❌ What's NOT Working:
1. "Top 20 database operations" shows: "We couldn't find any Database operations"
2. "Slow SQL Span traces" shows: "We don't see any matching traces"
3. "Database queries" tab shows: "No Database queries found"

## Root Cause Analysis

The database spans ARE being exported to New Relic, but the APM UI is not displaying them in the database-specific views. This suggests one of two issues:

### Possibility 1: Missing or Incorrect Attributes
New Relic APM UI requires specific attributes to recognize and categorize database operations:

**Required Attributes:**
- `span.kind` = `'client'` ✅ (We have: `SpanKind.CLIENT`)
- `db.system` = `'oracle'` ✅ (We have: `ATTR_DB_SYSTEM: 'oracle'`)
- `db.operation` = operation type ✅ (We have: `attributes['db.operation'] = operation.toLowerCase()`)
- `db.sql.table` = table name ✅ (We have: `attributes['db.sql.table'] = tableName`)
- `db.statement` = SQL query ✅ (We have: `attributes['db.statement'] = sqlStatement`)

**Additional Attributes (recommended):**
- `db.collection.name` = table name ✅ 
- `db.operation.name` = operation type ✅
- `server.address` = hostname ✅
- `server.port` = port number ✅
- `peer.hostname` = hostname ✅
- `db.instance` = connection string ✅

### Possibility 2: New Relic APM UI Query Filters
The New Relic APM "Databases" view may be using a specific NRQL query that:
- Filters by specific attribute values
- Requires metrics (not just spans)
- Expects specific attribute naming conventions

## Diagnostic Steps

### Step 1: Run NRQL Queries

Open `verify-database-spans.md` and run all 5 NRQL queries in New Relic Query Builder.

**Critical Queries:**

```sql
-- Query 1: Check if database spans are reaching New Relic
FROM Span 
SELECT count(*) 
WHERE entity.name = 'Oracle-HR-Portal' 
  AND span.kind = 'client'
  AND db.system = 'oracle'
SINCE 30 minutes ago
FACET name
```

Expected result: Should show counts for `SELECT employees`, `INSERT job_history`, etc.

```sql
-- Query 2: Check attributes on database spans
FROM Span 
SELECT 
  latest(db.system),
  latest(db.operation),
  latest(db.sql.table),
  latest(db.statement),
  latest(span.kind)
WHERE entity.name = 'Oracle-HR-Portal' 
  AND name LIKE '%employees%'
SINCE 30 minutes ago
LIMIT 1
```

Expected result: Should show all attributes populated.

### Step 2: Compare with MySQL Example

You mentioned MySQL database operations ARE visible. Let's compare:

**Run this query for your MySQL service:**
```sql
FROM Span 
SELECT 
  latest(db.system),
  latest(db.operation),
  latest(db.sql.table),
  latest(db.statement),
  latest(span.kind),
  latest(name)
WHERE db.system = 'mysql'
SINCE 30 minutes ago
LIMIT 1
```

Compare the attributes with Oracle spans to see what's different.

### Step 3: Check Span Metrics

New Relic APM might derive metrics from spans. Check if span metrics exist:

```sql
FROM Metric 
SELECT * 
WHERE entity.name = 'Oracle-HR-Portal' 
  AND metricName LIKE '%db%'
SINCE 30 minutes ago
LIMIT 10
```

### Step 4: Check for Entity Synthesis

New Relic might require the service entity to be properly synthesized:

```sql
FROM Span 
SELECT uniqueCount(entity.guid)
WHERE entity.name = 'Oracle-HR-Portal'
SINCE 30 minutes ago
```

## Possible Solutions

### Solution 1: Add Missing Attributes (if found)

If NRQL queries reveal missing attributes, we'll add them to `oracledb-instrumented.js`.

### Solution 2: Enable Span-to-Metrics Aggregation

New Relic might require metrics derived from spans. We can add a span processor that generates metrics:

```javascript
// In tracing.js
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-proto');

// Add metric exporter
const metricExporter = new OTLPMetricExporter({
  url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/metrics`,
  headers: {
    'api-key': process.env.OTEL_EXPORTER_OTLP_HEADERS?.split('=')[1]
  }
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000, // 1 minute
});

// Enable in SDK
meterProvider: new MeterProvider({
  readers: [metricReader]
})
```

### Solution 3: Add Database Span Category Attribute

Some APM systems require an explicit category attribute:

```javascript
attributes['span.category'] = 'database';
attributes['component'] = 'oracledb';
```

### Solution 4: Use New Relic Agent Attributes

If OpenTelemetry attributes aren't being recognized, add New Relic-specific attributes:

```javascript
attributes['newrelic.category'] = 'Datastore';
attributes['newrelic.database'] = 'oracle';
```

## Next Actions

1. **Run all NRQL queries** from `verify-database-spans.md`
2. **Share the results** - especially:
   - Do database spans exist in New Relic?
   - What attributes do they have?
   - Are there any differences from MySQL spans?
3. **Check the MySQL comparison** - What makes MySQL spans visible but not Oracle?

Based on the query results, we'll implement the correct fix!

## Reference: Working MySQL Example

From your screenshot, MySQL shows:
- **Format**: `MySQL {table} {operation}`
- **Example**: `MySQL departments select` (70.31%)

Our Oracle spans should show similarly:
- **Format**: `{operation} {table}` 
- **Example**: `SELECT employees`

The format difference might be the issue. We can adjust the span naming if needed.
