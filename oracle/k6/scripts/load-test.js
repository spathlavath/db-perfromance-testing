/**
 * K6 Load Test for Oracle HR Portal - SELECT Queries Only
 * Tests realistic HR read operations across multiple endpoints with high concurrency
 * 
 * This generates diverse SELECT database span traces under stress:
 * - Simple SELECT queries
 * - SELECT with JOINs (single and multiple)
 * - SELECT with aggregation (GROUP BY, COUNT, AVG, SUM)
 * - SELECT with filtering (WHERE clauses)
 * - SELECT with date filters
 * - Complex queries with subqueries
 * 
 * NOTE: INSERT, UPDATE, DELETE operations are commented out for SELECT-only testing
 * 
 * Run with: k6 run load-test.js
 * Or via Docker Compose: docker-compose up k6
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const employeeListDuration = new Trend('employee_list_duration');
const employeeDetailDuration = new Trend('employee_detail_duration');
const departmentListDuration = new Trend('department_list_duration');
const salaryReportDuration = new Trend('salary_report_duration');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://oracle-test-app:3000';
const TEST_INTENSITY = __ENV.TEST_INTENSITY || 'medium';

// Intensity configuration profiles
const intensityProfiles = {
  low: {
    stages: [
      { duration: '2m', target: 10 },   // Warm up to 10 VUs
      { duration: '5m', target: 25 },   // Ramp up to 25 VUs
      { duration: '10m', target: 50 },  // Increase to 50 VUs
      { duration: '10m', target: 75 },  // Peak load at 75 VUs
      { duration: '5m', target: 100 },  // Maximum stress at 100 VUs
      { duration: '5m', target: 75 },   // Step down
      { duration: '3m', target: 0 },    // Cool down
    ],
    thinkTime: { min: 1, max: 2 },
    thresholds: {
      'http_req_duration': ['p(95)<2000', 'p(99)<3000'],
      'http_req_failed': ['rate<0.05'],
      'errors': ['rate<0.05'],
    },
  },
  medium: {
    stages: [
      { duration: '2m', target: 20 },   // Warm up to 20 VUs
      { duration: '5m', target: 50 },   // Ramp up to 50 VUs
      { duration: '10m', target: 100 }, // Increase to 100 VUs
      { duration: '10m', target: 150 }, // Peak load at 150 VUs
      { duration: '5m', target: 200 },  // Maximum stress at 200 VUs
      { duration: '5m', target: 150 },  // Step down
      { duration: '3m', target: 0 },    // Cool down
    ],
    thinkTime: { min: 0.5, max: 1 },
    thresholds: {
      'http_req_duration': ['p(95)<2500', 'p(99)<3500'],
      'http_req_failed': ['rate<0.05'],
      'errors': ['rate<0.05'],
    },
  },
  high: {
    stages: [
      { duration: '2m', target: 50 },   // Warm up to 50 VUs
      { duration: '5m', target: 150 },  // Ramp up to 150 VUs
      { duration: '10m', target: 300 }, // Increase to 300 VUs
      { duration: '10m', target: 400 }, // Peak load at 400 VUs
      { duration: '5m', target: 500 },  // Maximum stress at 500 VUs
      { duration: '5m', target: 400 },  // Step down
      { duration: '3m', target: 0 },    // Cool down
    ],
    thinkTime: { min: 0.2, max: 0.5 },
    thresholds: {
      'http_req_duration': ['p(95)<3000', 'p(99)<4000'],
      'http_req_failed': ['rate<0.05'],
      'errors': ['rate<0.05'],
    },
  },
  stress: {
    stages: [
      { duration: '2m', target: 100 },  // Warm up to 100 VUs
      { duration: '5m', target: 300 },  // Ramp up to 300 VUs
      { duration: '10m', target: 600 }, // Increase to 600 VUs
      { duration: '10m', target: 800 }, // Peak load at 800 VUs
      { duration: '5m', target: 1000 }, // Maximum stress at 1000 VUs
      { duration: '5m', target: 800 },  // Step down
      { duration: '3m', target: 0 },    // Cool down
    ],
    thinkTime: { min: 0.1, max: 0.3 },
    thresholds: {
      'http_req_duration': ['p(95)<4000', 'p(99)<5000'],
      'http_req_failed': ['rate<0.05'],
      'errors': ['rate<0.05'],
    },
  },
  max: {
    stages: [
      { duration: '2m', target: 200 },  // Warm up to 200 VUs
      { duration: '5m', target: 600 },  // Ramp up to 600 VUs
      { duration: '10m', target: 1200 }, // Increase to 1200 VUs
      { duration: '10m', target: 1600 }, // Peak load at 1600 VUs
      { duration: '5m', target: 2000 },  // Maximum stress at 2000 VUs
      { duration: '5m', target: 1600 },  // Step down
      { duration: '3m', target: 0 },     // Cool down
    ],
    thinkTime: { min: 0.05, max: 0.2 },
    thresholds: {
      'http_req_duration': ['p(95)<6000', 'p(99)<8000'],
      'http_req_failed': ['rate<0.10'],
      'errors': ['rate<0.10'],
    },
  },
};

// Get current profile
const profile = intensityProfiles[TEST_INTENSITY] || intensityProfiles.medium;

// Build options based on profile
export const options = {
  scenarios: {
    hr_portal_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: profile.stages,
      gracefulRampDown: '30s',
    },
  },
  thresholds: profile.thresholds,
};

// Sample data for creating employees
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEmail(firstName, lastName) {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`;
}

export default function() {
  const scenario = Math.random();
  
  // 1. List Employees (25% of requests) - SELECT with JOIN
  if (scenario < 0.25) {
    const res = http.get(`${BASE_URL}/employees`);
    employeeListDuration.add(res.timings.duration);
    check(res, {
      'employee list status 200': (r) => r.status === 200,
      'employee list has data': (r) => {
        if (!r.body || r.status !== 200) return false;
        try {
          const data = JSON.parse(r.body);
          return data.employees && data.employees.length > 0;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);
  }
  
  // 2. Get Employee Details (25% of requests) - SELECT with multiple JOINs
  else if (scenario < 0.50) {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}`);
    employeeDetailDuration.add(res.timings.duration);
    check(res, {
      'employee detail status in [200,404]': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  }
  
  // 3. List Departments with Stats (20% of requests) - SELECT with aggregation
  else if (scenario < 0.70) {
    const res = http.get(`${BASE_URL}/departments`);
    departmentListDuration.add(res.timings.duration);
    check(res, {
      'department list status 200': (r) => r.status === 200,
      'departments have stats': (r) => {
        if (!r.body || r.status !== 200) return false;
        try {
          const data = JSON.parse(r.body);
          return data.departments && data.departments.length > 0;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);
  }
  
  // 4. Get Department Employees (15% of requests) - SELECT with filter
  else if (scenario < 0.85) {
    const deptId = (Math.floor(Math.random() * 11) + 1) * 10;
    const res = http.get(`${BASE_URL}/departments/${deptId}/employees`);
    check(res, {
      'dept employees status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 5. Salary Report (10% of requests) - Complex aggregation with GROUP BY
  else if (scenario < 0.95) {
    const res = http.get(`${BASE_URL}/reports/salary-by-department`);
    salaryReportDuration.add(res.timings.duration);
    check(res, {
      'salary report status 200': (r) => r.status === 200,
      'report has data': (r) => {
        if (!r.body || r.status !== 200) return false;
        try {
          const data = JSON.parse(r.body);
          return data.report && data.report.length > 0;
        } catch (e) {
          return false;
        }
      },
    }) || errorRate.add(1);
  }
  
  // 6. Get Employee Job History (5% of requests) - SELECT with date filter
  else {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}/history`);
    check(res, {
      'job history status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // COMMENTED OUT - Transaction operation (not testing write operations)
  // else {
  //   const employeeId = Math.floor(Math.random() * 107) + 100;
  //   const payload = JSON.stringify({
  //     new_job_id: 'IT_PROG',
  //     new_salary: Math.floor(Math.random() * 50000) + 80000,
  //     new_department_id: 90
  //   });
  //   const params = { headers: { 'Content-Type': 'application/json' } };
  //   const res = http.post(`${BASE_URL}/employees/${employeeId}/promote`, payload, params);
  //   check(res, {
  //     'promotion status in [200,404,500]': (r) => [200, 404, 500].includes(r.status),
  //   }) || errorRate.add(1);
  // }
  
  // Random sleep based on intensity profile
  const thinkTime = profile.thinkTime;
  sleep(Math.random() * (thinkTime.max - thinkTime.min) + thinkTime.min);
}

export function handleSummary(data) {
  const metrics = data.metrics;
  
  // Calculate key statistics
  const totalRequests = metrics.http_reqs.values.count;
  const failedRequests = metrics.http_req_failed.values.passes;
  const successRate = ((totalRequests - failedRequests) / totalRequests * 100).toFixed(2);
  const avgDuration = (metrics.http_req_duration.values.avg / 1000).toFixed(2);
  const p95Duration = (metrics.http_req_duration.values['p(95)'] / 1000).toFixed(2);
  // p(99) - use p(90) as fallback if p(99) not available
  const p99Value = metrics.http_req_duration.values['p(99)'] || metrics.http_req_duration.values['p(90)'];
  const p99Duration = p99Value ? (p99Value / 1000).toFixed(2) : 'N/A';
  const reqPerSec = metrics.http_reqs.values.rate.toFixed(2);
  const testDuration = (data.state.testRunDurationMs / 1000 / 60).toFixed(1);
  const maxVUs = metrics.vus_max.values.max;
  const totalIterations = metrics.iterations.values.count;
  
  // Calculate checks pass rate
  const checksRate = (metrics.checks.values.rate * 100).toFixed(2);
  const checksPassed = metrics.checks.values.passes;
  const checksFailed = metrics.checks.values.fails;
  
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 K6 LOAD TEST RESULTS SUMMARY                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🎯 Test Configuration:`);
  console.log(`   Intensity Level: ${TEST_INTENSITY.toUpperCase()}`);
  console.log(`   Test Duration:   ${testDuration} minutes`);
  console.log(`   Max Virtual Users: ${maxVUs}`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📈 PERFORMANCE METRICS:`);
  console.log('');
  console.log(`   Total Requests:      ${totalRequests.toLocaleString()}`);
  console.log(`   Requests/Second:     ${reqPerSec}/s`);
  console.log(`   Total Iterations:    ${totalIterations.toLocaleString()}`);
  console.log('');
  console.log(`   ✅ Successful:        ${(totalRequests - failedRequests).toLocaleString()} (${successRate}%)`);
  console.log(`   ❌ Failed:            ${failedRequests.toLocaleString()} (${(100 - successRate).toFixed(2)}%)`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`⏱️  RESPONSE TIME METRICS:`);
  console.log('');
  console.log(`   Average Response:    ${avgDuration}s`);
  console.log(`   Median Response:     ${(metrics.http_req_duration.values.med / 1000).toFixed(2)}s`);
  console.log(`   p(95):               ${p95Duration}s`);
  console.log(`   p(99):               ${p99Duration}s`);
  console.log(`   Min Response:        ${(metrics.http_req_duration.values.min / 1000).toFixed(2)}s`);
  console.log(`   Max Response:        ${(metrics.http_req_duration.values.max / 1000).toFixed(2)}s`);
  console.log('');
  
  // Performance verdict
  const p95Threshold = profile.thresholds['http_req_duration'][0].match(/\d+/)[0];
  const p95Value = metrics.http_req_duration.values['p(95)'] || 0;
  const p95Pass = p95Value < p95Threshold;
  
  console.log('═'.repeat(80));
  console.log('');
  console.log(`🎯 TEST CHECKS (Validation Tests):`);
  console.log('');
  console.log(`   Total Checks:        ${checksPassed + checksFailed}`);
  console.log(`   ✅ Passed:            ${checksPassed} (${checksRate}%)`);
  console.log(`   ❌ Failed:            ${checksFailed} (${(100 - checksRate).toFixed(2)}%)`);
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`🎭 OVERALL TEST RESULT:`);
  console.log('');
  
  // Safely check thresholds
  const durationThreshold = metrics.http_req_duration.thresholds && metrics.http_req_duration.thresholds[`p(95)<${p95Threshold}`];
  const failedThreshold = metrics.http_req_failed.thresholds && metrics.http_req_failed.thresholds['rate<0.15'];
  const errorsThreshold = metrics.errors.thresholds && metrics.errors.thresholds['rate<0.2'];
  
  const allThresholdsPassed = 
    (durationThreshold ? durationThreshold.ok : false) &&
    (failedThreshold ? failedThreshold.ok : false) &&
    (errorsThreshold ? errorsThreshold.ok : false);
  
  if (allThresholdsPassed) {
    console.log(`   🎉 SUCCESS! All performance thresholds met.`);
  } else {
    console.log(`   ⚠️  THRESHOLDS NOT MET - System under stress`);
    console.log('');
    console.log(`   Threshold Status:`);
    console.log(`   - Response Time (p95 < ${p95Threshold/1000}s):  ${p95Pass ? '✅ PASS' : '❌ FAIL'} (actual: ${p95Duration}s)`);
    console.log(`   - Error Rate (< 15%):          ${failedThreshold && failedThreshold.ok ? '✅ PASS' : '❌ FAIL'} (actual: ${(100 - successRate).toFixed(2)}%)`);
    console.log(`   - Check Success (> 80%):       ${errorsThreshold && errorsThreshold.ok ? '✅ PASS' : '❌ FAIL'} (actual: ${checksRate}%)`);
  }
  
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`💡 RECOMMENDATIONS:`);
  console.log('');
  
  if (parseFloat(successRate) < 90) {
    console.log(`   ⚠️  High failure rate detected (${(100 - successRate).toFixed(2)}%):`);
    console.log(`      • Consider increasing database connection pool size`);
    console.log(`      • Check application and database logs for errors`);
    console.log(`      • May need to scale resources or optimize queries`);
  } else if (parseFloat(p95Duration) > p95Threshold / 1000) {
    console.log(`   ⚠️  Response times exceed threshold:`);
    console.log(`      • Review slow queries in application logs`);
    console.log(`      • Consider adding database indexes`);
    console.log(`      • Check for resource bottlenecks (CPU/Memory)`);
  } else {
    console.log(`   ✅ System performing well at ${TEST_INTENSITY.toUpperCase()} intensity!`);
    console.log(`      • Success rate: ${successRate}%`);
    console.log(`      • Response times within acceptable range`);
    console.log(`      • Consider testing higher intensity if needed`);
  }
  
  console.log('');
  console.log('═'.repeat(80));
  console.log('');
  console.log(`📋 DATABASE SELECT OPERATIONS TESTED:`);
  console.log('');
  console.log(`   ✓ SELECT with JOIN (employee list) - 25%`);
  console.log(`   ✓ SELECT with multiple JOINs (employee details) - 25%`);
  console.log(`   ✓ SELECT with aggregation & COUNT (department stats) - 20%`);
  console.log(`   ✓ SELECT with WHERE filter (department employees) - 15%`);
  console.log(`   ✓ Complex SELECT with GROUP BY & SUM/AVG (salary report) - 10%`);
  console.log(`   ✓ SELECT with date filter & JOIN (job history) - 5%`);
  console.log('');
  console.log(`   ℹ️  Note: INSERT, UPDATE, DELETE operations are commented out`);
  console.log(`   📊 Total: 6 different SELECT query patterns (all existing endpoints)`);
  console.log('');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Return empty object to suppress default JSON output
  return {
    'stdout': '', // This suppresses the verbose JSON output
  };
}
