package com.oracle.test.controller;

import com.oracle.test.service.DepartmentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/departments")
public class DepartmentController {

    @Autowired
    private DepartmentService departmentService;

    @GetMapping
    public ResponseEntity<?> getDepartments() {
        return ResponseEntity.ok(Map.of("departments", departmentService.getAllDepartments()));
    }

    @GetMapping("/{id}/employees")
    public ResponseEntity<?> getDepartmentEmployees(@PathVariable Long id) {
        return ResponseEntity.ok(Map.of("employees", departmentService.getDepartmentEmployees(id)));
    }
}
