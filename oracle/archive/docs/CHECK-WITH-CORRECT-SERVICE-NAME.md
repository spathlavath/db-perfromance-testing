# URGENT: Check Database Spans with Correct Service Name

Your actual service name is **`HR-Portal`** (not `Oracle-HR-Portal`)!

## Run these queries NOW:

### 1. Check for database spans with correct service name:

```sql
FROM Span 
SELECT count(*) 
WHERE service.name = 'HR-Portal'
  AND span.kind = 'client'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET name
LIMIT 20
```

**Expected**: Should show database operations if instrumentation is working.

### 2. Check what span.kind values exist for HR-Portal:

```sql
FROM Span 
SELECT count(*) 
WHERE service.name = 'HR-Portal'
SINCE 30 minutes ago
FACET span.kind
```

**Expected**: Should show 'server', 'client', 'internal', etc.

### 3. Check for ANY spans with db.system:

```sql
FROM Span 
SELECT count(*) 
WHERE service.name = 'HR-Portal'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET db.system, name
LIMIT 20
```

### 4. Check all attributes on server spans (HTTP):

```sql
FROM Span 
SELECT *
WHERE service.name = 'HR-Portal'
  AND span.kind = 'server'
SINCE 30 minutes ago
LIMIT 1
```

This will show if your spans have proper attributes.

### 5. Check if there are ANY client spans at all:

```sql
FROM Span 
SELECT count(*) 
WHERE service.name = 'HR-Portal'
  AND span.kind = 'client'
SINCE 30 minutes ago
FACET name
LIMIT 20
```

If this returns 0, then NO client spans are being created at all!

---

## Run Query 1 first and share the result!

If Query 1 returns **0 results**, it confirms database spans are NOT being created.

Then we need to check the VM to see why `oracledb-instrumented.js` isn't working.
