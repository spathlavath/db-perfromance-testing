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
     * Get information about current locks in the database
     */
    public List<Map<String, Object>> getCurrentLocks() {
        String sql = "SELECT " +
                     "s.sid, " +
                     "s.serial#, " +
                     "s.username, " +
                     "s.program, " +
                     "s.machine, " +
                     "l.type, " +
                     "l.lmode, " +
                     "l.request, " +
                     "o.object_name " +
                     "FROM v$lock l " +
                     "JOIN v$session s ON l.sid = s.sid " +
                     "LEFT JOIN dba_objects o ON l.id1 = o.object_id " +
                     "WHERE l.type IN ('TM', 'TX') " +
                     "ORDER BY s.sid";

        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            logger.warn("Unable to query locks (may need DBA privileges): {}", e.getMessage());
            return List.of(Map.of("error", "Unable to query locks. DBA privileges may be required."));
        }
    }

    /**
     * Get information about blocking sessions
     */
    public List<Map<String, Object>> getBlockingSessions() {
        String sql = "SELECT " +
                     "blocking.sid AS blocking_session, " +
                     "blocking.serial# AS blocking_serial, " +
                     "blocking.username AS blocking_user, " +
                     "blocking.program AS blocking_program, " +
                     "blocked.sid AS blocked_session, " +
                     "blocked.serial# AS blocked_serial, " +
                     "blocked.username AS blocked_user, " +
                     "blocked.program AS blocked_program, " +
                     "blocked.seconds_in_wait " +
                     "FROM v$session blocking " +
                     "JOIN v$session blocked ON blocking.sid = blocked.blocking_session " +
                     "WHERE blocked.blocking_session IS NOT NULL " +
                     "ORDER BY blocked.seconds_in_wait DESC";

        try {
            return jdbcTemplate.queryForList(sql);
        } catch (Exception e) {
            logger.warn("Unable to query blocking sessions (may need DBA privileges): {}", e.getMessage());
            return List.of(Map.of("error", "Unable to query blocking sessions. DBA privileges may be required."));
        }
    }
}
