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
    vus: 20,
    duration: '30m',
    thinkTime: { min: 3, max: 5 },
    thresholds: {
      'http_req_duration': ['p(95)<3000'],
      'http_req_failed': ['rate<0.05'],
      'errors': ['rate<0.05'],
    },
  },
  medium: {
    vus: 50,
    duration: '30m',
    thinkTime: { min: 1, max: 3 },
    thresholds: {
      'http_req_duration': ['p(95)<4000'],
      'http_req_failed': ['rate<0.10'],
      'errors': ['rate<0.10'],
    },
  },
  high: {
    vus: 120,
    duration: '30m',
    thinkTime: { min: 0.5, max: 2 },
    thresholds: {
      'http_req_duration': ['p(95)<5000'],
      'http_req_failed': ['rate<0.12'],
      'errors': ['rate<0.12'],
    },
  },
  stress: {
    stages: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '10m', target: 200 },
      { duration: '10m', target: 300 },
      { duration: '5m', target: 400 },
      { duration: '3m', target: 0 },
    ],
    thinkTime: { min: 0.1, max: 0.5 },
    thresholds: {
      'http_req_duration': ['p(95)<8000'],
      'http_req_failed': ['rate<0.20'],
      'errors': ['rate<0.25'],
    },
  },
  max: {
    stages: [
      { duration: '1m', target: 100 },
      { duration: '5m', target: 300 },
      { duration: '5m', target: 500 },
      { duration: '2m', target: 0 },
    ],
    thinkTime: { min: 0, max: 0 },
    thresholds: {
      'http_req_duration': ['p(95)<10000'],
      'http_req_failed': ['rate<0.30'],
      'errors': ['rate<0.30'],
    },
  },
};

// Get current profile
const profile = intensityProfiles[TEST_INTENSITY] || intensityProfiles.medium;

// Build options based on profile
export const options = {
  scenarios: {
    hr_portal_test: {
      executor: profile.stages ? 'ramping-vus' : 'constant-vus',
      ...(profile.stages ? { 
        startVUs: 0, 
        stages: profile.stages,
        gracefulRampDown: '30s',
      } : {
        vus: profile.vus,
        duration: profile.duration,
      }),
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
  
  // 1. List Employees (18% of requests) - SELECT with JOIN
  if (scenario < 0.18) {
    const res = http.get(`${BASE_URL}/employees`);
    employeeListDuration.add(res.timings.duration);
    check(res, {
      'employee list status 200': (r) => r.status === 200,
      'employee list has data': (r) => JSON.parse(r.body).employees.length > 0,
    }) || errorRate.add(1);
  }
  
  // 2. Get Employee Details (15% of requests) - SELECT with multiple JOINs
  else if (scenario < 0.33) {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}`);
    employeeDetailDuration.add(res.timings.duration);
    check(res, {
      'employee detail status in [200,404]': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  }
  
  // 3. List Departments with Stats (12% of requests) - SELECT with aggregation
  else if (scenario < 0.45) {
    const res = http.get(`${BASE_URL}/departments`);
    departmentListDuration.add(res.timings.duration);
    check(res, {
      'department list status 200': (r) => r.status === 200,
      'departments have stats': (r) => {
        const data = JSON.parse(r.body);
        return data.departments && data.departments.length > 0;
      },
    }) || errorRate.add(1);
  }
  
  // 4. Get Department Employees (10% of requests) - SELECT with filter
  else if (scenario < 0.55) {
    const deptId = (Math.floor(Math.random() * 11) + 1) * 10;
    const res = http.get(`${BASE_URL}/departments/${deptId}/employees`);
    check(res, {
      'dept employees status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 5. Salary Report (8% of requests) - Complex aggregation with GROUP BY
  else if (scenario < 0.63) {
    const res = http.get(`${BASE_URL}/reports/salary-by-department`);
    salaryReportDuration.add(res.timings.duration);
    check(res, {
      'salary report status 200': (r) => r.status === 200,
      'report has data': (r) => JSON.parse(r.body).report.length > 0,
    }) || errorRate.add(1);
  }
  
  // 6. Employee Rankings (7% of requests) - SELECT with window functions (ROW_NUMBER, RANK)
  else if (scenario < 0.70) {
    const deptId = (Math.floor(Math.random() * 11) + 1) * 10;
    const res = http.get(`${BASE_URL}/employees/rankings?department_id=${deptId}`);
    check(res, {
      'employee rankings status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 7. Top Earners Analysis (7% of requests) - Complex query with DISTINCT, ORDER BY, and LIMIT
  else if (scenario < 0.77) {
    const limit = Math.floor(Math.random() * 20) + 10; // 10-30 top earners
    const res = http.get(`${BASE_URL}/reports/top-earners?limit=${limit}`);
    check(res, {
      'top earners status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 8. Department Performance Metrics (6% of requests) - Complex analytical query with multiple aggregations
  else if (scenario < 0.83) {
    const res = http.get(`${BASE_URL}/reports/department-performance`);
    check(res, {
      'dept performance status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 9. Employee Search with Subquery (5% of requests) - SELECT with IN clause and nested subquery
  else if (scenario < 0.88) {
    const minSalary = Math.floor(Math.random() * 50000) + 40000;
    const res = http.get(`${BASE_URL}/employees/search/high-earners?min_salary=${minSalary}`);
    check(res, {
      'high earners search status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 10. Location-based Employee Analysis (4% of requests) - SELECT with multiple JOINs and CASE statements
  else if (scenario < 0.92) {
    const countries = ['US', 'UK', 'CA', 'DE', 'JP', 'CN', 'AU', 'FR', 'IT', 'BR'];
    const countryId = getRandomElement(countries);
    const res = http.get(`${BASE_URL}/reports/employees-by-location?country=${countryId}`);
    check(res, {
      'location analysis status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 11. Job History Analytics (3% of requests) - Complex time-series query with date filters
  else if (scenario < 0.95) {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}/history`);
    check(res, {
      'job history status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 12. Salary Distribution Report (2% of requests) - SELECT with HAVING, GROUP BY, and aggregate functions
  else if (scenario < 0.97) {
    const res = http.get(`${BASE_URL}/reports/salary-distribution`);
    check(res, {
      'salary distribution status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 13. Cross-Departmental Analysis (2% of requests) - SELECT with UNION and complex joins
  else if (scenario < 0.99) {
    const res = http.get(`${BASE_URL}/reports/cross-department-analysis`);
    check(res, {
      'cross-dept analysis status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 14. Department Hierarchy with Analytics (1% of requests) - Recursive CTE with aggregations
  else {
    const res = http.get(`${BASE_URL}/departments/hierarchy`);
    check(res, {
      'department hierarchy status 200': (r) => r.status === 200,
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
  const p95Duration = (metrics.http_req_duration.values.p95 / 1000).toFixed(2);
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
  console.log(`   95th Percentile:     ${p95Duration}s`);
  console.log(`   Min Response:        ${(metrics.http_req_duration.values.min / 1000).toFixed(2)}s`);
  console.log(`   Max Response:        ${(metrics.http_req_duration.values.max / 1000).toFixed(2)}s`);
  console.log('');
  
  // Performance verdict
  const p95Threshold = profile.thresholds['http_req_duration'][0].match(/\d+/)[0];
  const p95Pass = metrics.http_req_duration.values.p95 < p95Threshold;
  
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
  
  const allThresholdsPassed = 
    metrics.http_req_duration.thresholds[`p(95)<${p95Threshold}`].ok &&
    metrics.http_req_failed.thresholds['rate<0.15'].ok &&
    metrics.errors.thresholds['rate<0.2'].ok;
  
  if (allThresholdsPassed) {
    console.log(`   🎉 SUCCESS! All performance thresholds met.`);
  } else {
    console.log(`   ⚠️  THRESHOLDS NOT MET - System under stress`);
    console.log('');
    console.log(`   Threshold Status:`);
    console.log(`   - Response Time (p95 < ${p95Threshold/1000}s):  ${p95Pass ? '✅ PASS' : '❌ FAIL'} (actual: ${p95Duration}s)`);
    console.log(`   - Error Rate (< 15%):          ${metrics.http_req_failed.thresholds['rate<0.15'].ok ? '✅ PASS' : '❌ FAIL'} (actual: ${(100 - successRate).toFixed(2)}%)`);
    console.log(`   - Check Success (> 80%):       ${metrics.errors.thresholds['rate<0.2'].ok ? '✅ PASS' : '❌ FAIL'} (actual: ${checksRate}%)`);
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
  console.log(`📋 COMPLEX SELECT OPERATIONS TESTED:`);
  console.log('');
  console.log(`   Basic Queries (45%):`);
  console.log(`     ✓ SELECT with JOIN (employee list) - 18%`);
  console.log(`     ✓ SELECT with multiple JOINs (employee details) - 15%`);
  console.log(`     ✓ SELECT with aggregation (department stats) - 12%`);
  console.log('');
  console.log(`   Intermediate Queries (28%):`);
  console.log(`     ✓ SELECT with filter (department employees) - 10%`);
  console.log(`     ✓ Complex aggregation with GROUP BY (salary report) - 8%`);
  console.log(`     ✓ Window functions with ROW_NUMBER/RANK (rankings) - 7%`);
  console.log(`     ✓ DISTINCT with ORDER BY and LIMIT (top earners) - 7%`);
  console.log('');
  console.log(`   Advanced Queries (27%):`);
  console.log(`     ✓ Multiple aggregations & analytics (dept performance) - 6%`);
  console.log(`     ✓ Nested subquery with IN clause (high earners search) - 5%`);
  console.log(`     ✓ Multi-JOIN with CASE statements (location analysis) - 4%`);
  console.log(`     ✓ Time-series with date filters (job history) - 3%`);
  console.log(`     ✓ HAVING with GROUP BY aggregates (salary distribution) - 2%`);
  console.log(`     ✓ UNION with complex joins (cross-dept analysis) - 2%`);
  console.log(`     ✓ Recursive CTE with aggregations (dept hierarchy) - 1%`);
  console.log('');
  console.log(`   ℹ️  Note: INSERT, UPDATE, DELETE operations are commented out`);
  console.log(`   📊 Total: 14 different complex SELECT query patterns`);
  console.log('');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Return empty object to suppress default JSON output
  return {
    'stdout': '', // This suppresses the verbose JSON output
  };
}
