/**
 * Blocking Sessions Workload
 * Specifically designed to trigger newrelicoraclereceiver's blocking session and wait event monitoring
 *
 * Key Requirements from receiver flow:
 * - Sessions must be ACTIVE with status='WAITING'
 * - wait_class != 'Idle'
 * - WAIT_TIME_MICRO > 0
 * - BLOCKING_SESSION must be populated
 * - Queries must stay active long enough for receiver to capture (>collection_interval)
 */

let isRunning = false;
let activeConnections = [];
let intervals = [];

/**
 * Creates a chain of blocking sessions: Session A blocks B, B blocks C, etc.
 * This triggers FINAL_BLOCKING_SESSION tracking in the receiver
 */
async function createBlockingChain(pool, logger, chainLength = 3, holdDurationSec = 30) {
  logger.info(`Creating blocking chain of ${chainLength} sessions for ${holdDurationSec}s...`);

  const connections = [];
  const empIdStart = 100;

  try {
    // Session 1: Lock first employee (becomes final blocker)
    const conn1 = await pool.getConnection();
    connections.push(conn1);

    await conn1.execute(
      `SELECT * FROM employees WHERE employee_id = :empId FOR UPDATE`,
      { empId: empIdStart }
    );
    logger.info(`[BLOCKER] Session 1: Locked employee ${empIdStart} (FINAL_BLOCKING_SESSION)`);

    // Wait a moment before starting waiters
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Sessions 2-N: Each tries to lock what previous session locked
    for (let i = 1; i < chainLength; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);

      // Execute in background (will wait for lock)
      conn.execute(
        `SELECT * FROM employees WHERE employee_id = :empId FOR UPDATE`,
        { empId: empIdStart }
      ).catch(err => {
        logger.debug(`Session ${i + 1} lock wait (expected):`, err.message);
      });

      logger.info(`[WAITING] Session ${i + 1}: Waiting for lock on employee ${empIdStart}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Hold locks for collection_interval duration to ensure receiver captures them
    logger.info(`Holding blocking chain for ${holdDurationSec}s to allow monitoring capture...`);
    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    // Release all locks
    for (let i = 0; i < connections.length; i++) {
      try {
        await connections[i].rollback();
        await connections[i].close();
        logger.debug(`Released session ${i + 1}`);
      } catch (err) {
        logger.error(`Error releasing session ${i + 1}:`, err.message);
      }
    }
  }

  logger.info('Blocking chain released');
}

/**
 * Creates row-level contention with multiple sessions waiting on same rows
 * Triggers wait event: 'enq: TX - row lock contention'
 */
async function createRowLockContention(pool, logger, waiters = 5, holdDurationSec = 25) {
  logger.info(`Creating row lock contention with ${waiters} waiting sessions for ${holdDurationSec}s...`);

  const lockingConn = await pool.getConnection();
  const waitingConns = [];

  try {
    // Locking session: Update high-salary employees (holds row locks)
    await lockingConn.execute(`
      UPDATE employees
      SET salary = salary + 1
      WHERE salary > 15000
    `);
    logger.info('[BLOCKER] Locked high-salary employees with UPDATE');

    // Wait a bit to ensure lock is established
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Waiting sessions: Try to update same rows (will wait)
    for (let i = 0; i < waiters; i++) {
      const conn = await pool.getConnection();
      waitingConns.push(conn);

      // Execute UPDATE in background (will block)
      conn.execute(`
        UPDATE employees
        SET commission_pct = commission_pct + 0.01
        WHERE salary > 15000
      `).catch(err => {
        logger.debug(`Waiter ${i + 1} blocked (expected):`, err.message);
      });

      logger.info(`[WAITING] Session ${i + 1}: Waiting for row locks (enq: TX - row lock contention)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Hold locks long enough for receiver to capture wait events
    logger.info(`Holding row locks for ${holdDurationSec}s...`);
    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await lockingConn.rollback();
      await lockingConn.close();

      for (const conn of waitingConns) {
        try {
          await conn.rollback();
          await conn.close();
        } catch (err) {
          // May already be closed
        }
      }
    } catch (err) {
      logger.error('Error cleaning up row lock contention:', err.message);
    }
  }

  logger.info('Row lock contention released');
}

/**
 * Creates long-running queries with different wait events
 * Ensures queries stay ACTIVE long enough for monitoring
 */
async function createSlowActiveQueries(pool, logger, holdDurationSec = 20) {
  logger.info(`Creating slow active queries for ${holdDurationSec}s...`);

  const connections = [];

  try {
    // Query 1: Cartesian join causing CPU/buffer busy waits
    const conn1 = await pool.getConnection();
    connections.push(conn1);

    conn1.execute(`
      SELECT /*+ NO_INDEX(e1) NO_INDEX(e2) */
        e1.employee_id, e2.employee_id,
        e1.first_name || ' works with ' || e2.first_name as relationship,
        DBMS_RANDOM.VALUE * 1000 as random_score
      FROM employees e1, employees e2
      WHERE e1.employee_id != e2.employee_id
        AND e1.department_id IS NOT NULL
        AND e2.department_id IS NOT NULL
      ORDER BY random_score DESC
    `).catch(err => logger.debug('Cartesian query completed:', err.message));

    logger.info('[ACTIVE] Started cartesian join query (expect CPU/buffer waits)');

    // Query 2: Full table scan with sorting (temp I/O waits)
    const conn2 = await pool.getConnection();
    connections.push(conn2);

    conn2.execute(`
      SELECT /*+ FULL(e) FULL(d) FULL(l) FULL(c) */
        e.*, d.*, l.*, c.*,
        ROW_NUMBER() OVER (ORDER BY e.salary DESC, e.hire_date) as salary_rank,
        DENSE_RANK() OVER (PARTITION BY d.department_id ORDER BY e.salary DESC) as dept_rank
      FROM employees e
      CROSS JOIN departments d
      CROSS JOIN locations l
      CROSS JOIN countries c
      ORDER BY salary_rank, dept_rank
    `).catch(err => logger.debug('Full scan query completed:', err.message));

    logger.info('[ACTIVE] Started full table scan with sorting (expect direct path read/write temp)');

    // Query 3: Complex aggregation (latch waits, buffer busy waits)
    const conn3 = await pool.getConnection();
    connections.push(conn3);

    conn3.execute(`
      SELECT
        d.department_name,
        COUNT(DISTINCT e.employee_id) as emp_count,
        AVG(e.salary) as avg_salary,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY e.salary) as median_salary,
        STDDEV(e.salary) as salary_stddev,
        COUNT(DISTINCT jh.job_id) as job_changes,
        SUM(CASE WHEN e.commission_pct IS NOT NULL THEN 1 ELSE 0 END) as commission_eligible
      FROM departments d
      LEFT JOIN employees e ON d.department_id = e.department_id
      LEFT JOIN job_history jh ON e.employee_id = jh.employee_id
      GROUP BY ROLLUP(d.department_name)
      HAVING AVG(e.salary) > (SELECT AVG(salary) FROM employees WHERE salary IS NOT NULL) * 0.5
      ORDER BY avg_salary DESC
    `).catch(err => logger.debug('Aggregation query completed:', err.message));

    logger.info('[ACTIVE] Started complex aggregation (expect latch/buffer waits)');

    // Hold queries active
    logger.info(`Holding active queries for ${holdDurationSec}s...`);
    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    for (const conn of connections) {
      try {
        // Cancel any ongoing queries
        await conn.close();
      } catch (err) {
        logger.error('Error closing active query connection:', err.message);
      }
    }
  }

  logger.info('Active queries completed');
}

/**
 * Creates index contention waits
 * Triggers: 'enq: TX - index contention'
 */
async function createIndexContention(pool, logger, holdDurationSec = 20) {
  logger.info(`Creating index contention for ${holdDurationSec}s...`);

  const connections = [];

  try {
    // Multiple sessions inserting into same table (index contention on PK/unique indexes)
    for (let i = 0; i < 5; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);

      // Insert in a loop to create sustained index activity
      conn.execute(`
        BEGIN
          FOR i IN 1..1000 LOOP
            INSERT INTO job_history (employee_id, start_date, end_date, job_id, department_id)
            VALUES (
              100 + MOD(i, 107),
              SYSDATE - (365 * 5) + i,
              SYSDATE - (365 * 4) + i,
              'IT_PROG',
              60
            );
            COMMIT;
          END LOOP;
        END;
      `).catch(err => logger.debug(`Index contention session ${i + 1}:`, err.message));

      logger.info(`[ACTIVE] Session ${i + 1}: Creating index contention`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    for (const conn of connections) {
      try {
        await conn.rollback();
        await conn.close();
      } catch (err) {
        logger.error('Error releasing index contention connection:', err.message);
      }
    }
  }

  logger.info('Index contention released');
}

/**
 * Creates application-level contention with realistic business logic
 */
async function createApplicationContention(pool, logger, holdDurationSec = 30) {
  logger.info(`Creating application-level contention for ${holdDurationSec}s...`);

  const connections = [];

  try {
    // Scenario: Multiple users trying to process salary increases simultaneously
    const conn1 = await pool.getConnection();
    connections.push(conn1);

    await conn1.execute(`
      SELECT * FROM employees
      WHERE department_id = 50
      FOR UPDATE
    `);
    logger.info('[BLOCKER] HR Admin: Locked department 50 for salary review');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Manager trying to update same department
    const conn2 = await pool.getConnection();
    connections.push(conn2);

    conn2.execute(`
      UPDATE employees
      SET salary = salary * 1.05
      WHERE department_id = 50
    `).catch(err => logger.debug('Manager update blocked:', err.message));

    logger.info('[WAITING] Manager: Waiting to give salary raises (blocked by HR Admin)');

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Finance trying to calculate payroll for same department
    const conn3 = await pool.getConnection();
    connections.push(conn3);

    conn3.execute(`
      SELECT SUM(salary) as total_payroll
      FROM employees
      WHERE department_id = 50
      FOR UPDATE
    `).catch(err => logger.debug('Finance query blocked:', err.message));

    logger.info('[WAITING] Finance: Waiting to calculate payroll (blocked by HR Admin)');

    // Hold scenario
    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    for (const conn of connections) {
      try {
        await conn.rollback();
        await conn.close();
      } catch (err) {
        logger.error('Error releasing application contention:', err.message);
      }
    }
  }

  logger.info('Application contention released');
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Blocking sessions workload already running');
    return;
  }

  isRunning = true;
  logger.info(`Starting blocking sessions workload with ${intensity} intensity for ${duration} seconds`);
  logger.info('This workload creates ACTIVE sessions with WAITING status to trigger receiver monitoring');

  const intensityConfig = {
    low: {
      blockingChain: 60000,  // Every 60s
      rowLock: 45000,        // Every 45s
      slowQueries: 50000,    // Every 50s
      indexContention: 70000, // Every 70s
      appContention: 80000   // Every 80s
    },
    medium: {
      blockingChain: 40000,  // Every 40s
      rowLock: 30000,        // Every 30s
      slowQueries: 35000,    // Every 35s
      indexContention: 45000, // Every 45s
      appContention: 50000   // Every 50s
    },
    high: {
      blockingChain: 25000,  // Every 25s
      rowLock: 20000,        // Every 20s
      slowQueries: 22000,    // Every 22s
      indexContention: 30000, // Every 30s
      appContention: 35000   // Every 35s
    }
  };

  const config = intensityConfig[intensity] || intensityConfig.medium;

  // Start periodic workloads
  intervals.push(setInterval(() =>
    createBlockingChain(pool, logger, 3, 25).catch(err => logger.error('Blocking chain error:', err)),
    config.blockingChain
  ));

  intervals.push(setInterval(() =>
    createRowLockContention(pool, logger, 5, 20).catch(err => logger.error('Row lock error:', err)),
    config.rowLock
  ));

  intervals.push(setInterval(() =>
    createSlowActiveQueries(pool, logger, 18).catch(err => logger.error('Slow query error:', err)),
    config.slowQueries
  ));

  intervals.push(setInterval(() =>
    createIndexContention(pool, logger, 15).catch(err => logger.error('Index contention error:', err)),
    config.indexContention
  ));

  intervals.push(setInterval(() =>
    createApplicationContention(pool, logger, 25).catch(err => logger.error('App contention error:', err)),
    config.appContention
  ));

  // Stop after duration
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;

  logger.info('Stopping blocking sessions workload...');

  // Clear all intervals
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];

  // Close any remaining connections
  activeConnections.forEach(conn => {
    try {
      conn.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  });
  activeConnections = [];

  isRunning = false;
  logger.info('Blocking sessions workload stopped');
}

module.exports = { start, stop };
