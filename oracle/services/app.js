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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  // Log incoming request immediately with prominent formatting
  const logParts = [`\n${'='.repeat(80)}`, `📨 INCOMING: ${req.method} ${req.path}`];
  
  // Add query params if present
  if (Object.keys(req.query).length > 0) {
    logParts.push(`   Query Params: ${JSON.stringify(req.query)}`);
  }
  
  // Add body for POST/PUT if present
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
    logParts.push(`   Request Body: ${JSON.stringify(req.body)}`);
  }
  
  logger.info(logParts.join('\n'));
  
  // Log response when complete
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusEmoji = res.statusCode < 400 ? '✅' : '❌';
    logger.info(`${statusEmoji} RESPONSE: ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)\n${'='.repeat(80)}`);
  });
  
  next();
});

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

// 1. GET /employees - List all employees (SELECT with JOIN)
app.get('/employees', async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    const result = await connection.execute(
      `SELECT e.employee_id, e.first_name, e.last_name, e.email, e.phone_number,
              e.hire_date, e.salary, j.job_title, d.department_name
       FROM employees e
       LEFT JOIN jobs j ON e.job_id = j.job_id
       LEFT JOIN departments d ON e.department_id = d.department_id
       ORDER BY e.employee_id`,
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

// ============================================================================
// Workload Endpoints - Stimulate Oracle Metrics for newrelicoraclereceiver
// ============================================================================

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

// Wait events workload - stimulates general wait event metrics
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

// DB file sequential read - stimulates index/rowid lookups
app.post('/workload/wait/db-file-seq-read', async (req, res) => {
  const { iterations = 50 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT * FROM employees WHERE employee_id = :id', [100 + i]);
      await connection.execute('SELECT * FROM departments WHERE department_id = :id', [10 + (i % 10)]);
    }
    res.json({ message: 'DB file sequential read workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// DB file scattered read - stimulates full table/index scans
app.post('/workload/wait/db-file-scattered-read', async (req, res) => {
  const { iterations = 20 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT /*+ FULL(e) */ * FROM employees e WHERE salary > :sal', [5000 + (i * 100)]);
      await connection.execute('SELECT /*+ FULL(d) */ * FROM departments d');
    }
    res.json({ message: 'DB file scattered read workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Log file sync - stimulates commit waits
app.post('/workload/wait/log-file-sync', async (req, res) => {
  const { iterations = 30 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      await connection.execute(
        'UPDATE employees SET salary = salary + :inc WHERE employee_id = :id',
        [0.01, 100 + (i % 10)],
        { autoCommit: true }
      );
    }
    res.json({ message: 'Log file sync workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Latch free - stimulates latch contention
app.post('/workload/wait/latch-free', async (req, res) => {
  const { iterations = 100 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    // Rapid SQL parsing causes latch contention
    for (let i = 0; i < iterations; i++) {
      await connection.execute(`SELECT /* Query_${i} */ * FROM employees WHERE employee_id = ${100 + (i % 50)}`);
    }
    res.json({ message: 'Latch free workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Buffer busy waits - stimulates buffer contention
app.post('/workload/wait/buffer-busy', async (req, res) => {
  const { iterations = 40 } = req.body;
  const connections = [];
  try {
    // Multiple sessions hitting same blocks
    for (let i = 0; i < 5; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      
      // All sessions update different rows in same table
      for (let j = 0; j < iterations / 5; j++) {
        await conn.execute(
          'UPDATE employees SET salary = salary + :inc WHERE employee_id = :id',
          [0.01, 100 + (i * 10) + j],
          { autoCommit: true }
        );
      }
    }
    res.json({ message: 'Buffer busy waits workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const conn of connections) {
      await conn.close();
    }
  }
});

// Direct path read/write - stimulates direct I/O operations
app.post('/workload/wait/direct-path', async (req, res) => {
  const { iterations = 10 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      // Large sorts that spill to temp
      await connection.execute(`
        SELECT /*+ FULL(e1) FULL(e2) */ e1.*, e2.*
        FROM employees e1, employees e2
        ORDER BY e1.salary, e2.hire_date, e1.employee_id
      `);
    }
    res.json({ message: 'Direct path read/write workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Library cache lock/pin - stimulates library cache waits
app.post('/workload/wait/library-cache', async (req, res) => {
  const { iterations = 50 } = req.body;
  const connections = [];
  try {
    // Multiple sessions parsing similar queries
    for (let i = 0; i < 3; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      
      for (let j = 0; j < iterations / 3; j++) {
        await conn.execute(`
          SELECT /* LibCache_${i}_${j} */ e.*, d.department_name
          FROM employees e 
          JOIN departments d ON e.department_id = d.department_id
          WHERE e.salary > ${5000 + j * 100}
        `);
      }
    }
    res.json({ message: 'Library cache lock/pin workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    for (const conn of connections) {
      await conn.close();
    }
  }
});

// SQL*Net message waits - stimulates network roundtrips
app.post('/workload/wait/sqlnet-message', async (req, res) => {
  const { iterations = 100 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    // Many small queries = many network roundtrips
    for (let i = 0; i < iterations; i++) {
      await connection.execute('SELECT 1 FROM DUAL');
    }
    res.json({ message: 'SQL*Net message workload completed', iterations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
});

// Row cache lock - stimulates data dictionary cache waits
app.post('/workload/wait/row-cache-lock', async (req, res) => {
  const { iterations = 30 } = req.body;
  let connection;
  try {
    connection = await pool.getConnection();
    for (let i = 0; i < iterations; i++) {
      // Query data dictionary views
      await connection.execute('SELECT COUNT(*) FROM user_tables');
      await connection.execute('SELECT COUNT(*) FROM user_indexes');
      await connection.execute('SELECT COUNT(*) FROM user_constraints');
    }
    res.json({ message: 'Row cache lock workload completed', iterations });
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
