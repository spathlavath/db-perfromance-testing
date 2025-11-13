/**
 * Connection Workload
 * Generates various connection patterns to test connection pool metrics
 */

let isRunning = false;
let intervals = [];
let activeConnections = [];

async function burstConnections(pool, logger, count = 20) {
  logger.info(`Creating burst of ${count} connections...`);
  
  const connections = [];
  try {
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      await conn.execute('SELECT 1 FROM DUAL');
    }
    
    // Hold connections briefly
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } finally {
    // Release all connections
    for (const conn of connections) {
      try {
        await conn.close();
      } catch (err) {
        logger.error('Error closing connection:', err.message);
      }
    }
  }
  
  logger.info('Burst connections completed');
}

async function sustainedConnections(pool, logger, count = 5, holdTime = 30000) {
  logger.info(`Creating ${count} sustained connections for ${holdTime}ms...`);
  
  const connections = [];
  try {
    for (let i = 0; i < count; i++) {
      const conn = await pool.getConnection();
      connections.push(conn);
      activeConnections.push(conn);
      
      // Periodic activity on connection
      const interval = setInterval(async () => {
        try {
          await conn.execute('SELECT SYSDATE FROM DUAL');
        } catch (err) {
          clearInterval(interval);
        }
      }, 5000);
      
      setTimeout(async () => {
        clearInterval(interval);
        const index = activeConnections.indexOf(conn);
        if (index > -1) activeConnections.splice(index, 1);
        try {
          await conn.close();
        } catch (err) {
          logger.error('Error closing sustained connection:', err.message);
        }
      }, holdTime);
    }
  } catch (err) {
    logger.error('Sustained connections error:', err.message);
  }
}

async function shortLivedConnections(pool, logger, count = 50) {
  logger.info(`Creating ${count} short-lived connections...`);
  
  for (let i = 0; i < count; i++) {
    try {
      const conn = await pool.getConnection();
      await conn.execute('SELECT 1 FROM DUAL');
      await conn.close();
    } catch (err) {
      logger.error('Short-lived connection error:', err.message);
    }
  }
  
  logger.info('Short-lived connections completed');
}

async function idleConnections(pool, logger, count = 3, idleTime = 60000) {
  logger.info(`Creating ${count} idle connections for ${idleTime}ms...`);
  
  for (let i = 0; i < count; i++) {
    try {
      const conn = await pool.getConnection();
      activeConnections.push(conn);
      
      setTimeout(async () => {
        const index = activeConnections.indexOf(conn);
        if (index > -1) activeConnections.splice(index, 1);
        try {
          await conn.close();
        } catch (err) {
          logger.error('Error closing idle connection:', err.message);
        }
      }, idleTime);
    } catch (err) {
      logger.error('Idle connection error:', err.message);
    }
  }
}

function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Connection workload already running');
    return;
  }
  
  isRunning = true;
  logger.info(`Starting connection workload with ${intensity} intensity for ${duration} seconds`);
  
  const intensityConfig = {
    low: { burst: 30000, sustained: 45000, shortLived: 15000, idle: 60000 },
    medium: { burst: 20000, sustained: 30000, shortLived: 10000, idle: 40000 },
    high: { burst: 10000, sustained: 20000, shortLived: 5000, idle: 30000 }
  };
  
  const config = intensityConfig[intensity] || intensityConfig.medium;
  
  intervals.push(setInterval(() => burstConnections(pool, logger, 10).catch(err => logger.error(err)), config.burst));
  intervals.push(setInterval(() => sustainedConnections(pool, logger, 3).catch(err => logger.error(err)), config.sustained));
  intervals.push(setInterval(() => shortLivedConnections(pool, logger, 20).catch(err => logger.error(err)), config.shortLived));
  intervals.push(setInterval(() => idleConnections(pool, logger, 2).catch(err => logger.error(err)), config.idle));
  
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;
  
  logger.info('Stopping connection workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  
  // Close any remaining active connections
  activeConnections.forEach(async (conn) => {
    try {
      await conn.close();
    } catch (err) {
      logger.error('Error closing connection on stop:', err.message);
    }
  });
  activeConnections = [];
  
  isRunning = false;
  logger.info('Connection workload stopped');
}

module.exports = { start, stop };
