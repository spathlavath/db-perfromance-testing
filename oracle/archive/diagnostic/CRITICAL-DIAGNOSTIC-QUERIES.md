# CRITICAL: Diagnostic NRQL Queries

Run these queries IN ORDER to diagnose why metrics aren't being synthesized:

## 1. Verify Spans Are Reaching New Relic

```sql
FROM Span 
SELECT count(*) 
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 30 minutes ago
```

**Expected**: > 0 (if 0, spans aren't reaching New Relic at all)

## 2. Check for Database Spans Specifically

```sql
FROM Span 
SELECT count(*) 
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
  AND span.kind = 'client'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET name
LIMIT 20
```

**Expected**: Should show database operation names like "SELECT employees", "INSERT job_history"

## 3. Verify ALL Required Attributes for Synthesis

```sql
FROM Span 
SELECT 
  latest(span.kind),
  latest(db.system),
  latest(db.sql.table),
  latest(db.operation),
  latest(db.statement)
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
LIMIT 1
```

**Expected**:
```
span.kind: client
db.system: oracle
db.sql.table: employees
db.operation: select
db.statement: SELECT * FROM employees...
```

**IF ANY OF THESE ARE NULL**, that's why synthesis is failing!

## 4. Check if Entity GUID is Correct

```sql
FROM Span 
SELECT uniqueCount(entity.guid), latest(entity.name), latest(service.name)
WHERE service.name = 'Oracle-HR-Portal'
SINCE 30 minutes ago
```

**Expected**: Should show your entity.guid and entity.name

## 5. Wait for Synthesis (15 minutes), Then Check Metrics

```sql
FROM Metric 
SELECT *
WHERE metricName = 'apm.service.datastore.operation.duration'
  AND entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 1 hour ago
LIMIT 10
```

**Expected**: If synthesis is working, you'll see metric data points

## 6. Alternative: Check Using Service Name

```sql
FROM Metric 
SELECT sum(apm.service.datastore.operation.duration)
WHERE service.name = 'Oracle-HR-Portal'
SINCE 30 minutes ago
FACET db.system, db.sql.table, db.operation
TIMESERIES
```

## 7. Check for ANY Metrics from Your Service

```sql
FROM Metric 
SELECT uniqueCount(metricName)
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 30 minutes ago
FACET metricName
LIMIT 20
```

**This shows if ANY metrics exist** for your service.

## 8. Check Transaction Metrics (Should Exist from HTTP Spans)

```sql
FROM Metric 
SELECT sum(apm.service.transaction.duration)
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 30 minutes ago
FACET transactionName
TIMESERIES
```

**Expected**: Should show "WebTransaction/server/POST /workload/start", etc.

---

## What Each Result Means:

### If Query 1 returns 0:
❌ **Spans aren't reaching New Relic**
- Check OTLP exporter configuration
- Verify API key is correct
- Check firewall/network issues

### If Query 2 returns 0:
❌ **No database spans found**
- Database instrumentation not working
- Spans not being created
- Check oracledb-instrumented.js is loaded

### If Query 3 shows NULL values:
❌ **Missing required attributes**
- Check which attribute is NULL
- Fix oracledb-instrumented.js to set that attribute

### If Query 5 returns 0 after 15+ minutes:
❌ **Synthesis not happening**
- Entity might not be properly synthesized
- Try using service.name instead of entity.guid
- Check if you're on staging vs production

### If Query 8 shows transaction metrics but Query 5 shows no datastore metrics:
🤔 **Synthesis working for HTTP but not database**
- This is the issue we're debugging
- Likely an attribute mismatch
- Check attribute names in Query 3

---

## Run These Now and Share Results!

Start with Queries 1, 2, and 3. The results will tell us exactly what's wrong.
