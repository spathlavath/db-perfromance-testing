# Find Your Actual Service Name

The diagnostic queries show that `service.name = 'Oracle-HR-Portal'` returns 0 results, but your entity.guid has spans!

## Run this query to find the ACTUAL service name:

```sql
FROM Span 
SELECT uniqueCount(service.name), latest(entity.name)
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 1 hour ago
FACET service.name
```

This will show you what `service.name` is actually set to.

## Then check for database spans with the CORRECT service name:

```sql
FROM Span 
SELECT count(*) 
WHERE service.name = '<THE_ACTUAL_SERVICE_NAME_FROM_ABOVE>'
  AND span.kind = 'client'
  AND db.system IS NOT NULL
SINCE 30 minutes ago
FACET name
```

## Also check what entity.name maps to this GUID:

```sql
FROM Span 
SELECT latest(entity.name), latest(service.name), latest(entity.guid)
WHERE entity.guid = 'MTIzMDk4MDR8RVhUfFNFUlZJQ0V8LTM2NjYzMzE2NTEwNzI5MzU2ODU'
SINCE 1 hour ago
```

---

## CRITICAL ISSUE IDENTIFIED:

**Your query results show DATABASE SPANS ARE NOT BEING CREATED!**

This means:
- ❌ `oracledb-instrumented.js` is NOT wrapping the database calls
- ❌ The instrumentation isn't running at all
- ❌ Or the file wasn't deployed to the container

Run the verification script on the VM:

```bash
chmod +x verify-instrumentation-on-vm.sh
./verify-instrumentation-on-vm.sh
```

This will check:
1. If `oracledb-instrumented.js` exists on VM
2. If it's being required by `app.js`  
3. If the instrumentation message appears in container logs
4. If `@opentelemetry/semantic-conventions` is installed in container

**Share the results!**
