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
     * Create disk I/O wait event scenario
     */
    @PostMapping("/disk-io-wait")
    public ResponseEntity<?> createDiskIOWait(
            @RequestParam(defaultValue = "30") int durationSeconds) {
        try {
            Map<String, Object> result = blockingService.createDiskIOWait(durationSeconds);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create CPU wait event scenario
     */
    @PostMapping("/cpu-wait")
    public ResponseEntity<?> createCPUWait(
            @RequestParam(defaultValue = "30") int durationSeconds) {
        try {
            Map<String, Object> result = blockingService.createCPUWait(durationSeconds);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create latch contention scenario
     */
    @PostMapping("/latch-contention")
    public ResponseEntity<?> createLatchContention(
            @RequestParam(defaultValue = "30") int durationSeconds,
            @RequestParam(defaultValue = "5") int threadCount) {
        try {
            Map<String, Object> result = blockingService.createLatchContention(durationSeconds, threadCount);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create library cache wait scenario
     */
    @PostMapping("/library-cache-wait")
    public ResponseEntity<?> createLibraryCacheWait(
            @RequestParam(defaultValue = "30") int durationSeconds) {
        try {
            Map<String, Object> result = blockingService.createLibraryCacheWait(durationSeconds);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Create buffer busy wait scenario
     */
    @PostMapping("/buffer-busy-wait")
    public ResponseEntity<?> createBufferBusyWait(
            @RequestParam(defaultValue = "30") int durationSeconds,
            @RequestParam(defaultValue = "10") int concurrency) {
        try {
            Map<String, Object> result = blockingService.createBufferBusyWait(durationSeconds, concurrency);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
