package com.oracle.test.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.util.Map;

@RestController
public class HealthController {

    @Autowired
    private DataSource dataSource;

    @GetMapping("/health")
    public ResponseEntity<?> health() {
        try (Connection conn = dataSource.getConnection()) {
            return ResponseEntity.ok(Map.of(
                    "status", "healthy",
                    "database", "connected"
            ));
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of(
                    "status", "unhealthy",
                    "error", e.getMessage()
            ));
        }
    }

    @GetMapping("/pool-stats")
    public ResponseEntity<?> poolStats() {
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "message", "Pool stats available via JMX"
        ));
    }
}
