package com.oracle.test.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class JobService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getAllJobs() {
        String sql = "SELECT JOB_ID, JOB_TITLE, MIN_SALARY, MAX_SALARY " +
                     "FROM JOBS " +
                     "ORDER BY JOB_TITLE";
        return jdbcTemplate.queryForList(sql);
    }
}
