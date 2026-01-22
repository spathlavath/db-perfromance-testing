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
        // Complex query with multiple JOINs and aggregations using prepared statement
        String sql = "SELECT d.DEPARTMENT_ID, d.DEPARTMENT_NAME, d.MANAGER_ID, " +
                     "d.LOCATION_ID, l.CITY, l.COUNTRY_ID, " +
                     "m.FIRST_NAME as MANAGER_FIRST_NAME, m.LAST_NAME as MANAGER_LAST_NAME, " +
                     "COUNT(e.EMPLOYEE_ID) as EMPLOYEE_COUNT, " +
                     "AVG(e.SALARY) as AVG_SALARY, " +
                     "MIN(e.SALARY) as MIN_SALARY, " +
                     "MAX(e.SALARY) as MAX_SALARY, " +
                     "SUM(e.SALARY) as TOTAL_SALARY, " +
                     "COUNT(DISTINCT e.JOB_ID) as UNIQUE_JOBS " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID AND e.SALARY >= ? " +
                     "LEFT JOIN EMPLOYEES m ON d.MANAGER_ID = m.EMPLOYEE_ID " +
                     "LEFT JOIN LOCATIONS l ON d.LOCATION_ID = l.LOCATION_ID " +
                     "WHERE d.DEPARTMENT_NAME LIKE ? OR d.LOCATION_ID IS NOT NULL " +
                     "GROUP BY d.DEPARTMENT_ID, d.DEPARTMENT_NAME, d.MANAGER_ID, d.LOCATION_ID, " +
                     "l.CITY, l.COUNTRY_ID, m.FIRST_NAME, m.LAST_NAME " +
                     "HAVING COUNT(e.EMPLOYEE_ID) >= ? " +
                     "ORDER BY TOTAL_SALARY DESC NULLS LAST, d.DEPARTMENT_NAME";
        return jdbcTemplate.queryForList(sql, 0, "%", 0);
    }

    public List<Map<String, Object>> getDepartmentEmployees(Long departmentId) {
        String sql = "SELECT EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, JOB_ID, SALARY " +
                     "FROM EMPLOYEES " +
                     "WHERE DEPARTMENT_ID = ? " +
                     "ORDER BY LAST_NAME, FIRST_NAME";
        return jdbcTemplate.queryForList(sql, departmentId);
    }

    public List<Map<String, Object>> getDepartmentsWithMetrics() {
        // Another complex query with window functions and CTEs simulation via subqueries
        String sql = "SELECT d.DEPARTMENT_ID, d.DEPARTMENT_NAME, " +
                     "l.CITY, l.COUNTRY_ID, " +
                     "COUNT(e.EMPLOYEE_ID) as EMP_COUNT, " +
                     "AVG(e.SALARY) as AVG_SALARY, " +
                     "SUM(CASE WHEN e.SALARY > " +
                     "  (SELECT AVG(e2.SALARY) FROM EMPLOYEES e2 WHERE e2.DEPARTMENT_ID = d.DEPARTMENT_ID) " +
                     "  THEN 1 ELSE 0 END) as ABOVE_AVG_COUNT, " +
                     "(SELECT MAX(e3.SALARY) - MIN(e3.SALARY) FROM EMPLOYEES e3 " +
                     " WHERE e3.DEPARTMENT_ID = d.DEPARTMENT_ID) as SALARY_RANGE, " +
                     "(SELECT COUNT(DISTINCT jh.JOB_ID) FROM JOB_HISTORY jh " +
                     " WHERE jh.DEPARTMENT_ID = d.DEPARTMENT_ID) as DISTINCT_HISTORICAL_JOBS " +
                     "FROM DEPARTMENTS d " +
                     "LEFT JOIN EMPLOYEES e ON d.DEPARTMENT_ID = e.DEPARTMENT_ID " +
                     "LEFT JOIN LOCATIONS l ON d.LOCATION_ID = l.LOCATION_ID " +
                     "WHERE l.COUNTRY_ID LIKE ? " +
                     "GROUP BY d.DEPARTMENT_ID, d.DEPARTMENT_NAME, l.CITY, l.COUNTRY_ID " +
                     "HAVING AVG(e.SALARY) >= ? " +
                     "ORDER BY AVG_SALARY DESC NULLS LAST";
        return jdbcTemplate.queryForList(sql, "%", 0);
    }
}
