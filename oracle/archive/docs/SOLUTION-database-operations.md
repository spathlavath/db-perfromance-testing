# SOLUTION: Database Operations Not Showing in New Relic APM

## Root Cause (from New Relic Slack conversation)

New Relic synthesizes `apm.service.datastore.operation.duration` metrics **from span data** on the server side.

### Requirements for Synthesis:

1. ✅ `span.kind = 'client'` (CLIENT spans)
2. ✅ `db.system` attribute (e.g., 'oracle', 'mysql', 'postgresql')
3. ✅ **Collection/Table name**: EITHER `db.collection.name` (OTel) OR `db.sql.table` (NR legacy)
4. ✅ **Operation type**: EITHER `db.operation.name` (OTel) OR `db.operation` (NR legacy)

### What We Have:

```javascript
attributes[ATTR_DB_SYSTEM] = 'oracle';                    // ✅ db.system
attributes[ATTR_DB_OPERATION_NAME] = operation;            // ✅ db.operation.name (OTel)
attributes[ATTR_DB_COLLECTION_NAME] = tableName;           // ✅ db.collection.name (OTel)
attributes['db.sql.table'] = tableName;                    // ✅ db.sql.table (NR legacy)
attributes['db.operation'] = operation.toLowerCase();       // ✅ db.operation (NR legacy)
attributes['db.statement'] = sqlStatement;                 // ✅ db.statement (query text)
```

## Verification Steps

### 1. Verify Spans Are Reaching New Relic

Run this NRQL query:

```sql
FROM Span 
SELECT count(*) 
WHERE entity.name = 'Oracle-HR-Portal' 
  AND span.kind = 'client'
  AND db.system = 'oracle'
SINCE 30 minutes ago
FACET name
LIMIT 20
```

**Expected Result**: Should show database operations like:
- `SELECT employees` (count: 8)
- `INSERT job_history` (count: 3)
- `UPDATE departments` (count: 2)

### 2. Verify ALL Required Attributes Are Present

Run this NRQL query:

```sql
FROM Span 
SELECT 
  latest(span.kind),
  latest(db.system),
  latest(db.operation.name),
  latest(db.collection.name),
  latest(db.operation),
  latest(db.sql.table),
  latest(db.statement)
WHERE entity.name = 'Oracle-HR-Portal' 
  AND db.system = 'oracle'
SINCE 30 minutes ago
LIMIT 1
```

**Expected Result**:
```
span.kind: client
db.system: oracle
db.operation.name: SELECT          ← OTel convention
db.collection.name: employees       ← OTel convention
db.operation: select                ← NR legacy
db.sql.table: employees             ← NR legacy
db.statement: SELECT * FROM employees WHERE...
```

### 3. Verify Metrics Are Being Synthesized

Wait 5-10 minutes after spans arrive, then run:

```sql
FROM Metric 
SELECT sum(apm.service.datastore.operation.duration)
WHERE entity.name = 'Oracle-HR-Portal'
SINCE 30 minutes ago
FACET db.system, db.sql.table, db.operation
TIMESERIES
```

**Expected Result**: Should show metrics like:
```
db.system | db.sql.table | db.operation | sum(duration)
oracle    | employees    | select       | 45.2ms
oracle    | departments  | select       | 12.8ms
oracle    | job_history  | insert       | 8.1ms
```

### 4. Check the "Top 20 Database Operations" View

Navigate to: **APM & Services → Oracle-HR-Portal → Databases**

**Expected**: Should now show operations grouped by table and operation.

## If Still Not Working

### Possibility 1: Synthesis Delay

New Relic may take **5-15 minutes** to synthesize metrics from spans. Wait and check again.

### Possibility 2: Entity Not Recognized

Check if your service entity is properly synthesized:

```sql
FROM Span 
SELECT uniqueCount(entity.guid), latest(entity.name)
WHERE service.name = 'Oracle-HR-Portal'
SINCE 30 minutes ago
```

### Possibility 3: Staging vs Production

The Slack conversation mentions this was deployed to **staging and production** on Nov 18, 2024. You're using **staging-otlp.nr-data.net**.

Verify the synthesis rules are active:

```sql
FROM Metric 
SELECT * 
WHERE metricName LIKE '%datastore%'
SINCE 30 minutes ago
LIMIT 10
```

### Possibility 4: Instrumentation Name

According to the Slack conversation, the synthesis for OTel conventions only works when `instrumentation.name=nr_ebpf`. 

**But for regular APM instrumentation**, New Relic should synthesize from legacy attributes (`db.sql.table` + `db.operation`).

Let me check if we need to add `instrumentation.provider`:

```javascript
// In tracing.js, add to resource attributes:
resource: new Resource({
  [ATTR_SERVICE_NAME]: serviceName,
  'instrumentation.provider': 'opentelemetry',
  // ... other attributes
})
```

## Most Likely Issue

Based on the Slack conversation and your symptoms, I believe the issue is:

**New Relic is waiting for metrics, but we're only sending spans.**

The synthesis should automatically create metrics from our CLIENT spans with `db.system`, `db.sql.table`, and `db.operation` attributes.

### Quick Test

Run this query to see if ANY database metrics exist:

```sql
FROM Metric 
SELECT *
WHERE metricName LIKE '%apm.service.datastore%'
AND entity.name = 'Oracle-HR-Portal'
SINCE 1 hour ago
LIMIT 10
```

If this returns **0 results**, then synthesis is not happening.

## Next Steps

1. **Run all verification queries above**
2. **Wait 15 minutes** for synthesis to occur
3. **Check if metrics appear**
4. If not, we may need to add `instrumentation.provider` attribute or switch to sending metrics directly

Let me know the results!
