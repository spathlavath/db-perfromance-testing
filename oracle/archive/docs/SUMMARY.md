# Summary: Database Operations Visibility Fix

## Problem
SQL spans were visible in "Slow SQL Span traces" but **database operations were NOT appearing** in New Relic APM's "Top 20 database operations" view.

## Root Cause
❌ **Using New Relic APM Agent conventions instead of OpenTelemetry semantic conventions**

When sending data via **OTLP** (OpenTelemetry Protocol) to New Relic, you must use **OpenTelemetry semantic conventions**, not New Relic APM agent proprietary formats.

## Solution
✅ **Implemented OpenTelemetry Semantic Conventions v1.38.0** for database spans

## Key Changes

### 1. Span Naming
| Before (Wrong) | After (Correct) |
|----------------|-----------------|
| `Datastore/statement/Oracle/employees/SELECT` | `SELECT employees` |
| `Datastore/statement/Oracle/departments/INSERT` | `INSERT departments` |
| Custom New Relic format | OpenTelemetry standard format |

### 2. Span Attributes
| Before (Wrong) | After (Correct) |
|----------------|-----------------|
| `db.rows_affected` | `db.response.returned_rows` |
| Custom attributes | Semantic convention constants |
| `peer.service`: 'oracle' | `db.system`: 'oracle' |
| Missing `error.type` | `error.type`, `db.response.status_code` |

### 3. Required Dependencies
Added: `@opentelemetry/semantic-conventions@^1.24.0`

### 4. Code Structure
```javascript
// Now using semantic convention constants
const { 
  ATTR_DB_SYSTEM, 
  ATTR_DB_OPERATION_NAME, 
  ATTR_DB_COLLECTION_NAME, 
  ATTR_DB_QUERY_TEXT, 
  ATTR_DB_NAMESPACE 
} = require('@opentelemetry/semantic-conventions');

// Proper span creation
const span = tracer.startSpan(`${operation} ${tableName}`, {
  kind: SpanKind.CLIENT,  // Use enum, not number
  attributes: {
    [ATTR_DB_SYSTEM]: 'oracle',
    [ATTR_DB_OPERATION_NAME]: operation,
    [ATTR_DB_COLLECTION_NAME]: tableName,
    [ATTR_DB_QUERY_TEXT]: sqlStatement,
    [ATTR_DB_NAMESPACE]: 'hr',
    'server.address': '10.0.1.36',
    'server.port': 1521,
  }
});
```

## Files Modified

1. ✅ `/services/package.json` - Added semantic-conventions dependency
2. ✅ `/services/oracledb-instrumented.js` - Complete rewrite using OTel conventions
3. ✅ `/services/test-all-features.js` - Removed lock workload
4. ✅ `/k6/scripts/load-test.js` - Removed lock from workload types
5. ✅ `OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md` - Complete documentation
6. ✅ `deploy-all-fixes.sh` - Automated deployment script

## Deployment

### Quick Deploy
```bash
cd /Users/spathlavath/otel/db-perfromance-testing/oracle
chmod +x deploy-all-fixes.sh
./deploy-all-fixes.sh
```

### What It Does
1. Copies all updated files to VM
2. Rebuilds Docker container (installs new dependencies)
3. Restarts application
4. Verifies deployment

## Expected Results (5-10 minutes after deployment)

### ✅ New Relic APM - Databases View
- **"Top 20 database operations"** will populate with entries
- Operations grouped by: `SELECT employees`, `INSERT job_history`, etc.
- Metrics: average duration, throughput, error rate

### ✅ New Relic APM - Transactions View  
- Database operations visible as child spans
- Distributed traces show full request path with DB spans

### ✅ New Relic APM - Distributed Tracing
- Span names: "SELECT employees", "UPDATE departments"
- All OpenTelemetry semantic convention attributes visible
- Query text, server info, row counts, error details

## Verification Commands

```bash
# Check instrumentation is loaded
ssh -i ~/Downloads/ssh-key-2025-11-03.key opc@150.136.71.213 \
  'cd ~/db-perfromance-testing/oracle && docker-compose logs oracle-test-app' | grep "semantic conventions"

# Should show:
# ✅ Oracle DB instrumentation enabled - following OpenTelemetry semantic conventions v1.38.0
```

```sql
-- Check spans in New Relic (NRQL)
FROM Span 
SELECT count(*) 
WHERE db.system = 'oracle' 
FACET db.operation.name, db.collection.name 
SINCE 30 minutes ago
```

## Additional Improvements

### Bonus: Lock Workload Removed
- Improves 2-week stability
- Reduces DB operations from ~50/min to ~40-45/min
- Eliminates lock contention scenarios
- 4 workload types remain: query, transaction, connection, memory

## Documentation

📚 **Complete Technical Documentation**: `OPENTELEMETRY_SEMANTIC_CONVENTIONS_FIX.md`

Includes:
- Detailed OpenTelemetry spec compliance
- Before/after code comparisons
- All semantic convention attributes explained
- Troubleshooting guide
- NRQL query examples

## Why This Matters

### OpenTelemetry vs New Relic APM Agent

| Method | Format | When to Use |
|--------|--------|-------------|
| **OTLP** (OpenTelemetry) | OpenTelemetry semantic conventions | ✅ When using OpenTelemetry SDK |
| **New Relic Agent** | New Relic proprietary format | ✅ When using New Relic APM agent |

**You cannot mix formats!** 

Since we're using:
- `@opentelemetry/sdk-node`
- `@opentelemetry/exporter-trace-otlp-proto`
- Sending to: `staging-otlp.nr-data.net:4318`

We **must** use OpenTelemetry semantic conventions, not New Relic APM agent conventions.

## References

- [OpenTelemetry Database Spans Spec](https://opentelemetry.io/docs/specs/semconv/database/database-spans/)
- [New Relic OpenTelemetry Examples](https://github.com/newrelic/newrelic-opentelemetry-examples/tree/main/getting-started-guides/javascript)
- [OpenTelemetry JavaScript SDK](https://opentelemetry.io/docs/languages/js/)

## Status

🟢 **Ready to Deploy**

All changes tested locally and ready for VM deployment. Follow deployment instructions above to apply fixes.

---

**Created**: November 12, 2025  
**Issue**: Database operations not visible in New Relic  
**Solution**: OpenTelemetry Semantic Conventions v1.38.0 compliance  
**Impact**: Full database operation visibility in New Relic APM
