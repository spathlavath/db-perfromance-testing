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
        // Complex query with JOINs and aggregations using prepared statement
        String sql = "SELECT j.JOB_ID, j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY, " +
                     "COUNT(DISTINCT e.EMPLOYEE_ID) as CURRENT_EMPLOYEES, " +
                     "AVG(e.SALARY) as AVG_CURRENT_SALARY, " +
                     "MIN(e.SALARY) as MIN_CURRENT_SALARY, " +
                     "MAX(e.SALARY) as MAX_CURRENT_SALARY, " +
                     "COUNT(DISTINCT e.DEPARTMENT_ID) as DEPARTMENTS_WITH_JOB " +
                     "FROM JOBS j " +
                     "LEFT JOIN EMPLOYEES e ON j.JOB_ID = e.JOB_ID " +
                     "WHERE j.MIN_SALARY >= ? " +
                     "AND (j.JOB_TITLE LIKE ? OR j.MAX_SALARY >= ?) " +
                     "GROUP BY j.JOB_ID, j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY " +
                     "HAVING COUNT(DISTINCT e.EMPLOYEE_ID) >= ? " +
                     "ORDER BY AVG_CURRENT_SALARY DESC NULLS LAST, j.JOB_TITLE";
        return jdbcTemplate.queryForList(sql, 0, "%", 0, 0);
    }

    public List<Map<String, Object>> getJobsWithCompensationAnalysis() {
        // Complex query analyzing job compensation across multiple dimensions
        String sql = "SELECT j.JOB_ID, j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY, " +
                     "COUNT(DISTINCT e.EMPLOYEE_ID) as CURRENT_EMP_COUNT, " +
                     "AVG(e.SALARY) as CURRENT_AVG_SALARY, " +
                     "MEDIAN(e.SALARY) as CURRENT_MEDIAN_SALARY, " +
                     "PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY e.SALARY) as SALARY_25TH_PERCENTILE, " +
                     "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY e.SALARY) as SALARY_75TH_PERCENTILE, " +
                     "(SELECT COUNT(*) FROM EMPLOYEES e2 " +
                     " WHERE e2.JOB_ID = j.JOB_ID AND e2.SALARY < j.MIN_SALARY) as BELOW_MIN_COUNT, " +
                     "(SELECT COUNT(*) FROM EMPLOYEES e2 " +
                     " WHERE e2.JOB_ID = j.JOB_ID AND e2.SALARY > j.MAX_SALARY) as ABOVE_MAX_COUNT, " +
                     "(SELECT AVG(MONTHS_BETWEEN(jh.END_DATE, jh.START_DATE)) " +
                     " FROM JOB_HISTORY jh WHERE jh.JOB_ID = j.JOB_ID) as AVG_TENURE_MONTHS, " +
                     "COUNT(DISTINCT e.DEPARTMENT_ID) as DEPT_COUNT " +
                     "FROM JOBS j " +
                     "LEFT JOIN EMPLOYEES e ON j.JOB_ID = e.JOB_ID " +
                     "WHERE j.MAX_SALARY >= ? " +
                     "AND j.JOB_TITLE LIKE ? " +
                     "GROUP BY j.JOB_ID, j.JOB_TITLE, j.MIN_SALARY, j.MAX_SALARY " +
                     "HAVING AVG(e.SALARY) >= ? " +
                     "ORDER BY CURRENT_AVG_SALARY DESC NULLS LAST";
        return jdbcTemplate.queryForList(sql, 0, "%", 0);
    }
}
