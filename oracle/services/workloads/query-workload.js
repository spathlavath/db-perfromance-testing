/**
 * Query Performance Workload - HR Schema
 * Generates various query patterns using HR schema tables to test QPM metrics
 * Tables: EMPLOYEES, DEPARTMENTS, JOBS, LOCATIONS, COUNTRIES, REGIONS, JOB_HISTORY
 */

let isRunning = false;
let intervals = [];

async function executeQuery(connection, query, bindParams = {}) {
  try {
    const result = await connection.execute(query, bindParams);
    return result;
  } catch (err) {
    throw err;
  }
}

async function fastQueries(pool, logger, count = 100) {
  logger.info('Starting fast HR queries workload...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Fast employee lookups
      await executeQuery(connection, 'SELECT employee_id, first_name, last_name FROM employees WHERE ROWNUM <= 5');
      
      // Department quick lookup
      await executeQuery(connection, 'SELECT department_id, department_name FROM departments WHERE ROWNUM <= 5');
      
      // Job titles lookup
      await executeQuery(connection, 'SELECT job_id, job_title FROM jobs WHERE ROWNUM <= 5');
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} fast HR queries`);
}

async function slowQueries(pool, logger, count = 10) {
  logger.info('Starting slow HR queries workload...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Complex salary analysis across departments
      await executeQuery(connection, `
        SELECT d.department_name, 
               AVG(e.salary) as avg_salary,
               MAX(e.salary) as max_salary,
               MIN(e.salary) as min_salary,
               COUNT(*) as emp_count,
               l.city, c.country_name
        FROM employees e
        JOIN departments d ON e.department_id = d.department_id
        JOIN locations l ON d.location_id = l.location_id
        JOIN countries c ON l.country_id = c.country_id
        GROUP BY d.department_name, l.city, c.country_name
        ORDER BY avg_salary DESC
      `);
      
      // Employee history analysis
      await executeQuery(connection, `
        SELECT e.first_name, e.last_name, e.hire_date,
               j.job_title, d.department_name,
               COUNT(jh.employee_id) as job_changes
        FROM employees e
        LEFT JOIN jobs j ON e.job_id = j.job_id
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN job_history jh ON e.employee_id = jh.employee_id
        GROUP BY e.first_name, e.last_name, e.hire_date, j.job_title, d.department_name
        ORDER BY job_changes DESC
      `);
    } catch (err) {
      logger.error('Slow HR query error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} slow HR queries`);
}

async function fullTableScans(pool, logger, count = 5) {
  logger.info('Starting full table scan workload...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Full scan on employees with salary analysis
      await executeQuery(connection, `
        SELECT /*+ FULL(employees) */ 
          job_id,
          COUNT(*) as emp_count,
          AVG(salary) as avg_salary,
          SUM(salary) as total_salary
        FROM employees
        WHERE salary > 5000
        GROUP BY job_id
        ORDER BY total_salary DESC
      `);
      
      // Full scan looking for patterns in names
      await executeQuery(connection, `
        SELECT /*+ FULL(employees) */
          first_name, last_name, email, hire_date
        FROM employees
        WHERE UPPER(last_name) LIKE 'M%' OR UPPER(first_name) LIKE 'D%'
      `);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} full table scans`);
}

async function parseIntensiveQueries(pool, logger, count = 50) {
  logger.info('Starting parse-intensive queries workload...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Different queries to force hard parsing - each with unique literals
      await executeQuery(connection, `
        SELECT employee_id, first_name, last_name, salary 
        FROM employees 
        WHERE department_id = ${i % 27 + 10}
      `);
      
      await executeQuery(connection, `
        SELECT * FROM departments WHERE department_name LIKE 'Dept_${i}%'
      `);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} parse-intensive queries`);
}

async function bindVariableQueries(pool, logger, count = 100) {
  logger.info('Starting bind variable queries workload...');
  
  const connection = await pool.getConnection();
  try {
    for (let i = 0; i < count; i++) {
      // Good practice: using bind variables for repeated queries
      await executeQuery(connection, 
        'SELECT employee_id, first_name, last_name, salary FROM employees WHERE employee_id = :empId', 
        { empId: (i % 107) + 100 }  // Cycle through employee IDs
      );
      
      await executeQuery(connection,
        'SELECT department_name FROM departments WHERE department_id = :deptId',
        { deptId: (i % 27) + 10 }  // Cycle through department IDs
      );
    }
  } finally {
    await connection.close();
  }
  
  logger.info(`Completed ${count} bind variable queries`);
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Query workload already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Starting query workload with ${intensity} intensity for ${duration} seconds`);
  
  const intensityConfig = {
    low: { fast: 5000, slow: 30000, fullscan: 60000, parse: 10000, bind: 8000 },
    medium: { fast: 2000, slow: 15000, fullscan: 30000, parse: 5000, bind: 3000 },
    high: { fast: 1000, slow: 10000, fullscan: 20000, parse: 2000, bind: 1500 }
  };
  
  const config = intensityConfig[intensity] || intensityConfig.medium;
  
  // Schedule different query patterns
  intervals.push(setInterval(() => fastQueries(pool, logger, 10).catch(err => logger.error(err)), config.fast));
  intervals.push(setInterval(() => slowQueries(pool, logger, 1).catch(err => logger.error(err)), config.slow));
  intervals.push(setInterval(() => fullTableScans(pool, logger, 1).catch(err => logger.error(err)), config.fullscan));
  intervals.push(setInterval(() => parseIntensiveQueries(pool, logger, 5).catch(err => logger.error(err)), config.parse));
  intervals.push(setInterval(() => bindVariableQueries(pool, logger, 10).catch(err => logger.error(err)), config.bind));
  
  // Stop after duration
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;
  
  logger.info('Stopping query workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  isRunning = false;
  logger.info('Query workload stopped');
}

module.exports = { start, stop };
