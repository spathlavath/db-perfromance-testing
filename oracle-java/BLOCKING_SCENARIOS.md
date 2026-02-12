# Database Blocking Scenarios

This document describes the database blocking scenarios available in the oracle-java application for testing and observability.

## Available Endpoints

### 1. Lock Single Employee Row
**Endpoint:** `POST /blocking/lock-employee/{id}`

**Parameters:**
- `id` (path) - Employee ID to lock
- `durationSeconds` (query, default=30) - How long to hold the lock

**Description:** Starts a transaction that locks a specific employee row using `SELECT FOR UPDATE`. The lock is held for the specified duration, preventing other transactions from updating or locking that row.

**Example:**
```bash
# Lock employee 100 for 30 seconds
curl -X POST "http://localhost:3000/blocking/lock-employee/100?durationSeconds=30"
```

**Use Case:** Test row-level locking and blocking. While this endpoint is running, attempts to update the same employee will be blocked.

---

### 2. Update Employee Salary
**Endpoint:** `PUT /blocking/update-salary/{id}`

**Parameters:**
- `id` (path) - Employee ID
- `newSalary` (query) - New salary amount

**Description:** Updates an employee's salary. If another transaction has locked this employee row, this operation will wait until the lock is released.

**Example:**
```bash
# Update salary for employee 100
curl -X PUT "http://localhost:3000/blocking/update-salary/100?newSalary=15000"
```

**Use Case:** Test blocking behavior. Run this while `/blocking/lock-employee/100` is active to see blocking in action.

---

### 3. Lock Department Employees
**Endpoint:** `POST /blocking/lock-department-employees/{deptId}`

**Parameters:**
- `deptId` (path) - Department ID
- `durationSeconds` (query, default=30) - How long to hold the locks

**Description:** Locks all employees in a department using `SELECT FOR UPDATE`. This creates multiple row locks simultaneously.

**Example:**
```bash
# Lock all employees in department 50 for 45 seconds
curl -X POST "http://localhost:3000/blocking/lock-department-employees/50?durationSeconds=45"
```

**Use Case:** Test multiple row locks and observe blocking when trying to update employees in that department.

---

### 4. Create Deadlock
**Endpoint:** `POST /blocking/create-deadlock`

**Parameters:**
- `employeeId1` (query) - First employee ID
- `employeeId2` (query) - Second employee ID

**Description:** Creates a deadlock scenario by starting two concurrent transactions that lock resources in opposite order. One transaction will be automatically rolled back by Oracle.

**Example:**
```bash
# Create deadlock between employees 100 and 101
curl -X POST "http://localhost:3000/blocking/create-deadlock?employeeId1=100&employeeId2=101"
```

**Use Case:** Test deadlock detection and recovery. Observe how Oracle handles deadlocks and which transaction gets rolled back.

---

### 5. Batch Salary Increase
**Endpoint:** `POST /blocking/batch-salary-increase/{deptId}`

**Parameters:**
- `deptId` (path) - Department ID
- `increasePercent` (query) - Percentage increase
- `delaySeconds` (query, default=5) - Artificial delay during the operation

**Description:** Performs a batch salary increase for all employees in a department. Includes an artificial delay to simulate a long-running operation, causing blocking for other transactions.

**Example:**
```bash
# Increase salaries by 10% in department 50 with 10-second delay
curl -X POST "http://localhost:3000/blocking/batch-salary-increase/50?increasePercent=10&delaySeconds=10"
```

**Use Case:** Test long-running transactions and their impact on concurrency.

---

### 6. Get Current Locks
**Endpoint:** `GET /blocking/locks`

**Description:** Queries Oracle's `v$lock` and `v$session` views to show current locks in the database.

**Example:**
```bash
curl "http://localhost:3000/blocking/locks"
```

**Note:** May require DBA privileges to query system views.

---

### 7. Get Blocking Sessions
**Endpoint:** `GET /blocking/blocking-sessions`

**Description:** Shows which sessions are blocking other sessions, including wait times.

**Example:**
```bash
curl "http://localhost:3000/blocking/blocking-sessions"
```

**Note:** May require DBA privileges to query system views.

---

## Testing Scenarios

### Scenario 1: Simple Row Blocking
1. Start lock on employee 100:
   ```bash
   curl -X POST "http://localhost:3000/blocking/lock-employee/100?durationSeconds=60"
   ```

2. In another terminal, try to update the same employee (will block):
   ```bash
   curl -X PUT "http://localhost:3000/blocking/update-salary/100?newSalary=20000"
   ```

3. Monitor the blocking:
   ```bash
   curl "http://localhost:3000/blocking/blocking-sessions"
   ```

### Scenario 2: Department-Level Blocking
1. Lock all employees in department 50:
   ```bash
   curl -X POST "http://localhost:3000/blocking/lock-department-employees/50?durationSeconds=60"
   ```

2. Try to run batch salary increase (will block):
   ```bash
   curl -X POST "http://localhost:3000/blocking/batch-salary-increase/50?increasePercent=5&delaySeconds=5"
   ```

### Scenario 3: Deadlock Testing
1. Create a deadlock:
   ```bash
   curl -X POST "http://localhost:3000/blocking/create-deadlock?employeeId1=100&employeeId2=101"
   ```

2. Check application logs to see which transaction was rolled back.

### Scenario 4: Observing with New Relic
1. Start a blocking scenario
2. In New Relic, query for database metrics with blocking:
   ```sql
   SELECT * FROM Metric WHERE metricName LIKE 'newrelicoracledb%'
   FACET client_name, transaction_name, normalised_sql_hash
   ```

3. Look for:
   - Increased wait times
   - SQL statements with matching `client_name` or `transaction_name` from the SQL comments
   - Correlation between blocking and performance metrics

---

## SQL Comments and Observability

The blocking endpoints will generate SQL comments that include:
- `nr_service_guid` - Service identifier
- `nr_service` - Service name

These comments will appear in:
1. Oracle v$sql views
2. New Relic database metrics (via the OTel collector)
3. Application logs (when DEBUG logging is enabled)

Example SQL with comments:
```sql
/* nr_service_guid=11600319|APM|APPLICATION|283090211 */
/* nr_service=Oracle-HR-Portal-Java */
SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE
```

---

## Architecture Notes

- **Transactions:** All blocking operations use Spring's `@Transactional` annotation
- **Lock Type:** Primarily uses `SELECT FOR UPDATE` for row-level locks
- **Timeout:** Oracle's default lock wait timeout applies
- **Async Operations:** Deadlock scenario uses `CompletableFuture` for concurrent execution
- **Thread Safety:** Each endpoint runs in its own transaction/thread

---

## Troubleshooting

### Locks Not Appearing
- Ensure transactions are not auto-committing
- Check transaction isolation level
- Verify the database connection pool has enough connections

### Unable to Query v$ Views
- The `/blocking/locks` and `/blocking/blocking-sessions` endpoints may require DBA privileges
- Grant required permissions: `GRANT SELECT ON v$lock TO hr;`

### Deadlock Not Occurring
- Increase the sleep duration in the deadlock methods
- Ensure both transactions start approximately at the same time
- Check Oracle's deadlock detection settings

---

## Integration with OTel Collector

The SQL comments generated by these blocking scenarios will be captured by the New Relic Oracle receiver in the OTel collector. You can correlate:

1. **Blocking events** with `normalised_sql_hash`
2. **Service information** from SQL comments with APM traces
3. **Performance degradation** with specific transactions causing blocks

This enables end-to-end observability from application transactions through database blocking to performance impact.
