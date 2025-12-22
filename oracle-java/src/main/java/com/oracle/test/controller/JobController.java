package com.oracle.test.controller;

import com.oracle.test.service.JobService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/jobs")
public class JobController {

    @Autowired
    private JobService jobService;

    @GetMapping
    public ResponseEntity<?> getAllJobs() {
        return ResponseEntity.ok(Map.of("jobs", jobService.getAllJobs()));
    }
}
