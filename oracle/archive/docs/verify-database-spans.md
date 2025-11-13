# Verify Database Spans in New Relic

## Run these NRQL queries to debug what's happening:

### 1. Check ALL spans from Oracle-HR-Portal
```sql
FROM Span 
SELECT count(*), 
  latest(name),
  latest(span.kind),
  latest(db.system),
  latest(db.operation),
  latest(db.sql.table),
  latest(db.statement)
WHERE entity.name = 'Oracle-HR-Portal' 
SINCE 30 minutes ago
```

### 2. Check spans with SpanKind = CLIENT (database spans should be CLIENT)
```sql
FROM Span 
SELECT count(*), 
  latest(name)
WHERE entity.name = 'Oracle-HR-Portal' 
  AND span.kind = 'client'
SINCE 30 minutes ago
FACET name
```

### 3. Check for db.system attribute
```sql
FROM Span 
SELECT count(*) 
WHERE entity.name = 'Oracle-HR-Portal' 
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET db.system, name
```

### 4. Check what New Relic's "Database" view actually queries
```sql
FROM Span 
SELECT count(*), 
  average(duration) 
WHERE entity.name = 'Oracle-HR-Portal' 
  AND span.kind = 'client'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET db.system, db.sql.table, db.operation
LIMIT 20
```

### 5. Check for the specific trace you showed in screenshots
```sql
FROM Span 
SELECT * 
WHERE trace.id = 'f2a983ca272836fcdc1dfc13789eb107'
SINCE 1 hour ago
```

## What to look for:

1. **If Query 1 returns spans**: Spans are reaching New Relic ✅
2. **If Query 2 returns 0**: span.kind is not 'client' ❌
3. **If Query 3 returns 0**: db.system attribute is missing ❌
4. **If Query 4 returns data**: Database operations should appear in UI ✅
5. **If Query 5 shows the trace**: Look at all attributes on database spans

## Expected Results:

Query 4 should return something like:
```
db.system | db.sql.table | db.operation | count | avg(duration)
oracle    | employees    | select       | 8     | 3.87ms
oracle    | employees    | execute      | 6     | 0.85ms
oracle    | departments  | select       | 4     | 2.1ms
```

If Query 4 returns 0 results, the issue is one of:
- `span.kind` is not `'client'` 
- `db.system` attribute is missing
- `db.sql.table` attribute is missing
- `db.operation` attribute is missing

Run these queries and share the results!
