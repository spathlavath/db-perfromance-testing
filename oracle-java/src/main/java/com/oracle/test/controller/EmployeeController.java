package com.oracle.test.controller;

import com.oracle.test.service.EmployeeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/employees")
public class EmployeeController {

    @Autowired
    private EmployeeService employeeService;

    @GetMapping
    public ResponseEntity<?> getEmployees() {
        return ResponseEntity.ok(Map.of("employees", employeeService.getAllEmployees()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getEmployee(@PathVariable Long id) {
        return ResponseEntity.ok(employeeService.getEmployeeById(id));
    }

    @PostMapping
    public ResponseEntity<?> createEmployee(@RequestBody Map<String, Object> employee) {
        Long employeeId = employeeService.createEmployee(employee);
        return ResponseEntity.status(201).body(Map.of("employee_id", employeeId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEmployee(@PathVariable Long id, @RequestBody Map<String, Object> employee) {
        employeeService.updateEmployee(id, employee);
        return ResponseEntity.ok(Map.of("message", "Employee updated successfully"));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<?> getEmployeeHistory(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("history", employeeService.getEmployeeHistory(id)));
    }

    @PostMapping("/{id}/promote")
    public ResponseEntity<?> promoteEmployee(@PathVariable Long id, @RequestBody Map<String, Object> promotion) {
        employeeService.promoteEmployee(id, promotion);
        return ResponseEntity.ok(Map.of("message", "Employee promoted successfully"));
    }
}
