package com.oracle.test.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ReportService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getSalaryByDepartment() {
        String sql = "SELECT d.DEPARTMENT_NAME, " +
                     "COUNT(e.EMPLOYEE_ID) as EMPLOYEE_COUNT, " +
                     "MIN(e.SALARY) as MIN_SALARY, " +
                     "MAX(e.SALARY) as MAX_SALARY, " +
                     "AVG(e.SALARY) as AVG_SALARY, " +
                     "SUM(e.SALARY) as TOTAL_SALARY " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID " +
                     "GROUP BY d.DEPARTMENT_NAME " +
                     "ORDER BY TOTAL_SALARY DESC NULLS LAST";
        return jdbcTemplate.queryForList(sql);
    }
}
