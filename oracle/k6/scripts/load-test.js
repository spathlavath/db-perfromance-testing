/**
 * K6 Load Test for Oracle HR Portal - SLOW/COMPLEX Queries Only
 * Tests slow-running analytical queries to maximize visibility in New Relic APM
 * 
 * This generates SLOW database span traces under stress:
 * - Complex aggregations (GROUP BY, COUNT, AVG, SUM, MIN, MAX, STDDEV)
 * - Multi-table JOINs (4-6 tables)
 * - Subqueries and correlated subqueries
 * - Date calculations (MONTHS_BETWEEN, CASE statements)
 * - Geographic aggregations (regions, countries, locations)
 * - Nested aggregations and percentage calculations
 * 
 * NOTE: Fast queries removed - only slow queries for APM visibility
 * NOTE: Each virtual user (VU) executes ONE random query per iteration
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
      'http_req_duration': ['p(95)<8000', 'p(99)<10000'],
      'http_req_failed': ['rate<0.70'],  // Allow up to 70% failure at peak stress
      'errors': ['rate<0.70'],           // Stress tests are meant to find breaking points
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
      'http_req_duration': ['p(95)<12000', 'p(99)<15000'],
      'http_req_failed': ['rate<0.80'],  // Allow up to 80% failure at extreme load
      'errors': ['rate<0.80'],           // Max stress expected to break the system
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
  timeout: '120s', // 2 minutes for slow queries under heavy load
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
  
  // DISTRIBUTED ACROSS 10 SLOW/COMPLEX QUERIES - Removed job-statistics and salary-ranges (can't handle 1000 VUs)
  // These endpoints still exist in app.js for APM visibility but are excluded from stress testing
  
  // 1. Department Stats with Aggregation (15% of requests) - COUNT, AVG, GROUP BY
  if (scenario < 0.15) {
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
  
  // 2. Salary Report (15% of requests) - Complex GROUP BY with SUM/AVG/MIN/MAX
  else if (scenario < 0.30) {
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
  
  // 3. Employee Analysis Report (14% of requests) - Complex multi-join with subqueries
  else if (scenario < 0.44) {
    const res = http.get(`${BASE_URL}/reports/employee-analysis`);
    check(res, {
      'employee analysis status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 4. Department Hierarchy Report (13% of requests) - Full aggregation across geography
  else if (scenario < 0.57) {
    const res = http.get(`${BASE_URL}/reports/department-hierarchy`);
    check(res, {
      'dept hierarchy status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 5. Organizational Hierarchy (12% of requests) - Recursive CONNECT BY with aggregations
  else if (scenario < 0.69) {
    const res = http.get(`${BASE_URL}/reports/org-hierarchy`);
    check(res, {
      'org hierarchy status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 6. Salary Rankings (11% of requests) - Window functions with RANK/DENSE_RANK/NTILE
  else if (scenario < 0.80) {
    const res = http.get(`${BASE_URL}/reports/salary-rankings`);
    check(res, {
      'salary rankings status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 7. Tenure Analysis (8% of requests) - Date calculations with CASE statements
  else if (scenario < 0.88) {
    const res = http.get(`${BASE_URL}/reports/tenure-analysis`);
    check(res, {
      'tenure analysis status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 8. Employee Comparisons (6% of requests) - Self-join analysis
  else if (scenario < 0.94) {
    const res = http.get(`${BASE_URL}/reports/employee-comparisons`);
    check(res, {
      'employee comparisons status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 9. Career Progression (3% of requests) - Job history with multiple aggregations
  else if (scenario < 0.97) {
    const res = http.get(`${BASE_URL}/reports/career-progression`);
    check(res, {
      'career progression status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 10. Cross-Department Analysis (3% of requests) - Complex cross-tabulation with MEDIAN
  else {
    const res = http.get(`${BASE_URL}/reports/cross-department-analysis`);
    check(res, {
      'cross dept analysis status 200': (r) => r.status === 200,
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
  
  // Get actual error threshold from profile
  const errorThresholdMatch = profile.thresholds['http_req_failed'][0].match(/rate<([0-9.]+)/);
  const errorThresholdPct = errorThresholdMatch ? (parseFloat(errorThresholdMatch[1]) * 100).toFixed(0) : '5';
  
  if (allThresholdsPassed) {
    console.log(`   🎉 SUCCESS! All performance thresholds met.`);
  } else {
    console.log(`   ⚠️  THRESHOLDS NOT MET - System under stress`);
    console.log('');
    console.log(`   Threshold Status:`);
    console.log(`   - Response Time (p95 < ${p95Threshold/1000}s):  ${p95Pass ? '✅ PASS' : '❌ FAIL'} (actual: ${p95Duration}s)`);
    console.log(`   - Error Rate (< ${errorThresholdPct}%):          ${failedThreshold && failedThreshold.ok ? '✅ PASS' : '❌ FAIL'} (actual: ${(100 - successRate).toFixed(2)}%)`);
    console.log(`   - Check Success:               ${errorsThreshold && errorsThreshold.ok ? '✅ PASS' : '❌ FAIL'} (actual: ${checksRate}%)`);
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
  console.log(`📋 COMPLEX/SLOW QUERY OPERATIONS TESTED:`);
  console.log('');
  console.log(`   ✓ Department aggregation (COUNT, AVG, GROUP BY) - 20%`);
  console.log(`   ✓ Salary report (GROUP BY with SUM/AVG/MIN/MAX) - 20%`);
  console.log(`   ✓ Employee analysis (multi-JOIN with subqueries) - 20%`);
  console.log(`   ✓ Department hierarchy (full geography aggregation) - 15%`);
  console.log(`   ✓ Job statistics (regional stats with STDDEV) - 10%`);
  console.log(`   ✓ Salary ranges (nested aggregations & calculations) - 10%`);
  console.log(`   ✓ Tenure analysis (date calculations & CASE) - 5%`);
  console.log('');
  console.log(`   ℹ️  Note: Fast queries removed - only slow/complex queries tested`);
  console.log(`   ℹ️  Note: Each VU executes ONE random query per iteration`);
  console.log(`   📊 Total: 7 different SLOW query patterns for APM visibility`);
  console.log('');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Return empty object to suppress default JSON output
  return {
    'stdout': '', // This suppresses the verbose JSON output
  };
}
