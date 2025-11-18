// OpenTelemetry APM Instrumentation - MUST be loaded first
require('./tracing');

// ============================================================================
// New Relic APM Agent - COMMENTED OUT (Using OpenTelemetry instead)
// ============================================================================
// let newrelic;
// const hasValidLicenseKey = process.env.NEW_RELIC_LICENSE_KEY && 
//                           process.env.NEW_RELIC_LICENSE_KEY !== 'your_newrelic_license_key_here' &&
//                           process.env.NEW_RELIC_LICENSE_KEY.length > 10;

// if (hasValidLicenseKey) {
//   try {
//     newrelic = require('newrelic');
//     console.log('✅ New Relic APM initialized successfully');
//   } catch (error) {
//     console.warn('⚠️  New Relic APM failed to initialize:', error.message);
//     newrelic = null;
//   }
// } else {
//   console.log('⚠️  New Relic license key not found or invalid - continuing without APM');
//   newrelic = null;
// }

let newrelic = null;

// Create mock newrelic object if not available
if (!newrelic) {
  newrelic = {
    recordCustomEvent: () => {},
    noticeError: () => {},
    addCustomAttribute: () => {},
    recordMetric: () => {},
    startSegment: (name, record, handler) => handler(),
    getTraceMetadata: () => ({ traceId: null, spanId: null })
  };
}

require('dotenv').config();

// Use instrumented OracleDB with OpenTelemetry tracing
const oracledb = require('./oracledb-instrumented');

const winston = require('winston');
const express = require('express');

// Initialize Oracle Thick Mode - MUST be called before any oracledb operations
try {
  oracledb.initOracleClient();
  console.log('✅ Oracle Thick Mode initialized successfully');
} catch (err) {
  console.error('⚠️  Failed to initialize Oracle Thick Mode:', err.message);
  console.log('ℹ️  Continuing in Thin Mode (encryption may not be supported)');
}

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'oracle-test-app.log' })
  ]
});

// Oracle DB Configuration
const dbConfig = {
  user: process.env.ORACLE_USER || 'system',
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/FREEPDB1',
  poolMin: parseInt(process.env.POOL_MIN) || 2,
  poolMax: parseInt(process.env.POOL_MAX) || 10,
  poolIncrement: parseInt(process.env.POOL_INCREMENT) || 1,
  poolTimeout: parseInt(process.env.POOL_TIMEOUT) || 60
};

// Initialize connection pool
let pool;

async function initializePool() {
  try {
    logger.info('Initializing Oracle connection pool...');
    pool = await oracledb.createPool(dbConfig);
    logger.info(`Connection pool created successfully with min: ${dbConfig.poolMin}, max: ${dbConfig.poolMax}`);
    
    // Test connection
    const connection = await pool.getConnection();
    const result = await connection.execute('SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1');
    logger.info(`Connected to Oracle Database: ${result.rows[0][0]}`);
    await connection.close();
    
    return pool;
  } catch (err) {
    logger.error('Error initializing connection pool:', err);
    throw err;
  }
}

async function closePool() {
  try {
    if (pool) {
      await pool.close(10);
      logger.info('Connection pool closed');
    }
  } catch (err) {
    logger.error('Error closing pool:', err);
  }
}

// Express API for triggering tests
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute('SELECT 1 FROM DUAL');
    await connection.close();
    res.json({ status: 'healthy', pool: pool.getStatistics() });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Pool statistics endpoint
app.get('/pool-stats', (req, res) => {
  if (pool) {
    res.json(pool.getStatistics());
  } else {
    res.status(503).json({ error: 'Pool not initialized' });
  }
});

// ============================================================================
// HR Portal Endpoints - Realistic business operations
// ============================================================================

// 1. GET /employees - Salary analysis by job (SELECT with aggregation and hint)
app.get('/employees', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT /*+ FULL(employees) */ 
          job_id,
          COUNT(*) as emp_count,
          AVG(salary) as avg_salary,
          SUM(salary) as total_salary
        FROM employees
        WHERE salary > 5000
        GROUP BY job_id
        ORDER BY total_salary DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, employees: result.rows });
  } catch (err) {
    logger.error('Error fetching employees:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 2. GET /employees/:id - Get single employee details (SELECT with multiple JOINs)
app.get('/employees/:id', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.*, j.job_title, d.department_name, d.location_id,
              m.first_name || ' ' || m.last_name as manager_name
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN employees m ON e.manager_id = m.employee_id
       WHERE e.employee_id = :id`,
      [req.params.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json(result.rows[0]);
    }
  } catch (err) {
    logger.error('Error fetching employee:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 3. POST /employees - Create new employee (INSERT)
app.post('/employees', async (req, res) => {
  let connection;
  try {
    const { first_name, last_name, email, phone_number, hire_date, job_id, salary, department_id, manager_id } = req.body;
    connection = await pool.getConnection();
    
    const result = await connection.execute(
      `INSERT INTO employees 
       (employee_id, first_name, last_name, email, phone_number, hire_date, job_id, salary, department_id, manager_id)
       VALUES (employees_seq.NEXTVAL, :first_name, :last_name, :email, :phone_number, 
               TO_DATE(:hire_date, 'YYYY-MM-DD'), :job_id, :salary, :department_id, :manager_id)
       RETURNING employee_id INTO :id`,
      {
        first_name, last_name, email, phone_number, hire_date, job_id, 
        salary, department_id, manager_id,
        id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      },
      { autoCommit: true }
    );
    
    res.status(201).json({ message: 'Employee created', employee_id: result.outBinds.id[0] });
  } catch (err) {
    logger.error('Error creating employee:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 4. PUT /employees/:id - Update employee (UPDATE)
app.put('/employees/:id', async (req, res) => {
  let connection;
  try {
    const { salary, job_id, department_id, manager_id } = req.body;
    connection = await pool.getConnection();
    
    const result = await connection.execute(
      `UPDATE employees 
       SET salary = :salary, job_id = :job_id, 
           department_id = :department_id, manager_id = :manager_id
       WHERE employee_id = :id`,
      { id: req.params.id, salary, job_id, department_id, manager_id },
      { autoCommit: true }
    );
    
    if (result.rowsAffected === 0) {
      res.status(404).json({ error: 'Employee not found' });
    } else {
      res.json({ message: 'Employee updated', rowsAffected: result.rowsAffected });
    }
  } catch (err) {
    logger.error('Error updating employee:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 5. GET /departments - List all departments (SELECT with aggregation)
app.get('/departments', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT d.department_id, d.department_name, d.manager_id,
              COUNT(e.employee_id) as employee_count,
              AVG(e.salary) as avg_salary
       FROM departments d
       LEFT JOIN employees e ON d.department_id = e.department_id
       GROUP BY d.department_id, d.department_name, d.manager_id
       ORDER BY d.department_id`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, departments: result.rows });
  } catch (err) {
    logger.error('Error fetching departments:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 6. GET /departments/:id/employees - Get employees by department (SELECT with filter)
app.get('/departments/:id/employees', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name, e.email, 
              e.salary, j.job_title
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       WHERE e.department_id = :dept_id
       ORDER BY e.salary DESC`,
      [req.params.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ department_id: req.params.id, count: result.rows.length, employees: result.rows });
  } catch (err) {
    logger.error('Error fetching department employees:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 7. GET /jobs - List all jobs (Simple SELECT)
app.get('/jobs', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT job_id, job_title, min_salary, max_salary 
       FROM jobs 
       ORDER BY job_title`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, jobs: result.rows });
  } catch (err) {
    logger.error('Error fetching jobs:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 8. GET /employees/:id/history - Get employee job history (SELECT with date filtering)
app.get('/employees/:id/history', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT jh.start_date, jh.end_date, j.job_title, d.department_name
       FROM job_history jh
       LEFT JOIN jobs j ON jh.job_id = j.job_id
       LEFT JOIN departments d ON jh.department_id = d.department_id
       WHERE jh.employee_id = :emp_id
       ORDER BY jh.start_date DESC`,
      [req.params.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ employee_id: req.params.id, history: result.rows });
  } catch (err) {
    logger.error('Error fetching job history:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 9. POST /employees/:id/promote - Promote employee (UPDATE + INSERT transaction)
app.post('/employees/:id/promote', async (req, res) => {
  let connection;
  try {
    const { new_job_id, new_salary, new_department_id } = req.body;
    connection = await pool.getConnection();
    
    // Start transaction
    // 1. Get current job details
    const current = await connection.execute(
      `SELECT job_id, salary, department_id, hire_date 
       FROM employees 
       WHERE employee_id = :id`,
      [req.params.id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    
    if (current.rows.length === 0) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    
    // 2. Insert into job_history
    await connection.execute(
      `INSERT INTO job_history (employee_id, start_date, end_date, job_id, department_id)
       VALUES (:emp_id, :start_date, SYSDATE, :job_id, :dept_id)`,
      {
        emp_id: req.params.id,
        start_date: current.rows[0].HIRE_DATE,
        job_id: current.rows[0].JOB_ID,
        dept_id: current.rows[0].DEPARTMENT_ID
      }
    );
    
    // 3. Update employee with new job
    await connection.execute(
      `UPDATE employees 
       SET job_id = :new_job_id, salary = :new_salary, 
           department_id = :new_dept_id
       WHERE employee_id = :emp_id`,
      {
        emp_id: req.params.id,
        new_job_id,
        new_salary,
        new_dept_id: new_department_id
      }
    );
    
    await connection.commit();
    res.json({ message: 'Employee promoted successfully' });
  } catch (err) {
    if (connection) await connection.rollback();
    logger.error('Error promoting employee:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// 10. GET /reports/salary-by-department - Analytics query (Complex SELECT with aggregation)
app.get('/reports/salary-by-department', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT d.department_name,
              COUNT(e.employee_id) as employee_count,
              MIN(e.salary) as min_salary,
              MAX(e.salary) as max_salary,
              AVG(e.salary) as avg_salary,
              SUM(e.salary) as total_salary
       FROM departments d
       LEFT JOIN employees e ON d.department_id = e.department_id
       GROUP BY d.department_name
       HAVING COUNT(e.employee_id) > 0
       ORDER BY total_salary DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ report: result.rows });
  } catch (err) {
    logger.error('Error generating salary report:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// // Start workload endpoint (kept for backward compatibility)
// app.post('/workload/start', async (req, res) => {
//   const { type, duration, intensity } = req.body;
  
//   try {
//     const workloadModule = require(`./workloads/${type}-workload`);
//     workloadModule.start(pool, logger, duration, intensity);
//     res.json({ message: `${type} workload started`, duration, intensity });
//   } catch (err) {
//     res.status(400).json({ error: err.message });
//   }
// });

// // Stop all workloads
// app.post('/workload/stop', (req, res) => {
//   // Implementation for stopping workloads
//   res.json({ message: 'All workloads stopped' });
// });

// Main function
async function main() {
  try {
    // Initialize connection pool
    await initializePool();
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`Oracle HR Portal API listening on port ${PORT}`);
      logger.info('');
      logger.info('📋 Available Endpoints:');
      logger.info('');
      logger.info('🏥 System:');
      logger.info('  GET  /health - Health check');
      logger.info('  GET  /pool-stats - Connection pool statistics');
      logger.info('');
      logger.info('👥 Employees:');
      logger.info('  GET  /employees - List all employees (SELECT with JOIN)');
      logger.info('  GET  /employees/:id - Get employee details (SELECT with multiple JOINs)');
      logger.info('  POST /employees - Create new employee (INSERT)');
      logger.info('  PUT  /employees/:id - Update employee (UPDATE)');
      logger.info('  GET  /employees/:id/history - Get job history (SELECT with date filter)');
      logger.info('  POST /employees/:id/promote - Promote employee (Transaction: UPDATE + INSERT)');
      logger.info('');
      logger.info('🏢 Departments:');
      logger.info('  GET  /departments - List departments with stats (SELECT with aggregation)');
      logger.info('  GET  /departments/:id/employees - Get department employees (SELECT with filter)');
      logger.info('');
      logger.info('💼 Jobs:');
      logger.info('  GET  /jobs - List all jobs (Simple SELECT)');
      logger.info('');
      logger.info('📊 Reports:');
      logger.info('  GET  /reports/salary-by-department - Salary analytics (Complex aggregation)');
      logger.info('');
      // logger.info('🔄 Workloads (Legacy):');
      // logger.info('  POST /workload/start - Start a workload');
      // logger.info('  POST /workload/stop - Stop all workloads');
      logger.info('');
    });
    
    // Load and run test scenarios if AUTO_RUN is enabled
    if (process.env.AUTO_RUN === 'true') {
      logger.info('AUTO_RUN enabled, starting test scenarios...');
      const testRunner = require('./test-all-features');
      setTimeout(() => testRunner.runAllTests(pool, logger), 5000);
    }
    
  } catch (err) {
    logger.error('Failed to start application:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  await closePool();
  process.exit(0);
});

// Start the application
if (require.main === module) {
  main();
}

module.exports = { pool, logger };
