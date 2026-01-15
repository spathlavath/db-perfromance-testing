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
        // Complex query with multiple JOINs and aggregations using prepared statement
        String sql = "SELECT d.DEPARTMENT_NAME, d.DEPARTMENT_ID, " +
                     "m.FIRST_NAME as MANAGER_FIRST_NAME, m.LAST_NAME as MANAGER_LAST_NAME, " +
                     "l.CITY, l.COUNTRY_ID, " +
                     "COUNT(e.EMPLOYEE_ID) as EMPLOYEE_COUNT, " +
                     "COUNT(DISTINCT e.JOB_ID) as UNIQUE_JOBS, " +
                     "MIN(e.SALARY) as MIN_SALARY, " +
                     "MAX(e.SALARY) as MAX_SALARY, " +
                     "AVG(e.SALARY) as AVG_SALARY, " +
                     "SUM(e.SALARY) as TOTAL_SALARY, " +
                     "STDDEV(e.SALARY) as SALARY_STDDEV " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID AND e.SALARY >= ? " +
                     "LEFT JOIN EMPLOYEES m ON d.MANAGER_ID = m.EMPLOYEE_ID " +
                     "LEFT JOIN LOCATIONS l ON d.LOCATION_ID = l.LOCATION_ID " +
                     "WHERE d.DEPARTMENT_NAME LIKE ? OR d.DEPARTMENT_ID IS NOT NULL " +
                     "GROUP BY d.DEPARTMENT_NAME, d.DEPARTMENT_ID, " +
                     "m.FIRST_NAME, m.LAST_NAME, l.CITY, l.COUNTRY_ID " +
                     "HAVING COUNT(e.EMPLOYEE_ID) >= ? " +
                     "ORDER BY TOTAL_SALARY DESC NULLS LAST, d.DEPARTMENT_NAME";
        return jdbcTemplate.queryForList(sql, 0, "%", 0);
    }

    public List<Map<String, Object>> getEmployeeTurnoverReport() {
        // Simplified query analyzing employee metrics by department
        String sql = "SELECT d.DEPARTMENT_NAME, d.DEPARTMENT_ID, " +
                     "COUNT(DISTINCT e.EMPLOYEE_ID) as CURRENT_EMPLOYEES, " +
                     "COUNT(DISTINCT e.JOB_ID) as UNIQUE_CURRENT_JOBS, " +
                     "AVG(e.SALARY) as CURRENT_AVG_SALARY, " +
                     "MIN(e.HIRE_DATE) as EARLIEST_HIRE_DATE, " +
                     "MAX(e.HIRE_DATE) as LATEST_HIRE_DATE " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID " +
                     "WHERE d.DEPARTMENT_NAME LIKE ? " +
                     "GROUP BY d.DEPARTMENT_NAME, d.DEPARTMENT_ID " +
                     "HAVING COUNT(DISTINCT e.EMPLOYEE_ID) >= ? " +
                     "ORDER BY CURRENT_EMPLOYEES DESC NULLS LAST, d.DEPARTMENT_NAME";
        return jdbcTemplate.queryForList(sql, "%", 0);
    }

    public List<Map<String, Object>> getLocationWiseReport() {
        // Simplified query with location-based analysis
        String sql = "SELECT l.CITY, l.STATE_PROVINCE, l.COUNTRY_ID, l.LOCATION_ID, " +
                     "COUNT(DISTINCT d.DEPARTMENT_ID) as DEPT_COUNT, " +
                     "COUNT(DISTINCT e.EMPLOYEE_ID) as TOTAL_EMPLOYEES, " +
                     "AVG(e.SALARY) as AVG_SALARY, " +
                     "SUM(e.SALARY) as TOTAL_PAYROLL, " +
                     "MIN(e.SALARY) as MIN_SALARY, " +
                     "MAX(e.SALARY) as MAX_SALARY, " +
                     "COUNT(DISTINCT e.JOB_ID) as UNIQUE_JOBS " +
                     "FROM LOCATIONS l " +
                     "LEFT JOIN DEPARTMENTS d ON l.LOCATION_ID = d.LOCATION_ID " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID " +
                     "WHERE l.COUNTRY_ID LIKE ? " +
                     "GROUP BY l.CITY, l.STATE_PROVINCE, l.COUNTRY_ID, l.LOCATION_ID " +
                     "HAVING COUNT(DISTINCT e.EMPLOYEE_ID) >= ? " +
                     "ORDER BY TOTAL_PAYROLL DESC NULLS LAST, l.CITY";
        return jdbcTemplate.queryForList(sql, "%", 0);
    }
}
