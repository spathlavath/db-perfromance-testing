/**
 * Blocking Workload
 * Generates realistic blocking scenarios where SELECT queries are blocked by UPDATE queries
 * Tests query performance degradation due to lock contention
 */

let isRunning = false;
let intervals = [];

/**
 * Basic Blocking Scenario: Slow SELECT blocked by long-running UPDATE
 * 
 * Use Case: HR Department Salary Review Process
 * - An UPDATE query is running to adjust salaries for employees in a department
 * - Meanwhile, a SELECT query tries to generate a report on the same employees
 * - The SELECT gets blocked and waits, simulating real-world blocking issues
 */
async function basicBlockingScenario(pool, logger) {
  logger.info('🔒 Starting: SELECT Query Blocked by UPDATE Query');
  logger.info('Scenario: HR salary adjustment blocking department report generation');
  
  const blockingConn = await pool.getConnection();
  const blockedConn = await pool.getConnection();
  
  try {
    // Step 1: Start a long-running UPDATE (simulating batch salary adjustment)
    logger.info('📝 Step 1: Starting UPDATE query (Salary adjustment for IT Department)...');
    
    // Begin transaction - UPDATE without commit (holds locks)
    await blockingConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.05 
       WHERE department_id = 60`, // IT Department
      [],
      { autoCommit: false } // Don't commit - keep locks
    );
    
    logger.info('✅ UPDATE query started - Holding locks on IT Department employees');
    logger.info('   (Simulating a long-running salary adjustment process)');
    
    // Step 2: Try to run a SELECT query on the same rows (will block)
    logger.info('\n📊 Step 2: Attempting SELECT query (Generate IT Department Report)...');
    logger.info('   This SELECT will be BLOCKED by the UPDATE...');
    
    const startTime = Date.now();
    
    // This query will be blocked because UPDATE has locks on these rows
    const selectPromise = blockedConn.execute(
      `SELECT e.employee_id, 
              e.first_name || ' ' || e.last_name as employee_name,
              e.salary,
              e.hire_date,
              j.job_title,
              d.department_name
       FROM employees e
       JOIN jobs j ON e.job_id = j.job_id
       JOIN departments d ON e.department_id = d.department_id
       WHERE e.department_id = 60  -- Same department as UPDATE
       ORDER BY e.salary DESC`,
      [],
      { autoCommit: false }
    );
    
    // Wait a bit to show the blocking
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Rollback the UPDATE to release locks (no data change)
    logger.info('\n🔓 Step 3: Rolling back UPDATE query to release locks...');
    await blockingConn.rollback();
    logger.info('✅ UPDATE rolled back - Locks released (no data changed)');
    
    // Step 4: Now the SELECT can complete
    logger.info('\n⏳ Step 4: SELECT query can now proceed...');
    const result = await selectPromise;
    
    const endTime = Date.now();
    const waitTime = ((endTime - startTime) / 1000).toFixed(2);
    
    logger.info(`✅ SELECT query completed after ${waitTime} seconds (including wait time)`);
    logger.info(`   Retrieved ${result.rows.length} employee records`);
    
    await blockedConn.commit();
    
    // Summary
    logger.info('\n📋 SUMMARY:');
    logger.info(`   • Blocking Query: UPDATE on IT Department salaries`);
    logger.info(`   • Blocked Query: SELECT generating IT Department report`);
    logger.info(`   • Wait Time: ${waitTime} seconds`);
    logger.info(`   • Employees Affected: ${result.rows.length}`);
    logger.info(`   • Scenario: Batch salary update blocking report generation`);
    
  } catch (err) {
    logger.error('❌ Error in blocking scenario:', err.message);
    await blockingConn.rollback();
    await blockedConn.rollback();
  } finally {
    await blockingConn.close();
    await blockedConn.close();
  }
  
  logger.info('\n✅ Blocking scenario completed\n');
}

/**
 * Multiple Readers Blocked: Multiple SELECTs blocked by single UPDATE
 * Shows contention with multiple users trying to read while update is in progress
 */
async function multipleReadersBlocked(pool, logger) {
  logger.info('🔒 Starting: Multiple SELECT Queries Blocked by Single UPDATE');
  logger.info('Scenario: Multiple HR staff generating reports while salary batch update runs');
  
  const blockingConn = await pool.getConnection();
  const blockedConns = [];
  
  try {
    // Step 1: Start long-running UPDATE
    logger.info('\n📝 Step 1: Starting batch UPDATE (Company-wide salary adjustment)...');
    
    await blockingConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.03 
       WHERE salary > 10000`, // High earners
      [],
      { autoCommit: false }
    );
    
    logger.info('✅ UPDATE started - Holding locks on high-earning employees');
    
    // Step 2: Multiple SELECTs try to read (will all block)
    logger.info('\n📊 Step 2: 3 concurrent SELECT queries attempting to read...');
    
    const selectPromises = [];
    const queries = [
      {
        name: 'Executive Salary Report',
        sql: `SELECT employee_id, first_name, last_name, salary, job_id 
              FROM employees 
              WHERE salary > 15000 
              ORDER BY salary DESC`
      },
      {
        name: 'Average Salary by Department',
        sql: `SELECT d.department_name, AVG(e.salary) as avg_salary, COUNT(*) as emp_count
              FROM employees e
              JOIN departments d ON e.department_id = d.department_id
              WHERE e.salary > 10000
              GROUP BY d.department_name
              ORDER BY avg_salary DESC`
      },
      {
        name: 'Top Earners List',
        sql: `SELECT first_name || ' ' || last_name as name, 
                     salary, 
                     job_id
              FROM employees 
              WHERE salary > 12000 
              ORDER BY salary DESC 
              FETCH FIRST 10 ROWS ONLY`
      }
    ];
    
    for (let i = 0; i < queries.length; i++) {
      const conn = await pool.getConnection();
      blockedConns.push(conn);
      
      logger.info(`   • Query ${i + 1}: "${queries[i].name}" - WAITING...`);
      
      const promise = conn.execute(queries[i].sql, [], { autoCommit: false })
        .then(result => ({
          name: queries[i].name,
          rows: result.rows.length,
          success: true
        }))
        .catch(err => ({
          name: queries[i].name,
          error: err.message,
          success: false
        }));
      
      selectPromises.push(promise);
    }
    
    // Wait to demonstrate blocking
    logger.info('\n⏰ All 3 queries are now BLOCKED, waiting for UPDATE to complete...');
    await new Promise(resolve => setTimeout(resolve, 7000));
    
    // Step 3: Rollback to release locks (no data change)
    logger.info('\n🔓 Step 3: Rolling back UPDATE to release locks...');
    const commitStart = Date.now();
    await blockingConn.rollback();
    logger.info('✅ Locks released - All blocked queries can now proceed (no data changed)');
    
    // Step 4: Wait for all SELECTs to complete
    logger.info('\n⏳ Step 4: Waiting for all blocked queries to complete...');
    const results = await Promise.all(selectPromises);
    const commitEnd = Date.now();
    
    // Report results
    logger.info('\n📊 QUERY RESULTS:');
    results.forEach((result, idx) => {
      if (result.success) {
        logger.info(`   ✅ ${result.name}: Retrieved ${result.rows} rows`);
      } else {
        logger.info(`   ❌ ${result.name}: Error - ${result.error}`);
      }
    });
    
    const totalTime = ((commitEnd - commitStart) / 1000).toFixed(2);
    logger.info(`\n⏱️  Total time for all queries to complete: ${totalTime} seconds`);
    
    // Cleanup blocked connections
    for (const conn of blockedConns) {
      await conn.commit();
    }
    
    // Summary
    logger.info('\n📋 SUMMARY:');
    logger.info(`   • Blocking Query: UPDATE on high-earning employees`);
    logger.info(`   • Blocked Queries: 3 concurrent SELECT reports`);
    logger.info(`   • Wait Time: ~7 seconds`);
    logger.info(`   • Queries Completed: ${results.filter(r => r.success).length}/${results.length}`);
    logger.info(`   • Scenario: Contention during batch updates`);
    
  } catch (err) {
    logger.error('❌ Error in blocking scenario:', err.message);
    await blockingConn.rollback();
    for (const conn of blockedConns) {
      await conn.rollback();
    }
  } finally {
    await blockingConn.close();
    for (const conn of blockedConns) {
      await conn.close();
    }
  }
  
  logger.info('\n✅ Multiple readers blocking scenario completed\n');
}

/**
 * Annual Salary Review Blocking: Long-running transaction blocking reports
 * Long-running transaction updating salaries while reports are being generated
 */
async function annualSalaryReviewBlocking(pool, logger) {
  logger.info('� Annual Salary Review Blocking Scenario');
  
  const updateConn = await pool.getConnection();
  const reportConn = await pool.getConnection();
  
  try {
    // Simulate multi-step salary review update
    logger.info('Starting annual salary review updates...');
    
    // Step 1: Update managers
    await updateConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.08 
       WHERE job_id LIKE '%MGR%'`,
      [],
      { autoCommit: false }
    );
    
    logger.info('Manager salaries updated (not committed)');
    
    // Step 2: Try to run year-end report (will block on manager records)
    logger.info('Generating year-end compensation report...');
    const reportStart = Date.now();
    
    const reportPromise = reportConn.execute(
      `SELECT 
         CASE WHEN job_id LIKE '%MGR%' THEN 'Manager' ELSE 'Staff' END as level,
         COUNT(*) as emp_count,
         AVG(salary) as avg_salary,
         MIN(salary) as min_salary,
         MAX(salary) as max_salary,
         SUM(salary) as total_salary
       FROM employees
       WHERE salary > 5000
       GROUP BY CASE WHEN job_id LIKE '%MGR%' THEN 'Manager' ELSE 'Staff' END
       ORDER BY avg_salary DESC`,
      [],
      { autoCommit: false }
    );
    
    // Hold the update for realistic duration
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Step 3: Update staff salaries
    await updateConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.04 
       WHERE job_id NOT LIKE '%MGR%' AND salary > 5000`,
      [],
      { autoCommit: false }
    );
    
    logger.info('Staff salaries updated (not committed)');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Rollback the salary changes (no data changed)
    logger.info('Rolling back salary changes (demo only - no data change)...');
    await updateConn.rollback();
    
    // Now the report can complete
    const reportResult = await reportPromise;
    const reportEnd = Date.now();
    
    logger.info(`Year-end report completed in ${((reportEnd - reportStart) / 1000).toFixed(2)}s`);
    logger.info(`Report rows: ${reportResult.rows.length}`);
    
    await reportConn.commit();
    
  } catch (err) {
    logger.error('Error in salary review blocking:', err.message);
    await updateConn.rollback();
    await reportConn.rollback();
  } finally {
    await updateConn.close();
    await reportConn.close();
  }
}

/**
 * Start the blocking workload
 */
async function start(pool, logger, duration = 300, intensity = 'medium') {
  if (isRunning) {
    logger.warn('Blocking workload is already running');
    return;
  }
  
  isRunning = true;
  logger.info('Starting blocking workload...');
  logger.info(`Duration: ${duration}s, Intensity: ${intensity}`);
  
  // Run blocking scenarios based on intensity
  const scenarios = {
    low: [
      { fn: basicBlockingScenario, interval: 60000 } // Every 60s
    ],
    medium: [
      { fn: basicBlockingScenario, interval: 45000 }, // Every 45s
      { fn: multipleReadersBlocked, interval: 90000 } // Every 90s
    ],
    high: [
      { fn: basicBlockingScenario, interval: 30000 }, // Every 30s
      { fn: multipleReadersBlocked, interval: 60000 }, // Every 60s
      { fn: annualSalaryReviewBlocking, interval: 120000 } // Every 2 mins
    ]
  };
  
  const selectedScenarios = scenarios[intensity] || scenarios.medium;
  
  // Run each scenario immediately
  for (const scenario of selectedScenarios) {
    scenario.fn(pool, logger).catch(err => 
      logger.error(`Error in blocking scenario:`, err)
    );
  }
  
  // Set up intervals for repeated execution
  for (const scenario of selectedScenarios) {
    const interval = setInterval(async () => {
      if (!isRunning) return;
      try {
        await scenario.fn(pool, logger);
      } catch (err) {
        logger.error('Error in blocking scenario:', err);
      }
    }, scenario.interval);
    
    intervals.push(interval);
  }
  
  // Stop after duration
  setTimeout(() => {
    stop(logger);
  }, duration * 1000);
  
  logger.info('Blocking workload started');
}

/**
 * Stop the blocking workload
 */
function stop(logger) {
  if (!isRunning) {
    logger.warn('Blocking workload is not running');
    return;
  }
  
  isRunning = false;
  
  // Clear all intervals
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  
  logger.info('Blocking workload stopped');
}

/**
 * Check if workload is running
 */
function getStatus() {
  return {
    running: isRunning,
    activeIntervals: intervals.length
  };
}

module.exports = {
  start,
  stop,
  getStatus,
  // Export individual scenarios for direct testing
  basicBlockingScenario,
  multipleReadersBlocked,
  annualSalaryReviewBlocking
};
