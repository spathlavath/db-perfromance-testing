/**
 * Complex Query Workload - Specifically for Wait Event Testing
 * Creates complex queries that will appear in v$session as ACTIVE with WAITING state
 *
 * These queries are designed to:
 * 1. Run long enough (20-30+ seconds) for receiver to capture
 * 2. Trigger various wait events (I/O, CPU, buffer, latch waits)
 * 3. Have valid sql_id and sql_child_number for downstream processing
 */

let isRunning = false;
let intervals = [];

/**
 * Complex multi-join query with aggregations - Triggers multiple wait types
 */
async function complexJoinQuery(pool, logger, holdDurationSec = 25) {
  logger.info(`Starting complex join query for ${holdDurationSec}s...`);

  const connection = await pool.getConnection();

  try {
    // Execute in background to keep it ACTIVE for monitoring
    connection.execute(`
      SELECT /*+ FULL(e) FULL(d) FULL(l) FULL(c) FULL(r) FULL(j) NO_INDEX */
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.salary,
        e.hire_date,
        d.department_name,
        d.manager_id as dept_manager_id,
        l.street_address,
        l.postal_code,
        l.city,
        l.state_province,
        c.country_name,
        r.region_name,
        j.job_title,
        j.min_salary,
        j.max_salary,
        -- Expensive computations to increase wait time
        (e.salary / NULLIF(j.min_salary, 0)) * 100 as salary_percentage,
        MONTHS_BETWEEN(SYSDATE, e.hire_date) as months_employed,
        CASE
          WHEN e.salary > j.max_salary THEN 'Over Maximum'
          WHEN e.salary < j.min_salary THEN 'Under Minimum'
          ELSE 'Within Range'
        END as salary_status,
        -- Subquery causing additional I/O
        (SELECT AVG(e2.salary)
         FROM employees e2
         WHERE e2.department_id = e.department_id) as dept_avg_salary,
        -- Window functions causing sorts
        ROW_NUMBER() OVER (PARTITION BY d.department_id ORDER BY e.salary DESC) as dept_salary_rank,
        DENSE_RANK() OVER (ORDER BY e.salary DESC) as company_salary_rank,
        PERCENT_RANK() OVER (PARTITION BY j.job_id ORDER BY e.hire_date) as job_seniority_pct
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      INNER JOIN locations l ON d.location_id = l.location_id
      INNER JOIN countries c ON l.country_id = c.country_id
      INNER JOIN regions r ON c.region_id = r.region_id
      INNER JOIN jobs j ON e.job_id = j.job_id
      WHERE e.salary IS NOT NULL
        AND d.department_name IS NOT NULL
        AND e.hire_date > TO_DATE('1990-01-01', 'YYYY-MM-DD')
      ORDER BY
        dept_salary_rank,
        company_salary_rank,
        e.employee_id
    `).catch(err => {
      logger.debug('Complex join query completed or timed out:', err.message);
    });

    logger.info('[ACTIVE] Complex join query running (expect User I/O, buffer busy waits)');

    // Hold query active for monitoring
    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await connection.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  }

  logger.info('Complex join query completed');
}

/**
 * Analytical query with multiple aggregations - Heavy CPU and temp I/O
 */
async function analyticalAggregationQuery(pool, logger, holdDurationSec = 25) {
  logger.info(`Starting analytical aggregation query for ${holdDurationSec}s...`);

  const connection = await pool.getConnection();

  try {
    connection.execute(`
      SELECT /*+ FULL(e) FULL(d) FULL(j) */
        d.department_name,
        j.job_title,
        COUNT(DISTINCT e.employee_id) as total_employees,
        SUM(e.salary) as total_salary,
        AVG(e.salary) as avg_salary,
        MIN(e.salary) as min_salary,
        MAX(e.salary) as max_salary,
        STDDEV(e.salary) as salary_stddev,
        VARIANCE(e.salary) as salary_variance,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY e.salary) as salary_p25,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY e.salary) as salary_median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY e.salary) as salary_p75,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY e.salary) as salary_p90,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY e.salary) as salary_p95,
        COUNT(CASE WHEN e.commission_pct IS NOT NULL THEN 1 END) as commissioned_emp,
        AVG(CASE WHEN e.commission_pct IS NOT NULL THEN e.salary END) as avg_commissioned_salary,
        MIN(e.hire_date) as first_hire_date,
        MAX(e.hire_date) as last_hire_date,
        AVG(MONTHS_BETWEEN(SYSDATE, e.hire_date)) as avg_months_employed,
        -- Nested aggregations
        SUM(e.salary) / NULLIF((SELECT SUM(salary) FROM employees), 0) * 100 as pct_of_total_payroll
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      INNER JOIN jobs j ON e.job_id = j.job_id
      WHERE e.salary > 0
      GROUP BY ROLLUP(d.department_name, j.job_title)
      HAVING COUNT(e.employee_id) > 0
      ORDER BY
        total_salary DESC NULLS LAST,
        avg_salary DESC NULLS LAST
    `).catch(err => {
      logger.debug('Analytical query completed or timed out:', err.message);
    });

    logger.info('[ACTIVE] Analytical aggregation query running (expect direct path write temp, CPU waits)');

    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await connection.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  }

  logger.info('Analytical aggregation query completed');
}

/**
 * Hierarchical query with CONNECT BY - Recursive operations
 */
async function hierarchicalQuery(pool, logger, holdDurationSec = 20) {
  logger.info(`Starting hierarchical query for ${holdDurationSec}s...`);

  const connection = await pool.getConnection();

  try {
    connection.execute(`
      SELECT
        LEVEL as hierarchy_level,
        SYS_CONNECT_BY_PATH(e.first_name || ' ' || e.last_name, ' -> ') as reporting_chain,
        e.employee_id,
        e.first_name,
        e.last_name,
        e.email,
        e.salary,
        e.manager_id,
        d.department_name,
        j.job_title,
        -- Count subordinates
        (SELECT COUNT(*)
         FROM employees e2
         WHERE e2.manager_id = e.employee_id) as direct_reports,
        -- Total reports (recursive)
        (SELECT SUM(e3.salary)
         FROM employees e3
         START WITH e3.manager_id = e.employee_id
         CONNECT BY PRIOR e3.employee_id = e3.manager_id) as total_subordinate_salary,
        -- Path depth
        CONNECT_BY_ISLEAF as is_leaf,
        CONNECT_BY_ISCYCLE as is_cycle
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      INNER JOIN jobs j ON e.job_id = j.job_id
      START WITH e.manager_id IS NULL
      CONNECT BY PRIOR e.employee_id = e.manager_id
      ORDER SIBLINGS BY e.salary DESC
    `).catch(err => {
      logger.debug('Hierarchical query completed or timed out:', err.message);
    });

    logger.info('[ACTIVE] Hierarchical query running (expect recursive calls, buffer waits)');

    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await connection.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  }

  logger.info('Hierarchical query completed');
}

/**
 * Self-join pattern matching query - Buffer cache contention
 */
async function selfJoinPatternQuery(pool, logger, holdDurationSec = 25) {
  logger.info(`Starting self-join pattern query for ${holdDurationSec}s...`);

  const connection = await pool.getConnection();

  try {
    connection.execute(`
      SELECT /*+ FULL(e1) FULL(e2) FULL(e3) NO_INDEX */
        e1.employee_id as emp1_id,
        e1.first_name || ' ' || e1.last_name as emp1_name,
        e1.salary as emp1_salary,
        e1.department_id as emp1_dept,
        e2.employee_id as emp2_id,
        e2.first_name || ' ' || e2.last_name as emp2_name,
        e2.salary as emp2_salary,
        e2.department_id as emp2_dept,
        ABS(e1.salary - e2.salary) as salary_diff,
        CASE
          WHEN e1.department_id = e2.department_id THEN 'Same Department'
          ELSE 'Different Department'
        END as dept_relationship,
        -- Find colleagues with similar salaries
        (SELECT COUNT(*)
         FROM employees e3
         WHERE e3.salary BETWEEN e1.salary - 1000 AND e1.salary + 1000
           AND e3.employee_id != e1.employee_id) as similar_salary_count,
        RANK() OVER (PARTITION BY e1.department_id ORDER BY ABS(e1.salary - e2.salary)) as similarity_rank
      FROM employees e1
      CROSS JOIN employees e2
      WHERE e1.employee_id < e2.employee_id
        AND ABS(e1.salary - e2.salary) < 5000
        AND e1.salary IS NOT NULL
        AND e2.salary IS NOT NULL
      ORDER BY salary_diff, e1.employee_id
    `).catch(err => {
      logger.debug('Self-join query completed or timed out:', err.message);
    });

    logger.info('[ACTIVE] Self-join pattern query running (expect buffer busy waits, latch waits)');

    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await connection.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  }

  logger.info('Self-join pattern query completed');
}

/**
 * Time-series analysis query - Heavy sorting and grouping
 */
async function timeSeriesAnalysisQuery(pool, logger, holdDurationSec = 20) {
  logger.info(`Starting time-series analysis query for ${holdDurationSec}s...`);

  const connection = await pool.getConnection();

  try {
    connection.execute(`
      SELECT
        TO_CHAR(e.hire_date, 'YYYY') as hire_year,
        TO_CHAR(e.hire_date, 'Q') as hire_quarter,
        TO_CHAR(e.hire_date, 'MM') as hire_month,
        d.department_name,
        COUNT(*) as hires_in_period,
        AVG(e.salary) as avg_starting_salary,
        SUM(e.salary) as total_salary_cost,
        -- Running totals
        SUM(COUNT(*)) OVER (ORDER BY TO_CHAR(e.hire_date, 'YYYY'), TO_CHAR(e.hire_date, 'MM')) as cumulative_hires,
        SUM(SUM(e.salary)) OVER (ORDER BY TO_CHAR(e.hire_date, 'YYYY'), TO_CHAR(e.hire_date, 'MM')) as cumulative_salary_cost,
        -- Moving averages
        AVG(COUNT(*)) OVER (ORDER BY TO_CHAR(e.hire_date, 'YYYY'), TO_CHAR(e.hire_date, 'MM')
                            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as moving_avg_hires_3month,
        -- Year-over-year comparison
        LAG(COUNT(*), 12) OVER (ORDER BY TO_CHAR(e.hire_date, 'YYYY'), TO_CHAR(e.hire_date, 'MM')) as hires_same_month_last_year,
        COUNT(*) - LAG(COUNT(*), 12) OVER (ORDER BY TO_CHAR(e.hire_date, 'YYYY'), TO_CHAR(e.hire_date, 'MM')) as yoy_hire_change
      FROM employees e
      INNER JOIN departments d ON e.department_id = d.department_id
      WHERE e.hire_date IS NOT NULL
      GROUP BY
        TO_CHAR(e.hire_date, 'YYYY'),
        TO_CHAR(e.hire_date, 'Q'),
        TO_CHAR(e.hire_date, 'MM'),
        d.department_name
      ORDER BY
        hire_year,
        hire_month,
        d.department_name
    `).catch(err => {
      logger.debug('Time-series query completed or timed out:', err.message);
    });

    logger.info('[ACTIVE] Time-series analysis query running (expect sort area overflow, temp I/O)');

    await new Promise(resolve => setTimeout(resolve, holdDurationSec * 1000));

  } finally {
    try {
      await connection.close();
    } catch (err) {
      logger.error('Error closing connection:', err.message);
    }
  }

  logger.info('Time-series analysis query completed');
}

function start(pool, logger, duration = 300, intensity = 'low') {
  if (isRunning) {
    logger.warn('Complex query workload already running');
    return;
  }

  isRunning = true;
  logger.info(`Starting complex query workload with ${intensity} intensity for ${duration} seconds`);
  logger.info('These queries will create ACTIVE sessions with various wait events');

  const intensityConfig = {
    low: {
      complexJoin: 90000,        // Every 90s
      analytical: 100000,        // Every 100s
      hierarchical: 110000,      // Every 110s
      selfJoin: 120000,          // Every 120s
      timeSeries: 130000         // Every 130s
    },
    medium: {
      complexJoin: 60000,        // Every 60s
      analytical: 70000,         // Every 70s
      hierarchical: 80000,       // Every 80s
      selfJoin: 90000,           // Every 90s
      timeSeries: 100000         // Every 100s
    },
    high: {
      complexJoin: 45000,        // Every 45s
      analytical: 50000,         // Every 50s
      hierarchical: 55000,       // Every 55s
      selfJoin: 60000,           // Every 60s
      timeSeries: 65000          // Every 65s
    }
  };

  const config = intensityConfig[intensity] || intensityConfig.low;

  // Start periodic complex queries
  intervals.push(setInterval(() =>
    complexJoinQuery(pool, logger, 25).catch(err => logger.error('Complex join error:', err)),
    config.complexJoin
  ));

  intervals.push(setInterval(() =>
    analyticalAggregationQuery(pool, logger, 25).catch(err => logger.error('Analytical query error:', err)),
    config.analytical
  ));

  intervals.push(setInterval(() =>
    hierarchicalQuery(pool, logger, 20).catch(err => logger.error('Hierarchical query error:', err)),
    config.hierarchical
  ));

  intervals.push(setInterval(() =>
    selfJoinPatternQuery(pool, logger, 25).catch(err => logger.error('Self-join query error:', err)),
    config.selfJoin
  ));

  intervals.push(setInterval(() =>
    timeSeriesAnalysisQuery(pool, logger, 20).catch(err => logger.error('Time-series query error:', err)),
    config.timeSeries
  ));

  // Stop after duration
  setTimeout(() => stop(logger), duration * 1000);
}

function stop(logger) {
  if (!isRunning) return;

  logger.info('Stopping complex query workload...');

  intervals.forEach(interval => clearInterval(interval));
  intervals = [];

  isRunning = false;
  logger.info('Complex query workload stopped');
}

module.exports = { start, stop };
