#!/usr/bin/env node

/**
 * Standalone Demo Script: Blocking Queries
 * 
 * This script demonstrates a realistic blocking scenario where:
 * - An UPDATE query locks employee records (salary adjustment)
 * - A SELECT query tries to read the same records and gets blocked
 * - Shows wait times and demonstrates real-world query performance issues
 * 
 * Usage:
 *   node demo-blocking.js [scenario]
 * 
 * Scenarios:
 *   basic    - Simple SELECT blocked by UPDATE (default)
 *   multiple - Multiple SELECTs blocked by one UPDATE
 *   review   - Annual salary review blocking scenario
 *   all      - Run all scenarios sequentially
 */

require('dotenv').config();
const oracledb = require('oracledb');
const winston = require('winston');

// Initialize Oracle Thick Mode
try {
  oracledb.initOracleClient();
  console.log('✅ Oracle Thick Mode initialized');
} catch (err) {
  console.log('⚠️  Oracle Thick Mode init skipped (may already be initialized or not needed)');
}

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Database configuration
const dbConfig = {
  user: process.env.ORACLE_USER || 'hr',
  password: process.env.ORACLE_PASSWORD || 'hr',
  connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/FREEPDB1'
};

// Validate configuration
if (!process.env.ORACLE_USER || !process.env.ORACLE_PASSWORD) {
  logger.warn('⚠️  Using default credentials - configure .env for production');
}

/**
 * Demo 1: Basic Blocking Scenario
 * Single SELECT blocked by single UPDATE
 */
async function basicBlockingDemo(pool) {
  logger.info('\n' + '='.repeat(80));
  logger.info('🎭 DEMO 1: Basic Blocking Scenario');
  logger.info('='.repeat(80));
  logger.info('Scenario: HR salary adjustment blocking department report');
  logger.info('');
  
  const blockingConn = await pool.getConnection();
  const blockedConn = await pool.getConnection();
  
  try {
    // Step 1: Start UPDATE
    logger.info('📝 Step 1: Starting UPDATE query...');
    logger.info('   Query: UPDATE employees SET salary = salary * 1.05 WHERE department_id = 60');
    
    await blockingConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.05 
       WHERE department_id = 60`,
      [],
      { autoCommit: false }
    );
    
    logger.info('   ✅ UPDATE executing - Holding locks on IT Department employees');
    logger.info('');
    
    // Step 2: Try SELECT (will block)
    logger.info('📊 Step 2: Starting SELECT query (will be BLOCKED)...');
    logger.info('   Query: SELECT employee details from department 60');
    logger.info('   ⏰ SELECT is now WAITING for locks to be released...');
    logger.info('');
    
    const selectStart = Date.now();
    
    const selectPromise = blockedConn.execute(
      `SELECT e.employee_id, 
              e.first_name || ' ' || e.last_name as name,
              e.salary,
              j.job_title,
              d.department_name
       FROM employees e
       JOIN jobs j ON e.job_id = j.job_id
       JOIN departments d ON e.department_id = d.department_id
       WHERE e.department_id = 60
       ORDER BY e.salary DESC`,
      [],
      { autoCommit: false }
    );
    
    // Simulate long-running update
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 3: Commit UPDATE
    logger.info('🔓 Step 3: Committing UPDATE query...');
    await blockingConn.commit();
    logger.info('   ✅ Locks released');
    logger.info('');
    
    // Step 4: SELECT completes
    logger.info('⏳ Step 4: SELECT query proceeding...');
    const result = await selectPromise;
    await blockedConn.commit();
    
    const selectEnd = Date.now();
    const waitTime = ((selectEnd - selectStart) / 1000).toFixed(2);
    
    logger.info(`   ✅ SELECT completed in ${waitTime} seconds`);
    logger.info(`   📊 Retrieved ${result.rows.length} records`);
    logger.info('');
    
    // Display results
    logger.info('📋 Sample Results:');
    result.rows.slice(0, 3).forEach((row, idx) => {
      logger.info(`   ${idx + 1}. ${row[1]} - $${row[2]} - ${row[3]}`);
    });
    
    logger.info('');
    logger.info('🎯 DEMO SUMMARY:');
    logger.info(`   • Blocking Query: UPDATE on department 60`);
    logger.info(`   • Blocked Query: SELECT from department 60`);
    logger.info(`   • Wait Time: ${waitTime} seconds`);
    logger.info(`   • Impact: Report generation delayed by ${waitTime}s`);
    
  } catch (err) {
    logger.error('❌ Error:', err.message);
    await blockingConn.rollback();
    await blockedConn.rollback();
  } finally {
    await blockingConn.close();
    await blockedConn.close();
  }
}

/**
 * Demo 2: Multiple Readers Blocked
 * Three SELECT queries blocked by one UPDATE
 */
async function multipleReadersDemo(pool) {
  logger.info('\n' + '='.repeat(80));
  logger.info('🎭 DEMO 2: Multiple Readers Blocked');
  logger.info('='.repeat(80));
  logger.info('Scenario: Multiple reports blocked by salary batch update');
  logger.info('');
  
  const blockingConn = await pool.getConnection();
  const blockedConns = [];
  
  try {
    // Step 1: Start UPDATE
    logger.info('📝 Step 1: Starting batch UPDATE...');
    logger.info('   Query: UPDATE high-earning employees (salary > 10000)');
    
    await blockingConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.03 
       WHERE salary > 10000`,
      [],
      { autoCommit: false }
    );
    
    logger.info('   ✅ UPDATE executing - Locks acquired');
    logger.info('');
    
    // Step 2: Start multiple SELECTs
    logger.info('📊 Step 2: Starting 3 concurrent SELECT queries...');
    
    const queries = [
      {
        name: 'Executive Report',
        sql: `SELECT employee_id, first_name, last_name, salary 
              FROM employees 
              WHERE salary > 15000 
              ORDER BY salary DESC`
      },
      {
        name: 'Department Averages',
        sql: `SELECT d.department_name, AVG(e.salary) as avg_salary
              FROM employees e
              JOIN departments d ON e.department_id = d.department_id
              WHERE e.salary > 10000
              GROUP BY d.department_name`
      },
      {
        name: 'Top 10 Earners',
        sql: `SELECT first_name || ' ' || last_name as name, salary
              FROM employees 
              WHERE salary > 12000 
              ORDER BY salary DESC 
              FETCH FIRST 10 ROWS ONLY`
      }
    ];
    
    const selectPromises = [];
    
    for (let i = 0; i < queries.length; i++) {
      const conn = await pool.getConnection();
      blockedConns.push(conn);
      
      logger.info(`   ${i + 1}. "${queries[i].name}" - WAITING...`);
      
      const promise = conn.execute(queries[i].sql, [], { autoCommit: false })
        .then(result => ({
          name: queries[i].name,
          rows: result.rows.length,
          success: true
        }));
      
      selectPromises.push(promise);
    }
    
    logger.info('');
    logger.info('   ⏰ All 3 queries are BLOCKED, waiting...');
    logger.info('');
    
    // Hold locks
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Step 3: Release locks
    logger.info('🔓 Step 3: Committing UPDATE...');
    const releaseStart = Date.now();
    await blockingConn.commit();
    logger.info('   ✅ Locks released - All queries can proceed');
    logger.info('');
    
    // Step 4: Wait for completion
    logger.info('⏳ Step 4: Queries completing...');
    const results = await Promise.all(selectPromises);
    const releaseEnd = Date.now();
    
    const totalTime = ((releaseEnd - releaseStart) / 1000).toFixed(2);
    
    logger.info('');
    logger.info('📊 RESULTS:');
    results.forEach((result, idx) => {
      logger.info(`   ✅ ${result.name}: ${result.rows} rows retrieved`);
    });
    
    logger.info('');
    logger.info('🎯 DEMO SUMMARY:');
    logger.info(`   • Blocking Query: 1 UPDATE on high earners`);
    logger.info(`   • Blocked Queries: 3 concurrent SELECTs`);
    logger.info(`   • Wait Time: ~6 seconds`);
    logger.info(`   • Completion Time: ${totalTime} seconds after lock release`);
    logger.info(`   • Impact: Multiple business reports delayed simultaneously`);
    
    // Cleanup
    for (const conn of blockedConns) {
      await conn.commit();
    }
    
  } catch (err) {
    logger.error('❌ Error:', err.message);
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
}

/**
 * Demo 3: Annual Review Blocking
 * Multi-step update process blocking comprehensive reports
 */
async function annualReviewDemo(pool) {
  logger.info('\n' + '='.repeat(80));
  logger.info('🎭 DEMO 3: Annual Salary Review Blocking');
  logger.info('='.repeat(80));
  logger.info('Scenario: Year-end salary adjustments blocking compensation analysis');
  logger.info('');
  
  const updateConn = await pool.getConnection();
  const reportConn = await pool.getConnection();
  
  try {
    logger.info('📝 Starting multi-step salary review process...');
    logger.info('');
    
    // Step 1: Update managers
    logger.info('   1️⃣  Updating manager salaries (+8%)...');
    await updateConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.08 
       WHERE job_id LIKE '%MGR%'`,
      [],
      { autoCommit: false }
    );
    logger.info('      ✅ Managers updated (not committed)');
    
    // Step 2: Start report (will block)
    logger.info('');
    logger.info('📊 Generating year-end compensation report...');
    logger.info('   ⏰ Report query BLOCKED by ongoing salary updates...');
    
    const reportStart = Date.now();
    const reportPromise = reportConn.execute(
      `SELECT 
         CASE WHEN job_id LIKE '%MGR%' THEN 'Manager' ELSE 'Staff' END as level,
         COUNT(*) as emp_count,
         ROUND(AVG(salary), 2) as avg_salary,
         ROUND(MIN(salary), 2) as min_salary,
         ROUND(MAX(salary), 2) as max_salary
       FROM employees
       WHERE salary > 5000
       GROUP BY CASE WHEN job_id LIKE '%MGR%' THEN 'Manager' ELSE 'Staff' END`,
      [],
      { autoCommit: false }
    );
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Update staff
    logger.info('');
    logger.info('   2️⃣  Updating staff salaries (+4%)...');
    await updateConn.execute(
      `UPDATE employees 
       SET salary = salary * 1.04 
       WHERE job_id NOT LIKE '%MGR%' AND salary > 5000`,
      [],
      { autoCommit: false }
    );
    logger.info('      ✅ Staff updated (not committed)');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 4: Commit
    logger.info('');
    logger.info('🔓 Committing all salary changes...');
    await updateConn.commit();
    logger.info('   ✅ Changes committed - Locks released');
    
    // Report completes
    logger.info('');
    logger.info('⏳ Report query proceeding...');
    const reportResult = await reportPromise;
    await reportConn.commit();
    
    const reportEnd = Date.now();
    const totalTime = ((reportEnd - reportStart) / 1000).toFixed(2);
    
    logger.info(`   ✅ Report completed in ${totalTime} seconds`);
    logger.info('');
    logger.info('📊 COMPENSATION ANALYSIS:');
    reportResult.rows.forEach(row => {
      logger.info(`   ${row[0]}: ${row[1]} employees, Avg: $${row[2]}, Range: $${row[3]}-$${row[4]}`);
    });
    
    logger.info('');
    logger.info('🎯 DEMO SUMMARY:');
    logger.info(`   • Blocking Process: Multi-step salary review (Managers + Staff)`);
    logger.info(`   • Blocked Query: Year-end compensation report`);
    logger.info(`   • Total Time: ${totalTime} seconds`);
    logger.info(`   • Impact: Executive reporting delayed during annual review process`);
    
  } catch (err) {
    logger.error('❌ Error:', err.message);
    await updateConn.rollback();
    await reportConn.rollback();
  } finally {
    await updateConn.close();
    await reportConn.close();
  }
}

/**
 * Main function
 */
async function main() {
  const scenario = process.argv[2] || 'basic';
  
  logger.info('\n' + '█'.repeat(80));
  logger.info('🎬 Oracle Blocking Queries Demo');
  logger.info('█'.repeat(80));
  logger.info('');
  logger.info(`Database: ${dbConfig.connectString}`);
  logger.info(`Schema: ${dbConfig.user.toUpperCase()}`);
  logger.info(`Scenario: ${scenario}`);
  logger.info('');
  
  // Create connection pool
  let pool;
  try {
    pool = await oracledb.createPool({
      user: dbConfig.user,
      password: dbConfig.password,
      connectString: dbConfig.connectString,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1
    });
    
    logger.info('✅ Connected to Oracle Database');
    logger.info('');
    
    // Run selected scenario(s)
    switch (scenario.toLowerCase()) {
      case 'basic':
        await basicBlockingDemo(pool);
        break;
      
      case 'multiple':
        await multipleReadersDemo(pool);
        break;
      
      case 'review':
        await annualReviewDemo(pool);
        break;
      
      case 'all':
        await basicBlockingDemo(pool);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await multipleReadersDemo(pool);
        await new Promise(resolve => setTimeout(resolve, 2000));
        await annualReviewDemo(pool);
        break;
      
      default:
        logger.error(`❌ Unknown scenario: ${scenario}`);
        logger.info('Available scenarios: basic, multiple, review, all');
        process.exit(1);
    }
    
    logger.info('\n' + '█'.repeat(80));
    logger.info('✅ Demo completed successfully!');
    logger.info('█'.repeat(80));
    logger.info('');
    logger.info('💡 Key Takeaways:');
    logger.info('   • UPDATE queries hold locks on affected rows');
    logger.info('   • SELECT queries wait when reading locked rows');
    logger.info('   • Multiple queries can be blocked by a single UPDATE');
    logger.info('   • Lock wait times directly impact query performance');
    logger.info('   • This demonstrates real-world performance bottlenecks');
    logger.info('');
    
  } catch (err) {
    logger.error('❌ Fatal error:', err.message);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      logger.info('🔌 Database connection closed');
    }
  }
}

// Run the demo
main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
