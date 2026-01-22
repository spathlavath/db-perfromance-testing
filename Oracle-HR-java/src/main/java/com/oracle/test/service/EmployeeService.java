package com.oracle.test.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class EmployeeService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getAllEmployees() {
        // Complex query with multiple JOINs, subqueries, and conditions to make it slower
        String sql = "SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME, e.EMAIL, " +
                     "e.PHONE_NUMBER, e.HIRE_DATE, e.JOB_ID, e.SALARY, " +
                     "e.MANAGER_ID, e.DEPARTMENT_ID, d.DEPARTMENT_NAME, " +
                     "j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY, " +
                     "m.FIRST_NAME as MANAGER_FIRST_NAME, m.LAST_NAME as MANAGER_LAST_NAME, " +
                     "l.CITY, l.STATE_PROVINCE, l.COUNTRY_ID, " +
                     "(SELECT COUNT(*) FROM JOB_HISTORY jh WHERE jh.EMPLOYEE_ID = e.EMPLOYEE_ID) as JOB_HISTORY_COUNT, " +
                     "(SELECT AVG(SALARY) FROM EMPLOYEES WHERE DEPARTMENT_ID = e.DEPARTMENT_ID) as DEPT_AVG_SALARY, " +
                     "(SELECT MAX(SALARY) FROM EMPLOYEES WHERE JOB_ID = e.JOB_ID) as JOB_MAX_SALARY " +
                     "FROM EMPLOYEES e " +
                     "LEFT JOIN DEPARTMENTS d ON e.DEPARTMENT_ID = d.DEPARTMENT_ID " +
                     "LEFT JOIN JOBS j ON e.JOB_ID = j.JOB_ID " +
                     "LEFT JOIN EMPLOYEES m ON e.MANAGER_ID = m.EMPLOYEE_ID " +
                     "LEFT JOIN LOCATIONS l ON d.LOCATION_ID = l.LOCATION_ID " +
                     "WHERE e.SALARY >= ? " +
                     "AND (e.DEPARTMENT_ID IS NOT NULL OR e.JOB_ID LIKE ?) " +
                     "AND e.HIRE_DATE >= TO_DATE(?, 'YYYY-MM-DD') " +
                     "ORDER BY e.DEPARTMENT_ID, e.SALARY DESC, e.LAST_NAME";

        // Use parameters to force prepared statement (which gets NR comments)
        return jdbcTemplate.queryForList(sql, 3000, "%", "1987-01-01");
    }

    public Map<String, Object> getEmployeeById(Long id) {
        String sql = "SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME, e.EMAIL, " +
                     "e.PHONE_NUMBER, e.HIRE_DATE, e.JOB_ID, e.SALARY, " +
                     "e.MANAGER_ID, e.DEPARTMENT_ID, d.DEPARTMENT_NAME, " +
                     "j.JOB_TITLE " +
                     "FROM EMPLOYEES e " +
                     "LEFT JOIN DEPARTMENTS d ON e.DEPARTMENT_ID = d.DEPARTMENT_ID " +
                     "LEFT JOIN JOBS j ON e.JOB_ID = j.JOB_ID " +
                     "WHERE e.EMPLOYEE_ID = ?";
        return jdbcTemplate.queryForMap(sql, id);
    }

    @Transactional
    public Long createEmployee(Map<String, Object> employee) {
        String sql = "INSERT INTO EMPLOYEES (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, " +
                     "PHONE_NUMBER, HIRE_DATE, JOB_ID, SALARY, MANAGER_ID, DEPARTMENT_ID) " +
                     "VALUES (EMPLOYEES_SEQ.NEXTVAL, ?, ?, ?, ?, TO_DATE(?, 'YYYY-MM-DD'), ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                employee.get("first_name"),
                employee.get("last_name"),
                employee.get("email"),
                employee.get("phone_number"),
                employee.get("hire_date"),
                employee.get("job_id"),
                employee.get("salary"),
                employee.get("manager_id"),
                employee.get("department_id"));

        return jdbcTemplate.queryForObject("SELECT EMPLOYEES_SEQ.CURRVAL FROM DUAL", Long.class);
    }

    @Transactional
    public void updateEmployee(Long id, Map<String, Object> employee) {
        String sql = "UPDATE EMPLOYEES SET SALARY = ?, JOB_ID = ?, " +
                     "DEPARTMENT_ID = ?, MANAGER_ID = ? WHERE EMPLOYEE_ID = ?";
        jdbcTemplate.update(sql,
                employee.get("salary"),
                employee.get("job_id"),
                employee.get("department_id"),
                employee.get("manager_id"),
                id);
    }

    public List<Map<String, Object>> getEmployeeHistory(Long id) {
        String sql = "SELECT jh.*, j.JOB_TITLE, d.DEPARTMENT_NAME " +
                     "FROM JOB_HISTORY jh " +
                     "JOIN JOBS j ON jh.JOB_ID = j.JOB_ID " +
                     "JOIN DEPARTMENTS d ON jh.DEPARTMENT_ID = d.DEPARTMENT_ID " +
                     "WHERE jh.EMPLOYEE_ID = ? " +
                     "ORDER BY jh.START_DATE DESC";
        return jdbcTemplate.queryForList(sql, id);
    }

    @Transactional
    public void promoteEmployee(Long id, Map<String, Object> promotion) {
        // Insert into job history
        String histSql = "INSERT INTO JOB_HISTORY (EMPLOYEE_ID, START_DATE, END_DATE, JOB_ID, DEPARTMENT_ID) " +
                        "SELECT EMPLOYEE_ID, HIRE_DATE, SYSDATE, JOB_ID, DEPARTMENT_ID " +
                        "FROM EMPLOYEES WHERE EMPLOYEE_ID = ?";
        jdbcTemplate.update(histSql, id);

        // Update employee
        String updateSql = "UPDATE EMPLOYEES SET JOB_ID = ?, SALARY = ?, DEPARTMENT_ID = ? " +
                          "WHERE EMPLOYEE_ID = ?";
        jdbcTemplate.update(updateSql,
                promotion.get("new_job_id"),
                promotion.get("new_salary"),
                promotion.get("new_department_id"),
                id);
    }
}
