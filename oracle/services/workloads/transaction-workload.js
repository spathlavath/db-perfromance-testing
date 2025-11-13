/**
 * Transaction Workload
 * Generates various transaction patterns to test transaction metrics
 */

let isRunning = false;
let intervals = [];

async function shortTransactions(pool, logger, count = 10) {
  logger.info('Starting short transactions...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Quick salary lookup - common HR operation
      await connection.execute(
        'SELECT salary, commission_pct FROM employees WHERE employee_id = :empId',
        { empId: (i % 107) + 100 }
      );
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      logger.error('Short transaction error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} short transactions`);
}

async function longTransactions(pool, logger, count = 3) {
  logger.info('Starting long transactions...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Simulate long-running HR report generation
      await connection.execute(`
        SELECT 
          d.department_name,
          COUNT(e.employee_id) as emp_count,
          AVG(e.salary) as avg_salary,
          MAX(e.salary) as max_salary,
          MIN(e.salary) as min_salary
        FROM departments d
        LEFT JOIN employees e ON d.department_id = e.department_id
        LEFT JOIN locations l ON d.location_id = l.location_id
        LEFT JOIN countries c ON l.country_id = c.country_id
        GROUP BY d.department_name
        ORDER BY avg_salary DESC
      `);
      
      // Sleep to simulate processing
      await connection.execute('BEGIN DBMS_LOCK.SLEEP(5); END;');
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      logger.error('Long transaction error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} long transactions`);
}

async function rollbackTransactions(pool, logger, count = 5) {
  logger.info('Starting rollback transactions...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Simulate failed salary update (validation error, then rollback)
      await connection.execute(
        `SELECT employee_id, salary FROM employees WHERE employee_id = :empId`,
        { empId: (i % 107) + 100 }
      );
      // Intentional rollback - simulating business logic validation failure
      await connection.rollback();
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} rollback transactions`);
}

async function multiStatementTransactions(pool, logger, count = 5) {
  logger.info('Starting multi-statement transactions...');
  
  for (let i = 0; i < count; i++) {
    const connection = await pool.getConnection();
    try {
      // Multiple HR operations in single transaction (simulating employee profile view)
      const empId = (i % 107) + 100;
      
      // Get employee details
      await connection.execute(
        'SELECT employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary, manager_id, department_id FROM employees WHERE employee_id = :empId',
        { empId }
      );
      
      // Get job history
      await connection.execute(
        'SELECT start_date, end_date, job_id, department_id FROM job_history WHERE employee_id = :empId ORDER BY start_date DESC',
        { empId }
      );
      
      // Get current department info
      await connection.execute(`
        SELECT d.department_name, l.city, c.country_name
        FROM employees e
        JOIN departments d ON e.department_id = d.department_id
        JOIN locations l ON d.location_id = l.location_id
        JOIN countries c ON l.country_id = c.country_id
        WHERE e.employee_id = :empId
      `, { empId });
      
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      logger.error('Multi-statement transaction error:', err.message);
    } finally {
      await connection.close();
    }
  }
  
  logger.info(`Completed ${count} multi-statement transactions`);
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Transaction workload already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Starting transaction workload with ${intensity} intensity for ${duration} seconds`);
  
  const intensityConfig = {
    low: { short: 10000, long: 60000, rollback: 20000, multi: 15000 },
    medium: { short: 5000, long: 30000, rollback: 10000, multi: 8000 },
    high: { short: 2000, long: 15000, rollback: 5000, multi: 4000 }
  };
  
  const config = intensityConfig[intensity] || intensityConfig.medium;
  
  intervals.push(setInterval(() => shortTransactions(pool, logger, 5).catch(err => logger.error(err)), config.short));
  intervals.push(setInterval(() => longTransactions(pool, logger, 1).catch(err => logger.error(err)), config.long));
  intervals.push(setInterval(() => rollbackTransactions(pool, logger, 2).catch(err => logger.error(err)), config.rollback));
  intervals.push(setInterval(() => multiStatementTransactions(pool, logger, 2).catch(err => logger.error(err)), config.multi));
  
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;
  
  logger.info('Stopping transaction workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  isRunning = false;
  logger.info('Transaction workload stopped');
}

module.exports = { start, stop };
