// ============================================================================
// OpenTelemetry APM Instrumentation
// Loaded via: node --require ./instrumentation.js app.js (see package.json)
// This ensures instrumentation happens BEFORE any modules are loaded
// ============================================================================

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

const express = require('express');

// Initialize Oracle Thick Mode - MUST be called before any oracledb operations
try {
  // Explicitly set the library directory path
  const libDir = '/usr/src/app/instantclient_21_13';
  oracledb.initOracleClient({ libDir: libDir });
  console.log('✅ Oracle Thick Mode initialized successfully with libDir:', libDir);
  console.log('Oracle Client Version:', oracledb.oracleClientVersion);
} catch (err) {
  console.error('⚠️  Failed to initialize Oracle Thick Mode:', err.message);
  console.error('Full error:', err);
  console.log('ℹ️  Continuing in Thin Mode (encryption may not be supported)');
}

// Simple console logger
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg, err) => console.error(`[ERROR] ${msg}`, err || ''),
  warn: (msg) => console.warn(`[WARN] ${msg}`)
};

// Oracle DB Configuration
const dbConfig = {
  user: process.env.ORACLE_USER || 'system',
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/FREEPDB1',
  poolMin: parseInt(process.env.POOL_MIN) || 50,  // Start with 50 connections for immediate high load
  poolMax: parseInt(process.env.POOL_MAX) || 200,  // Support up to 200 VUs with connections available
  poolIncrement: parseInt(process.env.POOL_INCREMENT) || 10,  // Scale faster (10 at a time)
  poolTimeout: parseInt(process.env.POOL_TIMEOUT) || 60,  // Release idle connections after 60s
  queueTimeout: parseInt(process.env.QUEUE_TIMEOUT) || 120000,  // 2 minutes max wait for connection
  enableStatistics: true,  // Enable pool statistics for debugging
  queueMax: 500  // Limit queue to prevent memory issues, fail fast if overwhelmed
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

// Add logging middleware to track all requests
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - Request received`);
  next();
});

// ============================================================================
// SIMPLE TEST ENDPOINTS - No Database Required
// ============================================================================

// 1. Simple GET - Pure HTTP, no database
app.get('/test/simple', (req, res) => {
  console.log('✅ GET /test/simple called');
  res.json({ 
    message: 'Simple GET working',
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: '/test/simple'
  });
});

// 2. Simple POST - Pure HTTP, no database
app.post('/test/simple', (req, res) => {
  console.log('✅ POST /test/simple called');
  res.json({ 
    message: 'Simple POST working',
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/test/simple',
    body: req.body
  });
});

// 3. POST with JSON processing
app.post('/test/echo', (req, res) => {
  console.log('✅ POST /test/echo called with body:', req.body);
  res.json({
    message: 'Echo endpoint',
    received: req.body,
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/test/echo'
  });
});

// 4. POST with artificial delay
app.post('/test/slow', async (req, res) => {
  const delay = req.body.delay || 1000;
  console.log(`✅ POST /test/slow called - waiting ${delay}ms`);
  await new Promise(resolve => setTimeout(resolve, delay));
  res.json({
    message: 'Slow endpoint completed',
    delay_ms: delay,
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/test/slow'
  });
});

// 5. POST that returns error
app.post('/test/error', (req, res) => {
  console.log('✅ POST /test/error called - returning error');
  res.status(500).json({
    error: 'Intentional error for testing',
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/test/error'
  });
});

// ============================================================================
// ORIGINAL ENDPOINTS
// ============================================================================

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

// 1. GET /employees - List all employees (SELECT with JOIN) - PAGINATED
app.get('/employees', async (req, res) => {
  let connection;
  try {
    const limit = parseInt(req.query.limit) || 100; // Default 100 rows for performance
    const offset = parseInt(req.query.offset) || 0;
    
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.phone_number,
              e.hire_date, e.salary, j.job_title, d.department_name
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       ORDER BY e.employee_id
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      [offset, limit],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, limit: limit, offset: offset, employees: result.rows });
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
    const limit = parseInt(req.query.limit) || 50; // Default 50 rows for performance
    const offset = parseInt(req.query.offset) || 0;
    
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT d.department_id, d.department_name, d.manager_id,
              COUNT(e.employee_id) as employee_count,
              AVG(e.salary) as avg_salary
       FROM departments d
       LEFT JOIN employees e ON d.department_id = e.department_id
       GROUP BY d.department_id, d.department_name, d.manager_id
       ORDER BY d.department_id
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      [offset, limit],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, limit: limit, offset: offset, departments: result.rows });
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
    const limit = parseInt(req.query.limit) || 100; // Default 100 rows for performance
    const offset = parseInt(req.query.offset) || 0;
    
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name, e.email, 
              e.salary, j.job_title
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       WHERE e.department_id = :dept_id
       ORDER BY e.salary DESC
       OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      [req.params.id, offset, limit],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ department_id: req.params.id, count: result.rows.length, limit: limit, offset: offset, employees: result.rows });
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

// ============================================================================
// Workload Endpoints - Stimulate Oracle Metrics for newrelicoraclereceiver
// ============================================================================

// GET Versions - For K6 Load Testing (will show in New Relic APM)
// ============================================================================

// Complex multi-join query - will show in slow query analysis
app.get('/reports/employee-analysis', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.phone_number,
              e.hire_date, e.salary, j.job_title, d.department_name,
              m.first_name || ' ' || m.last_name as manager_name,
              l.city, l.state_province, c.country_name,
              (SELECT COUNT(*) FROM job_history jh WHERE jh.employee_id = e.employee_id) as job_changes,
              (SELECT MAX(jh2.end_date) FROM job_history jh2 WHERE jh2.employee_id = e.employee_id) as last_job_change
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN employees m ON e.manager_id = m.employee_id
       LEFT JOIN locations l ON d.location_id = l.location_id
       LEFT JOIN countries c ON l.country_id = c.country_id
       WHERE e.salary > 5000
       ORDER BY e.employee_id
       OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, employees: result.rows });
  } catch (err) {
    logger.error('Error in employee analysis:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Department hierarchy with full aggregation - complex GROUP BY
app.get('/reports/department-hierarchy', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT d.department_name,
              l.city, l.state_province, c.country_name, r.region_name,
              COUNT(DISTINCT e.employee_id) as total_employees,
              COUNT(DISTINCT j.job_id) as unique_jobs,
              MIN(e.salary) as min_salary,
              MAX(e.salary) as max_salary,
              AVG(e.salary) as avg_salary,
              SUM(e.salary) as total_payroll,
              MIN(e.hire_date) as oldest_hire,
              MAX(e.hire_date) as newest_hire
       FROM departments d
       LEFT JOIN employees e ON d.department_id = e.department_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN locations l ON d.location_id = l.location_id
       LEFT JOIN countries c ON l.country_id = c.country_id
       LEFT JOIN regions r ON c.region_id = r.region_id
       GROUP BY d.department_name, l.city, l.state_province, c.country_name, r.region_name
       HAVING COUNT(e.employee_id) > 0
       ORDER BY total_payroll DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, departments: result.rows });
  } catch (err) {
    logger.error('Error in department hierarchy:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Job statistics across regions - multiple aggregations
app.get('/reports/job-statistics', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT j.job_title,
              r.region_name,
              COUNT(e.employee_id) as employee_count,
              AVG(e.salary) as avg_salary,
              STDDEV(e.salary) as salary_stddev,
              MIN(e.salary) as min_salary,
              MAX(e.salary) as max_salary,
              j.min_salary as job_min_salary,
              j.max_salary as job_max_salary
       FROM jobs j
       LEFT JOIN employees e ON j.job_id = e.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN locations l ON d.location_id = l.location_id
       LEFT JOIN countries c ON l.country_id = c.country_id
       LEFT JOIN regions r ON c.region_id = r.region_id
       GROUP BY j.job_title, r.region_name, j.min_salary, j.max_salary
       HAVING COUNT(e.employee_id) > 0
       ORDER BY employee_count DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, jobs: result.rows });
  } catch (err) {
    logger.error('Error in job statistics:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Employee tenure analysis - date calculations
app.get('/reports/tenure-analysis', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name,
              e.hire_date,
              ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date)/12, 1) as years_of_service,
              d.department_name,
              j.job_title,
              e.salary,
              CASE 
                WHEN MONTHS_BETWEEN(SYSDATE, e.hire_date)/12 < 2 THEN 'New'
                WHEN MONTHS_BETWEEN(SYSDATE, e.hire_date)/12 < 5 THEN 'Mid-Level'
                WHEN MONTHS_BETWEEN(SYSDATE, e.hire_date)/12 < 10 THEN 'Senior'
                ELSE 'Veteran'
              END as tenure_category
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       ORDER BY years_of_service DESC
       OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, employees: result.rows });
  } catch (err) {
    logger.error('Error in tenure analysis:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Salary range analysis by job and location - nested aggregations
app.get('/reports/salary-ranges', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT j.job_title,
              l.city,
              c.country_name,
              COUNT(e.employee_id) as emp_count,
              MIN(e.salary) as current_min,
              MAX(e.salary) as current_max,
              AVG(e.salary) as current_avg,
              j.min_salary as job_min,
              j.max_salary as job_max,
              ROUND((AVG(e.salary) - j.min_salary) / (j.max_salary - j.min_salary) * 100, 2) as salary_range_pct
       FROM jobs j
       LEFT JOIN employees e ON j.job_id = e.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN locations l ON d.location_id = l.location_id
       LEFT JOIN countries c ON l.country_id = c.country_id
       WHERE e.employee_id IS NOT NULL
       GROUP BY j.job_title, l.city, c.country_name, j.min_salary, j.max_salary
       HAVING COUNT(e.employee_id) >= 2
       ORDER BY emp_count DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, ranges: result.rows });
  } catch (err) {
    logger.error('Error in salary ranges:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// NEW COMPLEX QUERIES BELOW:

// Manager-employee relationship analysis with aggregations
app.get('/reports/org-hierarchy', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT 
         e.employee_id,
         e.first_name || ' ' || e.last_name as employee_name,
         e.salary,
         e.hire_date,
         m.employee_id as manager_id,
         m.first_name || ' ' || m.last_name as manager_name,
         m.salary as manager_salary,
         d.department_name,
         j.job_title,
         (SELECT COUNT(*) FROM employees e2 WHERE e2.manager_id = e.employee_id) as direct_reports,
         (SELECT AVG(salary) FROM employees e3 WHERE e3.manager_id = e.employee_id) as avg_direct_report_salary,
         (SELECT MAX(salary) FROM employees e4 WHERE e4.manager_id = e.employee_id) as max_direct_report_salary,
         (SELECT MIN(salary) FROM employees e5 WHERE e5.manager_id = e.employee_id) as min_direct_report_salary,
         e.salary - m.salary as salary_diff_from_manager,
         ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date)/12, 1) as years_employed,
         CASE 
           WHEN (SELECT COUNT(*) FROM employees e6 WHERE e6.manager_id = e.employee_id) = 0 THEN 'Individual Contributor'
           WHEN (SELECT COUNT(*) FROM employees e7 WHERE e7.manager_id = e.employee_id) < 3 THEN 'Team Lead'
           WHEN (SELECT COUNT(*) FROM employees e8 WHERE e8.manager_id = e.employee_id) < 10 THEN 'Manager'
           ELSE 'Senior Manager'
         END as management_level
       FROM employees e
       LEFT JOIN employees m ON e.manager_id = m.employee_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       LEFT JOIN jobs j ON e.job_id = j.job_id
       WHERE e.salary > 3000
       ORDER BY (SELECT COUNT(*) FROM employees e9 WHERE e9.manager_id = e.employee_id) DESC, e.salary DESC
       FETCH FIRST 100 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, hierarchy: result.rows });
  } catch (err) {
    logger.error('Error in org hierarchy:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Window functions with ranking and percentiles
app.get('/reports/salary-rankings', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT 
         e.employee_id,
         e.first_name || ' ' || e.last_name as name,
         e.salary,
         d.department_name,
         j.job_title,
         RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) as dept_rank,
         DENSE_RANK() OVER (ORDER BY e.salary DESC) as company_rank,
         ROW_NUMBER() OVER (PARTITION BY e.job_id ORDER BY e.salary DESC) as job_rank,
         PERCENT_RANK() OVER (PARTITION BY e.department_id ORDER BY e.salary) as dept_percentile,
         NTILE(4) OVER (ORDER BY e.salary) as salary_quartile,
         AVG(e.salary) OVER (PARTITION BY e.department_id) as dept_avg,
         MAX(e.salary) OVER (PARTITION BY e.department_id) as dept_max,
         e.salary - AVG(e.salary) OVER (PARTITION BY e.department_id) as diff_from_dept_avg,
         FIRST_VALUE(e.salary) OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) as top_dept_salary,
         LAG(e.salary, 1) OVER (PARTITION BY e.department_id ORDER BY e.salary DESC) as next_higher_salary
       FROM employees e
       JOIN departments d ON e.department_id = d.department_id
       JOIN jobs j ON e.job_id = j.job_id
       WHERE e.salary > 3000
       ORDER BY e.salary DESC
       OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, rankings: result.rows });
  } catch (err) {
    logger.error('Error in salary rankings:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Self-join analysis - employee comparisons
app.get('/reports/employee-comparisons', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT 
         e1.employee_id as emp1_id,
         e1.first_name || ' ' || e1.last_name as emp1_name,
         e1.salary as emp1_salary,
         e1.hire_date as emp1_hire_date,
         e2.employee_id as emp2_id,
         e2.first_name || ' ' || e2.last_name as emp2_name,
         e2.salary as emp2_salary,
         e2.hire_date as emp2_hire_date,
         d.department_name,
         ABS(e1.salary - e2.salary) as salary_difference,
         ABS(MONTHS_BETWEEN(e1.hire_date, e2.hire_date)) as tenure_diff_months,
         CASE 
           WHEN e1.salary > e2.salary THEN e1.first_name || ' earns more'
           WHEN e1.salary < e2.salary THEN e2.first_name || ' earns more'
           ELSE 'Equal salary'
         END as salary_comparison
       FROM employees e1
       JOIN employees e2 ON e1.department_id = e2.department_id 
                        AND e1.employee_id < e2.employee_id
                        AND e1.job_id = e2.job_id
       JOIN departments d ON e1.department_id = d.department_id
       WHERE ABS(e1.salary - e2.salary) > 1000
       ORDER BY salary_difference DESC
       OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, comparisons: result.rows });
  } catch (err) {
    logger.error('Error in employee comparisons:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Complex job history analysis with multiple aggregations
app.get('/reports/career-progression', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT 
         e.employee_id,
         e.first_name || ' ' || e.last_name as employee_name,
         e.hire_date,
         ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date)/12, 1) as years_employed,
         COUNT(jh.job_id) as total_job_changes,
         COUNT(DISTINCT jh.job_id) as unique_jobs_held,
         COUNT(DISTINCT jh.department_id) as departments_worked,
         MIN(jh.start_date) as first_job_start,
         MAX(jh.end_date) as last_job_end,
         e.salary as current_salary,
         (SELECT j.job_title FROM jobs j WHERE j.job_id = e.job_id) as current_job,
         (SELECT d.department_name FROM departments d WHERE d.department_id = e.department_id) as current_dept,
         ROUND(e.salary / NULLIF(COUNT(jh.job_id), 0), 2) as salary_per_job_change,
         CASE 
           WHEN COUNT(jh.job_id) = 0 THEN 'Never changed jobs'
           WHEN COUNT(jh.job_id) < 2 THEN 'Limited mobility'
           WHEN COUNT(jh.job_id) < 4 THEN 'Moderate mobility'
           ELSE 'High mobility'
         END as mobility_category
       FROM employees e
       LEFT JOIN job_history jh ON e.employee_id = jh.employee_id
       WHERE e.hire_date < ADD_MONTHS(SYSDATE, -24)
       GROUP BY e.employee_id, e.first_name, e.last_name, e.hire_date, e.salary, e.job_id, e.department_id
       HAVING COUNT(jh.job_id) > 0
       ORDER BY total_job_changes DESC, years_employed DESC
       OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, progressions: result.rows });
  } catch (err) {
    logger.error('Error in career progression:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Cross-department salary analysis with complex conditions
app.get('/reports/cross-department-analysis', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT 
         d.department_name,
         r.region_name,
         COUNT(e.employee_id) as employee_count,
         AVG(e.salary) as avg_salary,
         MEDIAN(e.salary) as median_salary,
         STDDEV(e.salary) as salary_stddev,
         MIN(e.salary) as min_salary,
         MAX(e.salary) as max_salary,
         MAX(e.salary) - MIN(e.salary) as salary_spread,
         SUM(CASE WHEN e.salary > 10000 THEN 1 ELSE 0 END) as high_earners,
         SUM(CASE WHEN e.salary < 5000 THEN 1 ELSE 0 END) as low_earners,
         ROUND(AVG(MONTHS_BETWEEN(SYSDATE, e.hire_date)/12), 1) as avg_tenure_years,
         COUNT(DISTINCT e.job_id) as unique_jobs,
         (SELECT COUNT(*) FROM job_history jh JOIN employees e2 ON jh.employee_id = e2.employee_id 
          WHERE e2.department_id = d.department_id) as total_job_changes,
         ROUND(100.0 * COUNT(CASE WHEN e.salary > 
           (SELECT AVG(salary) FROM employees WHERE department_id = e.department_id) 
           THEN 1 END) / NULLIF(COUNT(e.employee_id), 0), 2) as pct_above_dept_avg
       FROM departments d
       LEFT JOIN employees e ON d.department_id = e.department_id
       LEFT JOIN locations l ON d.location_id = l.location_id
       LEFT JOIN countries c ON l.country_id = c.country_id
       LEFT JOIN regions r ON c.region_id = r.region_id
       WHERE e.employee_id IS NOT NULL
       GROUP BY d.department_id, d.department_name, r.region_name
       HAVING COUNT(e.employee_id) >= 3
       ORDER BY avg_salary DESC`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    res.json({ count: result.rows.length, analysis: result.rows });
  } catch (err) {
    logger.error('Error in cross-department analysis:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Parse-intensive workload - stimulates parse metrics
app.post('/workload/parse', async (req, res) => {
  const { iterations = 50, use_binds = false } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      if (use_binds) {
        await connection.execute('SELECT * FROM employees WHERE employee_id = :id', [i % 100 + 100]);
      } else {
        await connection.execute(`SELECT * FROM employees WHERE employee_id = ${i % 100 + 100}`);
      }
    }
    res.json({ message: 'Parse workload completed', iterations, type: use_binds ? 'soft' : 'hard' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Full table scan workload - stimulates disk I/O metrics
app.post('/workload/full-scan', async (req, res) => {
  const { iterations = 5 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT /*+ FULL(e) */ * FROM employees e WHERE salary > 0');
    }
    res.json({ message: 'Full scan workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Sorting workload - stimulates sort metrics
app.post('/workload/sort', async (req, res) => {
  const { size = 'small' } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const limit = size === 'large' ? 10000 : size === 'medium' ? 1000 : 100;
    await connection.execute(`
      SELECT * FROM (
        SELECT e1.*, e2.salary as salary2 
        FROM employees e1, employees e2
        WHERE ROWNUM <= ${limit}
      ) ORDER BY salary, salary2, first_name, last_name
    `);
    res.json({ message: 'Sort workload completed', size });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Redo generation workload - stimulates redo metrics
app.post('/workload/redo', async (req, res) => {
  const { operations = 50 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < operations; i++) {
      await connection.execute(
        'UPDATE employees SET salary = salary + 1 WHERE employee_id = :id',
        [100 + (i % 10)],
        { autoCommit: false }
      );
    }
    await connection.commit();
    res.json({ message: 'Redo workload completed', operations });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Rollback workload - stimulates rollback metrics
app.post('/workload/rollback', async (req, res) => {
  const { operations = 10 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < operations; i++) {
      await connection.execute(
        'UPDATE employees SET salary = salary + 100 WHERE department_id = :dept',
        [10 + (i % 5)],
        { autoCommit: false }
      );
      await connection.rollback();
    }
    res.json({ message: 'Rollback workload completed', operations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Cursor workload - stimulates cursor metrics
app.post('/workload/cursor', async (req, res) => {
  const { count = 20 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < count; i++) {
      await connection.execute('SELECT * FROM employees WHERE department_id = :dept', [10 + (i % 10)]);
    }
    res.json({ message: 'Cursor workload completed', count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Index scan workload - stimulates index scan metrics
app.post('/workload/index-scan', async (req, res) => {
  const { iterations = 30 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT * FROM employees WHERE employee_id = :id', [100 + i]);
    }
    res.json({ message: 'Index scan workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Physical I/O workload - stimulates physical read/write metrics
app.post('/workload/physical-io', async (req, res) => {
  const { iterations = 10 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT /*+ FULL(e) NO_CACHE */ COUNT(*) FROM employees e');
    }
    res.json({ message: 'Physical I/O workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Recursive calls workload - stimulates recursive call metrics
app.post('/workload/recursive', async (req, res) => {
  const { depth = 3 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute(`
      SELECT LEVEL, employee_id, manager_id 
      FROM employees 
      START WITH manager_id IS NULL 
      CONNECT BY PRIOR employee_id = manager_id AND LEVEL <= ${depth}
    `);
    res.json({ message: 'Recursive workload completed', depth });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Session workload - stimulates session metrics
app.post('/workload/session', async (req, res) => {
  const { count = 5, duration = 2 } = req.body;
  const connections = [];
  try {
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      await conn.execute('SELECT * FROM employees WHERE ROWNUM <= 10');
    }
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    res.json({ message: 'Session workload completed', count, duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const conn of connections) {
      await conn.close();
    }
  }
});

// Wait events workload - stimulates wait event metrics
app.post('/workload/wait', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.execute('SELECT /*+ FULL(e1) FULL(e2) */ e1.*, e2.* FROM employees e1, employees e2 WHERE e1.salary = e2.salary');
    res.json({ message: 'Wait events workload completed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Comprehensive workload - runs multiple workload types
app.post('/workload/comprehensive', async (req, res) => {
  const { intensity = 'medium' } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    const iterations = intensity === 'high' ? 50 : intensity === 'low' ? 10 : 25;
    
    // Parse activity
    for (let i = 0; i < iterations; i++) {
      await connection.execute(`SELECT * FROM employees WHERE employee_id = ${100 + i}`);
    }
    
    // Full scans
    await connection.execute('SELECT /*+ FULL(e) */ COUNT(*) FROM employees e');
    
    // Sorts
    await connection.execute('SELECT * FROM employees ORDER BY salary, hire_date');
    
    // Redo generation
    await connection.execute('UPDATE employees SET salary = salary + 0.01 WHERE employee_id = 100', [], { autoCommit: true });
    
    res.json({ message: 'Comprehensive workload completed', intensity });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Lock contention workload - stimulates lock and blocking metrics
app.post('/workload/lock', async (req, res) => {
  const { duration = 3 } = req.body;
  const connections = [];
  try {
    // Session 1: Lock a row
    const conn1 = await pool.getConnection();
    connections.push(conn1);
    await conn1.execute('UPDATE employees SET salary = salary + 1 WHERE employee_id = 100', [], { autoCommit: false });
    
    // Session 2: Try to update same row (will wait)
    const conn2 = await pool.getConnection();
    connections.push(conn2);
    
    const lockPromise = conn2.execute('UPDATE employees SET salary = salary + 1 WHERE employee_id = 100', [], { autoCommit: false });
    
    // Hold lock for specified duration
    await new Promise(resolve => setTimeout(resolve, duration * 1000));
    
    // Release lock
    await conn1.rollback();
    
    // Let second session complete
    await lockPromise;
    await conn2.rollback();
    
    res.json({ message: 'Lock contention workload completed', duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const conn of connections) {
      try { await conn.rollback(); } catch (e) {}
      await conn.close();
    }
  }
});

// PDB metrics workload - stimulates PDB-specific metrics
app.post('/workload/pdb', async (req, res) => {
  const { operations = 30 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Mix of operations to stimulate PDB metrics
    for (let i = 0; i < operations; i++) {
      // Logical reads
      await connection.execute('SELECT * FROM employees WHERE employee_id = :id', [100 + (i % 50)]);
      
      // Physical I/O
      if (i % 5 === 0) {
        await connection.execute('SELECT /*+ FULL(e) NO_CACHE */ COUNT(*) FROM employees e');
      }
      
      // Transactions
      if (i % 3 === 0) {
        await connection.execute('UPDATE employees SET salary = salary + 0.01 WHERE employee_id = :id', [100 + i], { autoCommit: true });
      }
    }
    
    res.json({ message: 'PDB workload completed', operations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Parallel execution workload - stimulates parallel session metrics
app.post('/workload/parallel', async (req, res) => {
  const { degree = 4 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Enable parallel execution
    await connection.execute(`ALTER SESSION SET PARALLEL_DEGREE_POLICY = MANUAL`);
    await connection.execute(`ALTER SESSION FORCE PARALLEL QUERY PARALLEL ${degree}`);
    
    // Execute parallel query
    await connection.execute(`
      SELECT /*+ PARALLEL(e, ${degree}) */ 
        department_id, COUNT(*), AVG(salary), MAX(salary), MIN(salary)
      FROM employees e
      GROUP BY department_id
    `);
    
    res.json({ message: 'Parallel workload completed', degree });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Network traffic workload - stimulates network metrics
app.post('/workload/network', async (req, res) => {
  const { iterations = 20 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    for (let i = 0; i < iterations; i++) {
      // Fetch large result sets
      const result = await connection.execute(
        'SELECT * FROM employees ORDER BY employee_id',
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
    }
    
    res.json({ message: 'Network workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Consistent read workload - stimulates consistent read metrics
app.post('/workload/consistent-read', async (req, res) => {
  const { iterations = 20 } = req.body;
  const connections = [];
  try {
    // Create long-running query
    const conn1 = await pool.getConnection();
    connections.push(conn1);
    
    // Start transaction to create read consistency point
    await conn1.execute('SELECT * FROM employees', [], { outFormat: oracledb.OUT_FORMAT_OBJECT });
    
    // Another session makes changes
    const conn2 = await pool.getConnection();
    connections.push(conn2);
    
    for (let i = 0; i < iterations; i++) {
      await conn2.execute('UPDATE employees SET salary = salary + 1 WHERE employee_id = :id', [100 + (i % 10)], { autoCommit: true });
    }
    
    // First session reads again - will use undo for consistent read
    await conn1.execute('SELECT COUNT(*), SUM(salary) FROM employees');
    
    res.json({ message: 'Consistent read workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const conn of connections) {
      await conn.close();
    }
  }
});

// Block changes workload - stimulates block change metrics
app.post('/workload/block-change', async (req, res) => {
  const { operations = 50 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    for (let i = 0; i < operations; i++) {
      await connection.execute(
        'UPDATE employees SET salary = salary + :inc WHERE department_id = :dept',
        { inc: i % 100, dept: 10 + (i % 10) },
        { autoCommit: false }
      );
    }
    
    await connection.commit();
    res.json({ message: 'Block change workload completed', operations });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Enqueue workload - stimulates enqueue request/wait metrics
app.post('/workload/enqueue', async (req, res) => {
  const { iterations = 15 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    
    for (let i = 0; i < iterations; i++) {
      // DML that requires various enqueues
      await connection.execute('INSERT INTO job_history (employee_id, start_date, end_date, job_id, department_id) VALUES (:1, SYSDATE, SYSDATE, :2, :3)', 
        [100 + i, 'IT_PROG', 60],
        { autoCommit: false }
      );
      
      await connection.execute('UPDATE departments SET department_name = department_name WHERE department_id = :dept', [10 + (i % 10)], { autoCommit: false });
      
      await connection.rollback();
    }
    
    res.json({ message: 'Enqueue workload completed', iterations });
  } catch (err) {
    if (connection) await connection.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

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
      logger.info('🧪 TEST ENDPOINTS (No Database):');
      logger.info('  GET  /test/simple - Simple GET request');
      logger.info('  POST /test/simple - Simple POST request');
      logger.info('  POST /test/echo - Echo JSON body');
      logger.info('  POST /test/slow - Slow request with delay');
      logger.info('  POST /test/error - Return 500 error');
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
      logger.info('🔄 Workloads (Legacy):');
      logger.info('  POST /workload/start - Start a workload');
      logger.info('  POST /workload/stop - Stop all workloads');
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
