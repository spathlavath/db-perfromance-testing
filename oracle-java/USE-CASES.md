# Oracle Database Load Test - Use Cases

## Summary of Test Coverage

### 📊 Total API Endpoints: 20+
### 🔄 Concurrent Workers: 3 (parallel execution)
### ⏱️  Test Scenarios: 3 distinct patterns

---

## Use Case 1: Read-Only Operations
**Worker:** scenario-read-only.sh
**Pattern:** Fast, frequent reads
**No Blocking:** ✅

| API | Query Type | Use Case |
|-----|-----------|----------|
| GET /employees/{id} | Simple SELECT | Individual employee lookup |
| GET /departments/{id}/employees | JOIN query | Department roster |
| GET /jobs | Simple SELECT | Job catalog |

**Validates:**
- Fast query performance
- Connection pooling
- Basic prepared statements
- No lock contention

---

## Use Case 2: Analytical/Reporting Queries
**Worker:** scenario-slow-queries.sh
**Pattern:** Complex, slower queries
**Potential Slow Queries:** ✅

| API | Query Type | Use Case |
|-----|-----------|----------|
| GET /employees | Complex JOIN + subquery | Full employee list with details |
| GET /employees/{id}/history | Multi-table JOIN | Employee job history |
| GET /departments/metrics | GROUP BY + aggregation | Department statistics |
| GET /jobs/compensation-analysis | Percentile calculation | Salary analysis |
| GET /reports/salary-by-department | Heavy aggregation | Finance reporting |
| GET /reports/employee-turnover | Date range analysis | HR metrics |
| GET /reports/location-wise | Geographic aggregation | Location analysis |

**Validates:**
- Slow query detection
- Query performance over time
- Execution plan changes
- Resource consumption (CPU, buffer gets)

---

## Use Case 3: Blocking & Locking Scenarios
**Worker:** scenario-blocking.sh
**Pattern:** Concurrent updates causing locks
**Wait Events:** ✅

| API | Lock Type | Use Case |
|-----|-----------|----------|
| POST /blocking/lock-employee/{id} | Row-level lock (SELECT FOR UPDATE) | Pessimistic locking |
| POST /blocking/lock-department-employees/{deptId} | Multi-row lock | Batch processing |
| POST /blocking/batch-salary-increase/{deptId} | UPDATE with delay | Long-running transaction |
| GET /blocking/locks | Query v$lock | Monitor active locks |
| GET /blocking/blocking-sessions | Query v$session | Identify blockers |

**Validates:**
- Blocking query detection
- Wait event monitoring
- Lock timeout handling
- Deadlock detection
- Blocker/blocked correlation

---

## Additional Available APIs (Not in automated tests)

### Employee Operations
- POST /employees - Create employee
- PUT /employees/{id} - Update employee
- POST /employees/{id}/promote - Promote employee

### Deadlock Testing
- POST /blocking/create-deadlock - Intentional deadlock
- PUT /blocking/update-salary/{id} - Direct salary update

### Health/Monitoring
- GET /health - Application health
- GET /pool-stats - Connection pool statistics

---

## Testing Coverage Matrix

| Feature | Scenario 1 | Scenario 2 | Scenario 3 |
|---------|-----------|------------|------------|
| Simple SELECT | ✅ | ✅ | ✅ |
| Complex JOIN | ❌ | ✅ | ❌ |
| Aggregation | ❌ | ✅ | ❌ |
| Prepared Statements | ✅ | ✅ | ✅ |
| Row Locking | ❌ | ❌ | ✅ |
| Wait Events | ❌ | ❌ | ✅ |
| Blocking Detection | ❌ | ❌ | ✅ |
| Slow Query Detection | ❌ | ✅ | ❌ |

---

## OTel Metrics Generated

### From All Scenarios:
- `newrelicoracledb.slow_queries.*` - Query performance metrics
- SQL ID, execution count, elapsed time, CPU time
- Normalized SQL hash for grouping

### From Scenario 3 (Blocking):
- `newrelicoracledb.wait_events.*` - Wait event metrics
- `newrelicoracledb.blocking_queries.*` - Blocking session metrics
- Blocker/blocked correlation via SQL ID

---

## Expected Results in New Relic

### Slow Queries Dashboard
```sql
SELECT query_text, average(interval_avg_elapsed_time_ms)
FROM newrelicoracledb.slow_queries
FACET normalised_sql_hash
SINCE 30 minutes ago
```

### Blocking Sessions
```sql
SELECT * FROM newrelicoracledb.blocking_queries
WHERE final_blocker_query_id IS NOT NULL
FACET normalised_blocking_sql_hash
SINCE 30 minutes ago
```

### Wait Events
```sql
SELECT average(current_wait_time_ms)
FROM newrelicoracledb.wait_events
FACET wait_event_name, wait_category
SINCE 30 minutes ago
```
