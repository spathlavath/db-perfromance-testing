/**
 * Memory Workload
 * Generates workload to stress memory-related metrics (PGA, SGA, buffer cache)
 */

let isRunning = false;
let intervals = [];

async function largeResultSets(pool, logger, count = 5) {
  logger.info('Fetching large result sets...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Query that returns comprehensive employee data with all relationships
      const result = await connection.execute(
        `SELECT /*+ FULL(e) */
          e.employee_id, e.first_name, e.last_name, e.email, e.phone_number,
          e.hire_date, e.salary, e.commission_pct,
          j.job_title, j.min_salary, j.max_salary,
          d.department_name,
          l.street_address, l.postal_code, l.city, l.state_province,
          c.country_name, r.region_name,
          m.first_name as mgr_first_name, m.last_name as mgr_last_name
        FROM employees e
        LEFT JOIN jobs j ON e.job_id = j.job_id
        LEFT JOIN departments d ON e.department_id = d.department_id
        LEFT JOIN locations l ON d.location_id = l.location_id
        LEFT JOIN countries c ON l.country_id = c.country_id
        LEFT JOIN regions r ON c.region_id = r.region_id
        LEFT JOIN employees m ON e.manager_id = m.employee_id`,
        [],
        { resultSet: false, outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      
      logger.debug(`Fetched ${result.rows.length} rows`);
    } catch (err) {
      logger.error('Large result set error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info('Large result set queries completed');
}

async function sortOperations(pool, logger, count = 3) {
  logger.info('Executing sort operations...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Complex sort on salary and hire date (HR report generation)
      await connection.execute(`
        SELECT 
          e.employee_id, 
          e.first_name || ' ' || e.last_name as full_name,
          e.email, 
          e.hire_date,
          e.salary,
          d.department_name,
          j.job_title
        FROM employees e
        JOIN departments d ON e.department_id = d.department_id
        JOIN jobs j ON e.job_id = j.job_id
        ORDER BY e.salary DESC, e.hire_date ASC, e.last_name, e.first_name
      `);
    } catch (err) {
      logger.error('Sort operation error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info('Sort operations completed');
}

async function hashJoins(pool, logger, count = 3) {
  logger.info('Executing hash join operations...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Complex hash join across all HR tables
      await connection.execute(`
        SELECT /*+ USE_HASH(e d l c r j) */
          e.employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.salary,
          j.job_title,
          d.department_name,
          l.city,
          c.country_name,
          r.region_name
        FROM employees e
        JOIN departments d ON e.department_id = d.department_id
        JOIN locations l ON d.location_id = l.location_id
        JOIN countries c ON l.country_id = c.country_id
        JOIN regions r ON c.region_id = r.region_id
        JOIN jobs j ON e.job_id = j.job_id
      `);
    } catch (err) {
      logger.error('Hash join error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info('Hash join operations completed');
}

async function tempSpaceUsage(pool, logger, count = 2) {
  logger.info('Creating temporary space usage...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Operations that use temp space - DISTINCT and UNION operations
      await connection.execute(`
        SELECT DISTINCT employee_id, first_name, last_name, email, salary
        FROM (
          SELECT e.*, 'current' as status FROM employees e
          UNION ALL
          SELECT e.employee_id, e.first_name, e.last_name, e.email, e.salary, 'history' as status 
          FROM job_history jh
          JOIN employees e ON jh.employee_id = e.employee_id
        )
      `);
    } catch (err) {
      logger.error('Temp space operation error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info('Temp space operations completed');
}

async function plsqlMemory(pool, logger, count = 5) {
  logger.info('Executing PL/SQL memory operations...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // PL/SQL block that processes employee data in memory using collections
      await connection.execute(`
        DECLARE
          TYPE t_emp_salary IS TABLE OF employees.salary%TYPE INDEX BY PLS_INTEGER;
          TYPE t_emp_name IS TABLE OF VARCHAR2(100) INDEX BY PLS_INTEGER;
          l_salaries t_emp_salary;
          l_names t_emp_name;
          l_avg_salary NUMBER;
        BEGIN
          -- Load employee data into collections
          FOR emp IN (SELECT employee_id, first_name || ' ' || last_name as name, salary FROM employees) LOOP
            l_salaries(emp.employee_id) := emp.salary;
            l_names(emp.employee_id) := emp.name;
          END LOOP;
          
          -- Calculate average (simulating in-memory processing)
          SELECT AVG(salary) INTO l_avg_salary FROM employees;
        END;
      `);
    } catch (err) {
      logger.error('PL/SQL memory operation error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info('PL/SQL memory operations completed');
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Memory workload already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Starting memory workload with ${intensity} intensity for ${duration} seconds`);
  
  const intensityConfig = {
    low: { largeResults: 30000, sort: 45000, hash: 50000, temp: 60000, plsql: 25000 },
    medium: { largeResults: 20000, sort: 30000, hash: 35000, temp: 40000, plsql: 18000 },
    high: { largeResults: 10000, sort: 20000, hash: 25000, temp: 30000, plsql: 12000 }
  };
  
  const config = intensityConfig[intensity] || intensityConfig.medium;
  
  intervals.push(setInterval(() => largeResultSets(pool, logger, 2).catch(err => logger.error(err)), config.largeResults));
  intervals.push(setInterval(() => sortOperations(pool, logger, 1).catch(err => logger.error(err)), config.sort));
  intervals.push(setInterval(() => hashJoins(pool, logger, 1).catch(err => logger.error(err)), config.hash));
  intervals.push(setInterval(() => tempSpaceUsage(pool, logger, 1).catch(err => logger.error(err)), config.temp));
  intervals.push(setInterval(() => plsqlMemory(pool, logger, 2).catch(err => logger.error(err)), config.plsql));
  
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;
  
  logger.info('Stopping memory workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  isRunning = false;
  logger.info('Memory workload stopped');
}

// Required for some queries
const oracledb = require('oracledb');

module.exports = { start, stop };
