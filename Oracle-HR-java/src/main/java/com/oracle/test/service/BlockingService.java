package com.oracle.test.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class BlockingService {

    private static final Logger logger = LoggerFactory.getLogger(BlockingService.class);

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * Locks an employee row for a specified duration
     * This simulates a long-running transaction that holds locks
     */
    @Transactional
    public void lockEmployeeForDuration(Long employeeId, int durationSeconds) throws InterruptedException {
        logger.info("Locking employee {} for {} seconds", employeeId, durationSeconds);

        // SELECT FOR UPDATE to lock the row
        String sql = "SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE";
        Map<String, Object> employee = jdbcTemplate.queryForMap(sql, employeeId);

        logger.info("Employee {} locked. Current salary: {}", employeeId, employee.get("SALARY"));

        // Hold the lock for the specified duration
        Thread.sleep(durationSeconds * 1000L);

        logger.info("Lock released for employee {}", employeeId);
        // Transaction commits here, releasing the lock
    }

    /**
     * Updates employee salary - will wait if row is locked
     */
    @Transactional
    public void updateEmployeeSalary(Long employeeId, Double newSalary) {
        logger.info("Attempting to update salary for employee {} to {}", employeeId, newSalary);

        String sql = "UPDATE EMPLOYEES SET SALARY = ? WHERE EMPLOYEE_ID = ?";
        int updated = jdbcTemplate.update(sql, newSalary, employeeId);

        logger.info("Salary updated for employee {}. Rows affected: {}", employeeId, updated);
    }

    /**
     * Locks all employees in a department using SELECT FOR UPDATE
     */
    @Transactional
    public int lockDepartmentEmployees(Long departmentId, int durationSeconds) throws InterruptedException {
        logger.info("Locking employees in department {} for {} seconds", departmentId, durationSeconds);

        // SELECT FOR UPDATE locks all matching rows
        String sql = "SELECT EMPLOYEE_ID, FIRST_NAME, LAST_NAME, SALARY " +
                     "FROM EMPLOYEES WHERE DEPARTMENT_ID = ? FOR UPDATE";
        List<Map<String, Object>> employees = jdbcTemplate.queryForList(sql, departmentId);

        logger.info("Locked {} employees in department {}", employees.size(), departmentId);

        // Hold the locks
        Thread.sleep(durationSeconds * 1000L);

        logger.info("Locks released for department {}", departmentId);
        return employees.size();
    }

    /**
     * Creates a deadlock scenario by having two transactions lock resources in opposite order
     */
    public void createDeadlock(Long employeeId1, Long employeeId2) {
        logger.info("Creating deadlock scenario between employees {} and {}", employeeId1, employeeId2);

        // Start two concurrent transactions
        CompletableFuture<Void> transaction1 = CompletableFuture.runAsync(() -> {
            try {
                deadlockTransaction1(employeeId1, employeeId2);
            } catch (Exception e) {
                logger.error("Transaction 1 failed: {}", e.getMessage());
                throw new RuntimeException(e);
            }
        });

        CompletableFuture<Void> transaction2 = CompletableFuture.runAsync(() -> {
            try {
                // Small delay to ensure transaction1 starts first
                Thread.sleep(500);
                deadlockTransaction2(employeeId1, employeeId2);
            } catch (Exception e) {
                logger.error("Transaction 2 failed: {}", e.getMessage());
                throw new RuntimeException(e);
            }
        });

        // Wait for both to complete (one should fail with deadlock)
        try {
            CompletableFuture.allOf(transaction1, transaction2).join();
        } catch (Exception e) {
            logger.info("Deadlock occurred as expected: {}", e.getMessage());
        }
    }

    @Transactional
    protected void deadlockTransaction1(Long emp1, Long emp2) throws InterruptedException {
        logger.info("Transaction 1: Locking employee {}", emp1);
        jdbcTemplate.queryForMap("SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE", emp1);

        Thread.sleep(1000); // Wait to ensure deadlock

        logger.info("Transaction 1: Attempting to lock employee {}", emp2);
        jdbcTemplate.queryForMap("SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE", emp2);

        logger.info("Transaction 1: Successfully locked both employees");
    }

    @Transactional
    protected void deadlockTransaction2(Long emp1, Long emp2) throws InterruptedException {
        logger.info("Transaction 2: Locking employee {}", emp2);
        jdbcTemplate.queryForMap("SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE", emp2);

        Thread.sleep(1000); // Wait to ensure deadlock

        logger.info("Transaction 2: Attempting to lock employee {}", emp1);
        jdbcTemplate.queryForMap("SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID = ? FOR UPDATE", emp1);

        logger.info("Transaction 2: Successfully locked both employees");
    }

    /**
     * Performs a batch salary increase with artificial delays to cause blocking
     */
    @Transactional
    public int batchSalaryIncrease(Long departmentId, Double increasePercent, int delaySeconds) throws InterruptedException {
        logger.info("Starting batch salary increase for department {}: {}%", departmentId, increasePercent);

        // Lock all employees in the department
        String selectSql = "SELECT EMPLOYEE_ID, SALARY FROM EMPLOYEES WHERE DEPARTMENT_ID = ? FOR UPDATE";
        List<Map<String, Object>> employees = jdbcTemplate.queryForList(selectSql, departmentId);

        logger.info("Locked {} employees for batch update", employees.size());

        // Artificial delay to simulate long-running operation
        Thread.sleep(delaySeconds * 1000L);

        // Update salaries
        String updateSql = "UPDATE EMPLOYEES SET SALARY = SALARY * (1 + ? / 100) WHERE DEPARTMENT_ID = ?";
        int updated = jdbcTemplate.update(updateSql, increasePercent, departmentId);

        logger.info("Batch salary increase completed. Updated {} employees", updated);
        return updated;
    }

    /**
     * Create high disk I/O wait event scenario
     * Performs full table scan to generate 'db file sequential read' wait events
     */
    @Transactional
    public Map<String, Object> createDiskIOWait(int durationSeconds) throws InterruptedException {
        logger.info("Creating disk I/O wait scenario for {} seconds", durationSeconds);

        long startTime = System.currentTimeMillis();
        int iterations = 0;

        while ((System.currentTimeMillis() - startTime) < (durationSeconds * 1000L)) {
            // Full table scan to generate disk I/O waits
            String sql = "SELECT /*+ FULL(e) */ COUNT(*), AVG(SALARY), SUM(SALARY) " +
                        "FROM EMPLOYEES e " +
                        "WHERE SALARY > 0";
            jdbcTemplate.queryForMap(sql);

            iterations++;
            Thread.sleep(100); // Small delay between scans
        }

        logger.info("Disk I/O wait scenario completed. {} iterations", iterations);
        return Map.of(
            "scenario", "disk_io_wait",
            "duration_seconds", durationSeconds,
            "iterations", iterations,
            "wait_events", "db file sequential read, db file scattered read"
        );
    }

    /**
     * Create CPU-intensive wait event scenario
     * Performs complex calculations to generate 'CPU time' wait events
     */
    @Transactional
    public Map<String, Object> createCPUWait(int durationSeconds) throws InterruptedException {
        logger.info("Creating CPU wait scenario for {} seconds", durationSeconds);

        long startTime = System.currentTimeMillis();
        int iterations = 0;

        while ((System.currentTimeMillis() - startTime) < (durationSeconds * 1000L)) {
            // CPU-intensive query with complex calculations
            String sql = "SELECT " +
                        "EMPLOYEE_ID, " +
                        "FIRST_NAME, " +
                        "LAST_NAME, " +
                        "SALARY, " +
                        "SALARY * POWER(1.05, MONTHS_BETWEEN(SYSDATE, HIRE_DATE)/12) as PROJECTED_SALARY, " +
                        "SQRT(SALARY) * LOG(10, SALARY + 1) as SALARY_SCORE " +
                        "FROM EMPLOYEES " +
                        "WHERE SALARY > 3000 " +
                        "ORDER BY SALARY_SCORE DESC";
            jdbcTemplate.queryForList(sql);

            iterations++;
            Thread.sleep(50); // Small delay
        }

        logger.info("CPU wait scenario completed. {} iterations", iterations);
        return Map.of(
            "scenario", "cpu_wait",
            "duration_seconds", durationSeconds,
            "iterations", iterations,
            "wait_events", "CPU time, direct path read"
        );
    }

    /**
     * Create latch contention scenario
     * Performs rapid concurrent updates to generate latch wait events
     */
    public Map<String, Object> createLatchContention(int durationSeconds, int threadCount) {
        logger.info("Creating latch contention scenario with {} threads for {} seconds", threadCount, durationSeconds);

        List<CompletableFuture<Integer>> futures = new java.util.ArrayList<>();

        for (int i = 0; i < threadCount; i++) {
            final int threadId = i;
            CompletableFuture<Integer> future = CompletableFuture.supplyAsync(() -> {
                int operations = 0;
                long startTime = System.currentTimeMillis();

                while ((System.currentTimeMillis() - startTime) < (durationSeconds * 1000L)) {
                    try {
                        // Rapid updates causing latch contention
                        updateEmployeeSalaryNoLog(100L + (threadId % 10), 10000.0 + (threadId * 100));
                        operations++;
                    } catch (Exception e) {
                        logger.warn("Thread {} got exception: {}", threadId, e.getMessage());
                    }
                }
                return operations;
            });
            futures.add(future);
        }

        // Wait for all threads to complete
        int totalOperations = futures.stream()
            .map(CompletableFuture::join)
            .mapToInt(Integer::intValue)
            .sum();

        logger.info("Latch contention scenario completed. {} total operations", totalOperations);
        return Map.of(
            "scenario", "latch_contention",
            "duration_seconds", durationSeconds,
            "thread_count", threadCount,
            "total_operations", totalOperations,
            "wait_events", "latch: cache buffers chains, latch: shared pool"
        );
    }

    @Transactional
    protected void updateEmployeeSalaryNoLog(Long employeeId, Double newSalary) {
        String sql = "UPDATE EMPLOYEES SET SALARY = ? WHERE EMPLOYEE_ID = ?";
        jdbcTemplate.update(sql, newSalary, employeeId);
    }

    /**
     * Create library cache lock scenario
     * Repeatedly compiles PL/SQL to generate library cache waits
     */
    @Transactional
    public Map<String, Object> createLibraryCacheWait(int durationSeconds) throws InterruptedException {
        logger.info("Creating library cache wait scenario for {} seconds", durationSeconds);

        long startTime = System.currentTimeMillis();
        int iterations = 0;

        while ((System.currentTimeMillis() - startTime) < (durationSeconds * 1000L)) {
            // Execute different SQL statements to cause library cache activity
            String sql = "SELECT /*+ HINT_" + iterations + " */ " +
                        "EMPLOYEE_ID, FIRST_NAME, LAST_NAME, SALARY " +
                        "FROM EMPLOYEES " +
                        "WHERE EMPLOYEE_ID = " + (100 + (iterations % 10));

            try {
                jdbcTemplate.queryForList(sql);
            } catch (Exception e) {
                logger.warn("Library cache query failed: {}", e.getMessage());
            }

            iterations++;
            Thread.sleep(100);
        }

        logger.info("Library cache wait scenario completed. {} iterations", iterations);
        return Map.of(
            "scenario", "library_cache_wait",
            "duration_seconds", durationSeconds,
            "iterations", iterations,
            "wait_events", "library cache lock, library cache pin"
        );
    }

    /**
     * Create buffer busy wait scenario
     * Multiple sessions trying to access same data blocks
     */
    public Map<String, Object> createBufferBusyWait(int durationSeconds, int concurrency) {
        logger.info("Creating buffer busy wait scenario with {} concurrent operations for {} seconds",
                   concurrency, durationSeconds);

        List<CompletableFuture<Integer>> futures = new java.util.ArrayList<>();

        // All threads will hit the same small set of rows
        for (int i = 0; i < concurrency; i++) {
            CompletableFuture<Integer> future = CompletableFuture.supplyAsync(() -> {
                int operations = 0;
                long startTime = System.currentTimeMillis();

                while ((System.currentTimeMillis() - startTime) < (durationSeconds * 1000L)) {
                    try {
                        // All threads read same hot rows
                        String sql = "SELECT * FROM EMPLOYEES WHERE EMPLOYEE_ID BETWEEN 100 AND 110";
                        jdbcTemplate.queryForList(sql);
                        operations++;
                        Thread.sleep(10);
                    } catch (Exception e) {
                        logger.warn("Buffer busy operation failed: {}", e.getMessage());
                    }
                }
                return operations;
            });
            futures.add(future);
        }

        int totalOperations = futures.stream()
            .map(CompletableFuture::join)
            .mapToInt(Integer::intValue)
            .sum();

        logger.info("Buffer busy wait scenario completed. {} total operations", totalOperations);
        return Map.of(
            "scenario", "buffer_busy_wait",
            "duration_seconds", durationSeconds,
            "concurrency", concurrency,
            "total_operations", totalOperations,
            "wait_events", "buffer busy waits, read by other session"
        );
    }

}
