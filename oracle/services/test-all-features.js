/**
 * Test All Features
 * Orchestrates all workloads to test New Relic Oracle DB receiver features
 */

const queryWorkload = require('./workloads/query-workload');
const transactionWorkload = require('./workloads/transaction-workload');
const connectionWorkload = require('./workloads/connection-workload');
const lockWorkload = require('./workloads/lock-workload'); // Re-enabled with fixes
const blockingSessionsWorkload = require('./workloads/blocking-sessions-workload'); // NEW: For wait events & blocking monitoring
const complexQueryWorkload = require('./workloads/complex-query-workload'); // NEW: Complex multi-join queries for wait events
const planRegressionWorkload = require('./workloads/plan-regression-workload'); // NEW: Query plan regression scenarios
const memoryWorkload = require('./workloads/memory-workload');

async function runAllTests(pool, logger, duration = 600, intensity = 'low') {
  logger.info('========================================');
  logger.info('Starting comprehensive Oracle DB test suite');
  logger.info(`Duration: ${duration} seconds, Intensity: ${intensity} (changed to LOW to prevent pool exhaustion)`);
  logger.info('========================================');
  
  try {
    // Display metrics being tested
    logger.info('\nTesting the following metric categories:');
    logger.info('1. Query Performance Metrics (QPM)');
    logger.info('   - Query execution times');
    logger.info('   - Parse counts (hard/soft)');
    logger.info('   - Full table scans');
    logger.info('   - Bind variable usage');
    logger.info('');
    logger.info('2. Transaction Metrics');
    logger.info('   - Commits and rollbacks');
    logger.info('   - Transaction duration');
    logger.info('   - Active transactions');
    logger.info('');
    logger.info('3. Connection Metrics');
    logger.info('   - Connection pool utilization');
    logger.info('   - Active/idle connections');
    logger.info('   - Connection wait times');
    logger.info('');
    logger.info('4. Lock & Blocking Metrics');
    logger.info('   - Row lock contention');
    logger.info('   - Blocking sessions');
    logger.info('   - Wait events (enq: TX - row lock contention)');
    logger.info('   - Final blocking session tracking');
    logger.info('');
    logger.info('5. Active Query Monitoring');
    logger.info('   - Long-running active queries');
    logger.info('   - Wait events (CPU, buffer busy, latch waits)');
    logger.info('   - SQL child cursor metrics');
    logger.info('   - Execution plan capture');
    logger.info('');
    logger.info('6. Memory Metrics');
    logger.info('   - PGA/SGA usage');
    logger.info('   - Buffer cache hit ratio');
    logger.info('   - Sort/hash area usage');
    logger.info('   - Temporary space');
    logger.info('');
    logger.info('7. Query Plan Regression Scenarios (NEW!)');
    logger.info('   - Statistics going stale → Plan changes');
    logger.info('   - Bind variable peeking issues');
    logger.info('   - Same SQL_ID, different PLAN_HASH_VALUE');
    logger.info('   - Data growth causing performance degradation');
    logger.info('   - Join order regressions');
    logger.info('========================================\n');
    
    // Get initial pool statistics
    const initialStats = pool.getStatistics();
    logger.info('Initial Pool Statistics:', JSON.stringify(initialStats, null, 2));
    
    // Start all workloads
    logger.info('\nStarting all workloads...\n');
    
    queryWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);
    
    transactionWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);
    
    connectionWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);

    // CRITICAL: Complex query workload - Long-running queries with various wait events
    complexQueryWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);

    // CRITICAL: Blocking sessions workload - Creates ACTIVE waiting sessions for receiver monitoring
    blockingSessionsWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);

    lockWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);

    // CRITICAL: Plan regression workload - Tests real-world query performance degradation
    planRegressionWorkload.start(pool, logger, duration, intensity);
    await sleep(2000);

    memoryWorkload.start(pool, logger, duration, intensity);
    
    logger.info('All workloads started successfully');
    logger.info(`Tests will run for ${duration} seconds...`);
    
    // Monitor pool statistics periodically
    const monitorInterval = setInterval(() => {
      const currentStats = pool.getStatistics();
      logger.info('Current Pool Statistics:', JSON.stringify(currentStats, null, 2));
    }, 30000); // Every 30 seconds
    
    // Wait for duration
    await sleep(duration * 1000);
    
    clearInterval(monitorInterval);
    
    // Get final statistics
    const finalStats = pool.getStatistics();
    logger.info('\nFinal Pool Statistics:', JSON.stringify(finalStats, null, 2));
    
    logger.info('\n========================================');
    logger.info('Test suite completed successfully');
    logger.info('========================================');
    
    // Summary
    logger.info('\nTest Summary:');
    logger.info(`- Duration: ${duration} seconds`);
    logger.info(`- Intensity: ${intensity}`);
    logger.info(`- Connections opened: ${finalStats.connectionsOpen}`);
    logger.info(`- Connections in use: ${finalStats.connectionsInUse}`);
    logger.info('\nCheck your New Relic Oracle DB receiver metrics for:');
    logger.info('- Query performance data');
    logger.info('- Transaction statistics');
    logger.info('- Connection pool metrics');
    logger.info('- Memory utilization');
    
  } catch (err) {
    logger.error('Error during test execution:', err);
  }
}

async function runSpecificTest(pool, logger, testType, duration = 300, intensity = 'medium') {
  logger.info(`Running ${testType} test for ${duration} seconds with ${intensity} intensity`);
  
  const workloads = {
    'query': queryWorkload,
    'transaction': transactionWorkload,
    'connection': connectionWorkload,
    // 'lock': lockWorkload, // Disabled - causing issues
    'memory': memoryWorkload
  };
  
  const workload = workloads[testType];
  if (!workload) {
    logger.error(`Unknown test type: ${testType}`);
    logger.info('Available test types: query, transaction, connection, memory');
    return;
  }
  
  workload.start(pool, logger, duration, intensity);
  await sleep(duration * 1000);
  
  logger.info(`${testType} test completed`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runAllTests, runSpecificTest };
