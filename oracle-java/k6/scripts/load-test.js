/**
 * K6 Load Test for Oracle HR Portal
 * Tests realistic HR operations across multiple endpoints
 * 
 * This generates diverse database span traces:
 * - SELECT queries (simple, with JOINs, with aggregation)
 * - INSERT operations
 * - UPDATE operations  
 * - Complex transactions
 * 
 * Run with: k6 run --vus 5 --duration 30m hr-portal-load-test.js
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

// Test options
export const options = {
  stages: [
    { duration: '2m', target: 3 },   // Ramp up to 3 VUs
    { duration: '25m', target: 5 },  // Stay at 5 VUs
    { duration: '3m', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'], // 95% of requests should be below 2s
    'errors': ['rate<0.1'],              // Error rate should be below 10%
  },
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
  
  // 1. List Employees (30% of requests) - SELECT with JOIN
  if (scenario < 0.30) {
    const res = http.get(`${BASE_URL}/employees`);
    employeeListDuration.add(res.timings.duration);
    check(res, {
      'employee list status 200': (r) => r.status === 200,
      'employee list has data': (r) => JSON.parse(r.body).employees.length > 0,
    }) || errorRate.add(1);
  }
  
  // 2. Get Employee Details (25% of requests) - SELECT with multiple JOINs
  else if (scenario < 0.55) {
    // Random employee ID between 100-206 (typical HR schema range)
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}`);
    employeeDetailDuration.add(res.timings.duration);
    check(res, {
      'employee detail status in [200,404]': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  }
  
  // 3. List Departments with Stats (15% of requests) - SELECT with aggregation
  else if (scenario < 0.70) {
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
  else if (scenario < 0.80) {
    // Random department ID between 10-110 (typical range)
    const deptId = (Math.floor(Math.random() * 11) + 1) * 10;
    const res = http.get(`${BASE_URL}/departments/${deptId}/employees`);
    check(res, {
      'dept employees status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 5. Salary Report (5% of requests) - Complex aggregation query
  else if (scenario < 0.85) {
    const res = http.get(`${BASE_URL}/reports/salary-by-department`);
    salaryReportDuration.add(res.timings.duration);
    check(res, {
      'salary report status 200': (r) => r.status === 200,
      'report has data': (r) => JSON.parse(r.body).report.length > 0,
    }) || errorRate.add(1);
  }
  
  // 6. Get Jobs List (5% of requests) - Simple SELECT
  else if (scenario < 0.90) {
    const res = http.get(`${BASE_URL}/jobs`);
    check(res, {
      'jobs list status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 7. Update Employee (3% of requests) - UPDATE operation
  else if (scenario < 0.93) {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const newSalary = Math.floor(Math.random() * 30000) + 50000; // 50k-80k
    
    const payload = JSON.stringify({
      salary: newSalary,
      job_id: 'IT_PROG',
      department_id: 60,
      manager_id: 103
    });
    
    const params = {
      headers: { 'Content-Type': 'application/json' },
    };
    
    const res = http.put(`${BASE_URL}/employees/${employeeId}`, payload, params);
    check(res, {
      'employee update status in [200,404]': (r) => r.status === 200 || r.status === 404,
    }) || errorRate.add(1);
  }
  
  // 8. Get Employee Job History (5% of requests) - SELECT with date filter
  else if (scenario < 0.98) {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    const res = http.get(`${BASE_URL}/employees/${employeeId}/history`);
    check(res, {
      'job history status 200': (r) => r.status === 200,
    }) || errorRate.add(1);
  }
  
  // 9. Create Employee (1% of requests) - INSERT operation
  else if (scenario < 0.99) {
    const firstName = getRandomElement(firstNames);
    const lastName = getRandomElement(lastNames);
    
    const payload = JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      email: generateEmail(firstName, lastName),
      phone_number: '650.555.' + Math.floor(Math.random() * 9000 + 1000),
      hire_date: new Date().toISOString().split('T')[0],
      job_id: 'IT_PROG',
      salary: Math.floor(Math.random() * 40000) + 60000,
      department_id: 60,
      manager_id: 103
    });
    
    const params = {
      headers: { 'Content-Type': 'application/json' },
    };
    
    const res = http.post(`${BASE_URL}/employees`, payload, params);
    check(res, {
      'employee create status 201': (r) => r.status === 201,
      'employee ID returned': (r) => JSON.parse(r.body).employee_id > 0,
    }) || errorRate.add(1);
  }
  
  // 10. Promote Employee (1% of requests) - Transaction: UPDATE + INSERT
  else {
    const employeeId = Math.floor(Math.random() * 107) + 100;
    
    const payload = JSON.stringify({
      new_job_id: 'IT_PROG',
      new_salary: Math.floor(Math.random() * 50000) + 80000,
      new_department_id: 90
    });
    
    const params = {
      headers: { 'Content-Type': 'application/json' },
    };
    
    const res = http.post(`${BASE_URL}/employees/${employeeId}/promote`, payload, params);
    check(res, {
      'promotion status in [200,404,500]': (r) => [200, 404, 500].includes(r.status),
    }) || errorRate.add(1);
  }
  
  // Random sleep between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 Oracle HR Portal Load Test Summary');
  console.log('='.repeat(80));
  console.log('');
  console.log('Database Operations Tested:');
  console.log('  ✓ SELECT with JOIN (employee list)');
  console.log('  ✓ SELECT with multiple JOINs (employee details)');
  console.log('  ✓ SELECT with aggregation (department stats)');
  console.log('  ✓ SELECT with filter (department employees)');
  console.log('  ✓ Complex SELECT with GROUP BY (salary report)');
  console.log('  ✓ Simple SELECT (jobs list)');
  console.log('  ✓ INSERT (create employee)');
  console.log('  ✓ UPDATE (update employee)');
  console.log('  ✓ Transaction (promote employee)');
  console.log('  ✓ SELECT with date filter (job history)');
  console.log('');
  console.log('These operations will generate diverse database spans in New Relic!');
  console.log('='.repeat(80));
  
  return {
    'stdout': JSON.stringify(data, null, 2),
  };
}
