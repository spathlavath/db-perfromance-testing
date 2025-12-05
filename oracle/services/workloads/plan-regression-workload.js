/**
 * Query Plan Regression Workload - Aligned with newrelicoraclereceiver Flow
 *
 * Simulates queries that perform well initially but suddenly become slow due to plan changes.
 *
 * Receiver Flow:
 * 1. Slow Queries Scraper: v$sqlarea → sql_id with high avg_elapsed_time_ms
 * 2. Wait Events Scraper: v$session WHERE status='ACTIVE' AND state='WAITING' → (sql_id, child_number)
 * 3. Child Cursor Scraper: v$sql → plan_hash_value for each (sql_id, child_number)
 * 4. Execution Plan Scraper: v$sql_plan → full execution plan
 *
 * This workload creates queries that:
 * - Show up in v$sqlarea with varying performance (slow queries scraper)
 * - Create ACTIVE WAITING sessions (wait events scraper)
 * - Have different plan_hash_value for same sql_id (child cursor scraper detects regression)
 */

let isRunning = false;
let intervals = [];

/**
 * Scenario: Heavy Multi-Table Join with Plan Variation
 *
 * Creates long-running queries (15-25 seconds) that:
 * 1. Show up in v$sqlarea with high elapsed_time
 * 2. Enter ACTIVE + WAITING state (I/O waits, buffer busy waits)
 * 3. Have valid sql_id and child_number for downstream processing
 * 4. Use different execution plans (INDEX vs FULL SCAN) showing regression
 *
 * Real-world trigger: Same query that was fast (using indexes) becomes slow
 * when optimizer switches to full table scans due to stale statistics
 */
async function planRegressionScenario(pool, logger) {
  logger.info('[PLAN REGRESSION] Starting plan regression scenario...');

  // Phase 1: Execute query with "good" plan (will use indexes where available)
  const conn1 = await pool.getConnection();

  try {
    logger.info('[GOOD PLAN] Executing query with optimal plan (index access)...');

    const start1 = Date.now();

    // Query designed to trigger I/O waits (will enter WAITING state)
    // Uses selective predicates that should use indexes
    await conn1.execute(`
      SELECT /*+ INDEX(e) */
        e.employee_id,
        e.first_name,
        e.last_name,
        e.salary,
        e.hire_date,
        d.department_name,
        d.manager_id,
        l.city,
        l.street_address,
        c.country_name,
        r.region_name,
        j.job_title,
        j.min_salary,
        j.max_salary,
        -- Expensive computations to increase execution time
        MONTHS_BETWEEN(SYSDATE, e.hire_date) as months_employed,
        (e.salary / NULLIF(j.min_salary, 0)) * 100 as salary_percentage,
        -- Subquery causing additional I/O
        (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.department_id = e.department_id) as dept_avg_salary,
        -- Window function causing sort operations
        ROW_NUMBER() OVER (PARTITION BY d.department_id ORDER BY e.salary DESC) as dept_rank
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      INNER JOIN locations l ON d.location_id = l.location_id
      INNER JOIN countries c ON l.country_id = c.country_id
      INNER JOIN regions r ON c.region_id = r.region_id
      INNER JOIN jobs j ON e.job_id = j.job_id
      WHERE e.salary BETWEEN 5000 AND 15000
        AND e.hire_date > TO_DATE('1995-01-01', 'YYYY-MM-DD')
        AND r.region_name IN ('Europe', 'Americas', 'Asia')
      ORDER BY dept_rank, e.salary DESC
    `, [], { outFormat: require('../oracledb-instrumented').OUT_FORMAT_OBJECT });

    const elapsed1 = Date.now() - start1;
    logger.info(`[GOOD PLAN] Query completed in ${elapsed1}ms`);

  } catch (err) {
    logger.error('[GOOD PLAN] Error:', err.message);
  } finally {
    await conn1.close();
  }

  // Wait between executions
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Phase 2: Execute same query with "bad" plan (forced full table scans)
  // This simulates what happens when statistics go stale or cost model changes
  const conn2 = await pool.getConnection();

  try {
    logger.info('[BAD PLAN] Executing same query with degraded plan (full scans)...');
    logger.info('[BAD PLAN] This should enter WAITING state with User I/O waits...');

    const start2 = Date.now();

    // Same query logic but with hints forcing suboptimal plan
    // This will create ACTIVE sessions in WAITING state (direct path read, buffer busy waits)
    await conn2.execute(`
      SELECT /*+ FULL(e) FULL(d) FULL(l) FULL(c) FULL(r) FULL(j) USE_HASH(e d l c r j) */
        e.employee_id,
        e.first_name,
        e.last_name,
        e.salary,
        e.hire_date,
        d.department_name,
        d.manager_id,
        l.city,
        l.street_address,
        c.country_name,
        r.region_name,
        j.job_title,
        j.min_salary,
        j.max_salary,
        -- Expensive computations
        MONTHS_BETWEEN(SYSDATE, e.hire_date) as months_employed,
        (e.salary / NULLIF(j.min_salary, 0)) * 100 as salary_percentage,
        -- Subquery causing additional I/O
        (SELECT AVG(e2.salary) FROM employees e2 WHERE e2.department_id = e.department_id) as dept_avg_salary,
        -- Window function causing sort operations (will use temp space → direct path write temp)
        ROW_NUMBER() OVER (PARTITION BY d.department_id ORDER BY e.salary DESC) as dept_rank
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      INNER JOIN locations l ON d.location_id = l.location_id
      INNER JOIN countries c ON l.country_id = c.country_id
      INNER JOIN regions r ON c.region_id = r.region_id
      INNER JOIN jobs j ON e.job_id = j.job_id
      WHERE e.salary BETWEEN 5000 AND 15000
        AND e.hire_date > TO_DATE('1995-01-01', 'YYYY-MM-DD')
        AND r.region_name IN ('Europe', 'Americas', 'Asia')
      ORDER BY dept_rank, e.salary DESC
    `, [], { outFormat: require('../oracledb-instrumented').OUT_FORMAT_OBJECT });

    const elapsed2 = Date.now() - start2;
    const degradation = ((elapsed2 - elapsed1) / elapsed1 * 100).toFixed(2);

    logger.info(`[BAD PLAN] Query completed in ${elapsed2}ms`);
    logger.info(`[PLAN REGRESSION] Performance degradation: ${degradation}% slower`);
    logger.info(`[PLAN REGRESSION] Receiver should capture:`);
    logger.info(`  1. Slow Queries: Same query pattern with different avg_elapsed_time_ms`);
    logger.info(`  2. Wait Events: ACTIVE sessions in WAITING state (User I/O, direct path read)`);
    logger.info(`  3. Child Cursors: DIFFERENT plan_hash_value for same query semantics`);
    logger.info(`  4. Execution Plans: INDEX SCAN vs FULL TABLE SCAN comparison`);

  } catch (err) {
    logger.error('[BAD PLAN] Error:', err.message);
  } finally {
    await conn2.close();
  }

  logger.info('[PLAN REGRESSION] Scenario completed');
}

/**
 * Scenario 2: Same SQL_ID with Bind Variable Causing Plan Variation
 *
 * Executes the EXACT SAME SQL multiple times with different bind values
 * This creates entries in v$sqlarea showing performance variance for same sql_id
 */
async function bindVariablePlanRegression(pool, logger) {
  logger.info('[BIND REGRESSION] Starting bind variable plan regression...');

  const connection = await pool.getConnection();

  try {
    // Execute same SQL with different bind values
    // First execution: Selective (fast)
    logger.info('[BIND REGRESSION] Executing with selective bind value...');

    const start1 = Date.now();
    await connection.execute(`
      SELECT e.employee_id, e.first_name, e.last_name, e.salary,
             d.department_name, l.city, c.country_name
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
      JOIN locations l ON d.location_id = l.location_id
      JOIN countries c ON l.country_id = c.country_id
      WHERE e.salary > :minSalary
        AND e.hire_date > TO_DATE('2000-01-01', 'YYYY-MM-DD')
      ORDER BY e.salary DESC
    `, { minSalary: 15000 });  // Selective - few rows

    logger.info(`[BIND REGRESSION] Selective query: ${Date.now() - start1}ms`);

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Second execution: Non-selective (slow, enters WAITING state)
    logger.info('[BIND REGRESSION] Executing with non-selective bind value (will wait)...');

    const start2 = Date.now();
    await connection.execute(`
      SELECT e.employee_id, e.first_name, e.last_name, e.salary,
             d.department_name, l.city, c.country_name
      FROM employees e
      JOIN departments d ON e.department_id = d.department_id
      JOIN locations l ON d.location_id = l.location_id
      JOIN countries c ON l.country_id = c.country_id
      WHERE e.salary > :minSalary
        AND e.hire_date > TO_DATE('2000-01-01', 'YYYY-MM-DD')
      ORDER BY e.salary DESC
    `, { minSalary: 3000 });  // Non-selective - most rows

    logger.info(`[BIND REGRESSION] Non-selective query: ${Date.now() - start2}ms`);
    logger.info(`[BIND REGRESSION] Same SQL_ID, different performance due to bind value`);

  } catch (err) {
    logger.error('[BIND REGRESSION] Error:', err.message);
  } finally {
    await connection.close();
  }
}

function start(pool, logger, duration = 300, intensity = 'low') {
  if (isRunning) {
    logger.warn('Plan regression workload already running');
    return;
  }

  isRunning = true;
  logger.info(`Starting plan regression workload for ${duration} seconds`);
  logger.info('Creating queries with plan variations that receiver can detect...');

  const intensityConfig = {
    low: { planRegression: 180000, bindRegression: 240000 },      // Every 3-4 minutes
    medium: { planRegression: 120000, bindRegression: 150000 },   // Every 2-2.5 minutes
    high: { planRegression: 90000, bindRegression: 120000 }       // Every 1.5-2 minutes
  };

  const config = intensityConfig[intensity] || intensityConfig.low;

  // Main plan regression scenario (creates ACTIVE WAITING sessions)
  intervals.push(setInterval(() =>
    planRegressionScenario(pool, logger).catch(err =>
      logger.error('[PLAN REGRESSION] Scenario error:', err)
    ), config.planRegression
  ));

  // Bind variable plan regression (shows performance variance in v$sqlarea)
  intervals.push(setInterval(() =>
    bindVariablePlanRegression(pool, logger).catch(err =>
      logger.error('[BIND REGRESSION] Scenario error:', err)
    ), config.bindRegression
  ));

  // Stop after duration
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;

  logger.info('Stopping plan regression workload...');
  intervals.forEach(interval => clearInterval(interval));
  intervals = [];
  isRunning = false;
  logger.info('Plan regression workload stopped');
}

module.exports = { start, stop };
