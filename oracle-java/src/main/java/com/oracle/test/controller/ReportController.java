package com.oracle.test.controller;

import com.oracle.test.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/reports")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @GetMapping("/salary-by-department")
    public ResponseEntity<?> getSalaryByDepartment() {
        return ResponseEntity.ok(Map.of("report", reportService.getSalaryByDepartment()));
    }
}
