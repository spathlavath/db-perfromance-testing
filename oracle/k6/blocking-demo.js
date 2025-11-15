/**
 * K6 Load Test Script: Blocking Queries Demo
 * 
 * This script tests the blocking query scenarios via HTTP API
 * 
 * Usage:
 *   k6 run blocking-demo.js
 * 
 * Options:
 *   k6 run --duration 2m blocking-demo.js
 *   k6 run --vus 5 blocking-demo.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const blockingScenarios = new Counter('blocking_scenarios_triggered');
const blockingDuration = new Trend('blocking_duration_ms');
const blockedQueries = new Counter('blocked_queries_count');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 1 },  // Warm up
    { duration: '2m', target: 2 },   // Run with 2 VUs
    { duration: '30s', target: 0 },  // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<10000'], // 95% of requests should complete in 10s
    http_req_failed: ['rate<0.1'],      // Less than 10% failures
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

/**
 * Trigger blocking scenario via API
 */
export default function() {
  // Test 1: Trigger basic blocking scenario
  const blockingTest1 = http.post(
    `${BASE_URL}/workload/start`,
    JSON.stringify({
      type: 'blocking',
      duration: 60,
      intensity: 'low'
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'StartBlockingWorkload' }
    }
  );

  check(blockingTest1, {
    'blocking workload started': (r) => r.status === 200,
    'response has message': (r) => r.json('message') !== undefined,
  });

  if (blockingTest1.status === 200) {
    blockingScenarios.add(1);
  }

  sleep(5);

  // Test 2: Query employees (might be blocked)
  const queryStart = Date.now();
  const employeeQuery = http.get(
    `${BASE_URL}/employees?department_id=60`,
    {
      tags: { name: 'QueryEmployees' }
    }
  );

  const queryDuration = Date.now() - queryStart;
  blockingDuration.add(queryDuration);

  check(employeeQuery, {
    'employee query succeeded': (r) => r.status === 200,
    'query returned data': (r) => r.json().length > 0,
    'query completed within 10s': (r) => queryDuration < 10000,
  });

  if (queryDuration > 3000) {
    blockedQueries.add(1);
    console.log(`⚠️  Slow query detected: ${queryDuration}ms (possibly blocked)`);
  }

  sleep(10);

  // Test 3: Update employee salary (might cause blocking)
  const updateStart = Date.now();
  const salaryUpdate = http.put(
    `${BASE_URL}/employees/100`,
    JSON.stringify({
      salary: 25000,
      job_id: 'AD_PRES',
      department_id: 90,
      manager_id: null
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'UpdateEmployee' }
    }
  );

  const updateDuration = Date.now() - updateStart;

  check(salaryUpdate, {
    'salary update succeeded': (r) => r.status === 200 || r.status === 404,
    'update completed': (r) => updateDuration < 5000,
  });

  sleep(5);

  // Test 4: Complex report query (might be blocked)
  const reportStart = Date.now();
  const reportQuery = http.get(
    `${BASE_URL}/reports/compensation`,
    {
      tags: { name: 'CompensationReport' }
    }
  );

  const reportDuration = Date.now() - reportStart;
  blockingDuration.add(reportDuration);

  check(reportQuery, {
    'report query succeeded': (r) => r.status === 200,
    'report has data': (r) => r.json().length > 0,
  });

  if (reportDuration > 5000) {
    blockedQueries.add(1);
    console.log(`⚠️  Slow report detected: ${reportDuration}ms (possibly blocked)`);
  }

  sleep(10);
}

/**
 * Setup function - runs once before test
 */
export function setup() {
  console.log('🎬 Starting Blocking Queries Demo Test');
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Duration: ${options.stages[1].duration}`);
  console.log('');

  // Verify server is up
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Server is not responding');
  }

  console.log('✅ Server is ready');
  return { baseUrl: BASE_URL };
}

/**
 * Teardown function - runs once after test
 */
export function teardown(data) {
  console.log('');
  console.log('🏁 Test completed');
  
  // Stop all workloads
  http.post(`${data.baseUrl}/workload/stop`);
  console.log('✅ Workloads stopped');
}

/**
 * Handle summary - custom summary output
 */
export function handleSummary(data) {
  console.log('');
  console.log('📊 BLOCKING QUERIES TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const blockingCount = data.metrics.blocking_scenarios_triggered?.values?.count || 0;
  const blockedCount = data.metrics.blocked_queries_count?.values?.count || 0;
  const avgDuration = data.metrics.blocking_duration_ms?.values?.avg || 0;
  const maxDuration = data.metrics.blocking_duration_ms?.values?.max || 0;
  
  console.log(`Blocking scenarios triggered: ${blockingCount}`);
  console.log(`Blocked queries detected: ${blockedCount}`);
  console.log(`Average query duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`Maximum query duration: ${maxDuration.toFixed(2)}ms`);
  console.log('═'.repeat(60));
  
  // Return summary for file output
  return {
    'stdout': JSON.stringify(data, null, 2),
    'summary.json': JSON.stringify(data, null, 2),
  };
}
