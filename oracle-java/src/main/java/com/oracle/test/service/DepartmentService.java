package com.oracle.test.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class DepartmentService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getAllDepartments() {
        String sql = "SELECT d.DEPARTMENT_ID, d.DEPARTMENT_NAME, d.MANAGER_ID, " +
                     "d.LOCATION_ID, COUNT(e.EMPLOYEE_ID) as EMPLOYEE_COUNT, " +
                     "AVG(e.SALARY) as AVG_SALARY " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID " +
                     "GROUP BY d.DEPARTMENT_ID, d.DEPARTMENT_NAME, d.MANAGER_ID, d.LOCATION_ID " +
                     "ORDER BY d.DEPARTMENT_ID";
        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getDepartmentEmployees(Long departmentId) {
        String sql = "SELECT EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, JOB_ID, SALARY " +
                     "FROM EMPLOYEES " +
                     "WHERE DEPARTMENT_ID = ? " +
                     "ORDER BY LAST_NAME, FIRST_NAME";
        return jdbcTemplate.queryForList(sql, departmentId);
    }
}
