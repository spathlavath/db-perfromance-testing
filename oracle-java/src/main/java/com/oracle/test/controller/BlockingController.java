package com.oracle.test.controller;

import com.oracle.test.service.BlockingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/blocking")
public class BlockingController {

    @Autowired
    private BlockingService blockingService;

    /**
     * Starts a long-running transaction that locks a specific employee row
     * This will hold the lock for the specified duration (in seconds)
     */
    @PostMapping("/lock-employee/{id}")
    public ResponseEntity<?> lockEmployee(
            @PathVariable Long id,
            @RequestParam(defaultValue = "30") int durationSeconds) {
        try {
            blockingService.lockEmployeeForDuration(id, durationSeconds);
            return ResponseEntity.ok(Map.of(
                "message", "Employee locked for " + durationSeconds + " seconds",
                "employee_id", id
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Updates employee salary - will be blocked if row is locked
     */
    @PutMapping("/update-salary/{id}")
    public ResponseEntity<?> updateSalary(
            @PathVariable Long id,
            @RequestParam Double newSalary) {
        try {
            blockingService.updateEmployeeSalary(id, newSalary);
            return ResponseEntity.ok(Map.of(
                "message", "Salary updated successfully",
                "employee_id", id,
                "new_salary", newSalary
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Starts a long-running transaction with SELECT FOR UPDATE
     * This locks the selected rows
     */
    @PostMapping("/lock-department-employees/{deptId}")
    public ResponseEntity<?> lockDepartmentEmployees(
            @PathVariable Long deptId,
            @RequestParam(defaultValue = "30") int durationSeconds) {
        try {
            int lockedCount = blockingService.lockDepartmentEmployees(deptId, durationSeconds);
            return ResponseEntity.ok(Map.of(
                "message", "Locked " + lockedCount + " employees for " + durationSeconds + " seconds",
                "department_id", deptId,
                "locked_employees", lockedCount
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Creates a deadlock scenario between two employees
     */
    @PostMapping("/create-deadlock")
    public ResponseEntity<?> createDeadlock(
            @RequestParam Long employeeId1,
            @RequestParam Long employeeId2) {
        try {
            blockingService.createDeadlock(employeeId1, employeeId2);
            return ResponseEntity.ok(Map.of(
                "message", "Deadlock scenario completed (one transaction should have failed)"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of(
                "error", e.getMessage(),
                "message", "Expected behavior - one transaction was rolled back due to deadlock"
            ));
        }
    }

    /**
     * Long-running batch update that will cause blocking
     */
    @PostMapping("/batch-salary-increase/{deptId}")
    public ResponseEntity<?> batchSalaryIncrease(
            @PathVariable Long deptId,
            @RequestParam Double increasePercent,
            @RequestParam(defaultValue = "5") int delaySeconds) {
        try {
            int updatedCount = blockingService.batchSalaryIncrease(deptId, increasePercent, delaySeconds);
            return ResponseEntity.ok(Map.of(
                "message", "Batch salary increase completed",
                "department_id", deptId,
                "employees_updated", updatedCount,
                "increase_percent", increasePercent
            ));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get information about current locks in the database
     */
    @GetMapping("/locks")
    public ResponseEntity<?> getCurrentLocks() {
        try {
            return ResponseEntity.ok(Map.of("locks", blockingService.getCurrentLocks()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get information about blocking sessions
     */
    @GetMapping("/blocking-sessions")
    public ResponseEntity<?> getBlockingSessions() {
        try {
            return ResponseEntity.ok(Map.of("blocking_sessions", blockingService.getBlockingSessions()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
