/**
 * Lock Workload
 * Generates various locking scenarios to test lock metrics
 */

let isRunning = false;
let intervals = [];

async function tableLocks(pool, logger, count = 5) {
  logger.info('Starting table lock workload...');
  
  const connection = await pool.getConnection();
  try {
    // Lock HR tables for reporting operations
    await connection.execute('LOCK TABLE EMPLOYEES IN SHARE MODE NOWAIT');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await connection.commit();
  } catch (err) {
    logger.error('Table lock error (expected if permissions are limited):', err.message);
    await connection.rollback();
  } finally {
    await connection.close();
  }
  
  logger.info('Table lock workload completed');
}

async function rowLocks(pool, logger, count = 10) {
  logger.info('Starting row lock workload...');
  
  // Create multiple connections to simulate lock contention
  const connections = [];
  
  try {
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      
      // Each connection tries to lock specific employee records (salary update simulation)
      try {
        const empId = (i % 107) + 100;
        await conn.execute(
          'SELECT employee_id, salary FROM employees WHERE employee_id = :empId FOR UPDATE NOWAIT',
          { empId }
        );
      } catch (err) {
        // Expected to fail sometimes due to locks
        logger.debug('Row lock contention:', err.message);
      }
    }
    
    // Hold locks briefly
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } finally {
    for (const conn of connections) {
      try {
        await conn.rollback();
        await conn.close();
      } catch (err) {
        logger.error('Error releasing row lock:', err.message);
      }
    }
  }
  
  logger.info('Row lock workload completed');
}

async function deadlockScenario(pool, logger) {
  logger.info('Attempting deadlock scenario...');
  
  const conn1 = await pool.getConnection();
  const conn2 = await pool.getConnection();
  
  try {
    // Simulate potential deadlock: Connection 1 locks employees, Connection 2 locks departments
    // Then each tries to lock what the other has
    
    // Connection 1 locks employee record
    await conn1.execute('SELECT * FROM employees WHERE employee_id = 100 FOR UPDATE NOWAIT');
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Connection 2 tries to lock same employee record
    try {
      await conn2.execute('SELECT * FROM employees WHERE employee_id = 100 FOR UPDATE NOWAIT');
    } catch (err) {
      logger.debug('Lock conflict (expected):', err.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (err) {
    logger.error('Deadlock scenario error:', err.message);
  } finally {
    try {
      await conn1.rollback();
      await conn2.rollback();
      await conn1.close();
      await conn2.close();
    } catch (err) {
      logger.error('Error cleaning up deadlock scenario:', err.message);
    }
  }
  
  logger.info('Deadlock scenario completed');
}

async function lockWaits(pool, logger, count = 5) {
  logger.info('Starting lock wait workload...');
  
  const lockingConn = await pool.getConnection();
  const waitingConns = [];
  
  try {
    // First connection acquires lock on high-paid employees (simulating batch salary update)
    await lockingConn.execute('SELECT * FROM employees WHERE salary > 15000 FOR UPDATE NOWAIT');
    
    // Other connections try to acquire same lock and wait
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      waitingConns.push(conn);
      
      // This will wait for lock (or timeout)
      setTimeout(async () => {
        try {
          await conn.execute('SELECT * FROM employees WHERE salary > 15000 FOR UPDATE WAIT 3');
        } catch (err) {
          logger.debug('Lock wait timeout (expected):', err.message);
        }
      }, 100 * i);
    }
    
    // Hold lock for a bit
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } finally {
    try {
      await lockingConn.rollback();
      await lockingConn.close();
      
      for (const conn of waitingConns) {
        try {
          await conn.rollback();
          await conn.close();
        } catch (err) {
          // Connection might already be closed
        }
      }
    } catch (err) {
      logger.error('Error cleaning up lock waits:', err.message);
    }
  }
  
  logger.info('Lock wait workload completed');
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Lock workload already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Starting lock workload with ${intensity} intensity for ${duration} seconds`);
  
  const intensityConfig = {
    low: { table: 60000, row: 30000, deadlock: 45000, wait: 40000 },
    medium: { table: 40000, row: 20000, deadlock: 30000, wait: 25000 },
    high: { table: 25000, row: 15000, deadlock: 20000, wait: 18000 }
  };
  
  const config = intensityConfig[intensity] || intensityConfig.medium;
  
  intervals.push(setInterval(() => tableLocks(pool, logger, 1).catch(err => logger.error(err)), config.table));
  intervals.push(setInterval(() => rowLocks(pool, logger, 5).catch(err => logger.error(err)), config.row));
  intervals.push(setInterval(() => deadlockScenario(pool, logger).catch(err => logger.error(err)), config.deadlock));
  intervals.push(setInterval(() => lockWaits(pool, logger, 3).catch(err => logger.error(err)), config.wait));
  
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;
  
  logger.info('Stopping lock workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  isRunning = false;
  logger.info('Lock workload stopped');
}

module.exports = { start, stop };
