/**
 * K6 Load Test - Oracle Metrics Stimulation - Stress Testing Edition
 * Stimulates all metrics collected by newrelicoraclereceiver under high load
 * 
 * This test generates intensive database operations to stress test:
 * - CPU usage (parsing, sorting, complex queries)
 * - Memory usage (large result sets, temp space)
 * - I/O operations (disk reads/writes)
 * - Lock contention and wait events
 * 
 * Stress Test Configuration:
 * - Peak load: 100 concurrent virtual users
 * - Duration: ~40 minutes total
 * - Mix of light and heavy operations
 * 
 * Usage:
 *   k6 run oracle-metrics.js
 *   API_URL=http://host:3000 k6 run oracle-metrics.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errorRate = new Rate('errors');
const parseCount = new Counter('parse_workload');
const diskIOCount = new Counter('disk_io_workload');
const sortCount = new Counter('sort_workload');

export const options = {
  scenarios: {
    // Metrics stress test - aggressive ramping to generate all metric types
    metrics_stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 15 },   // Quick ramp to 15 VUs
        { duration: '3m', target: 35 },   // Increase to 35 VUs
        { duration: '5m', target: 60 },   // Heavy load at 60 VUs
        { duration: '8m', target: 100 },  // Maximum stress at 100 VUs
        { duration: '5m', target: 80 },   // Sustain high load
        { duration: '3m', target: 40 },   // Step down
        { duration: '2m', target: 0 },    // Cool down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<30000'],  // Allow longer response times under stress
    http_req_failed: ['rate<0.3'],       // Allow up to 30% failures during peak stress
    errors: ['rate<0.4'],                // Higher error tolerance for stress test
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

function post(endpoint, params = {}) {
  const res = http.post(`${BASE_URL}${endpoint}`, JSON.stringify(params), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  const ok = check(res, { 'status 200': (r) => r.status === 200 });
  errorRate.add(!ok);
  return res;
}

function get(endpoint) {
  const res = http.get(`${BASE_URL}${endpoint}`);
  const ok = check(res, { 'status 200': (r) => r.status === 200 });
  errorRate.add(!ok);
  return res;
}

export function setup() {
  console.log('Health check...');
  const health = get('/health');
  if (health.status !== 200) throw new Error('API unhealthy');
  console.log('Starting Oracle metrics workload...');
}

export default function() {
  const workload = Math.floor(Math.random() * 24);
  
  switch (workload) {
    case 0:
      get('/employees');
      sleep(0.1);
      break;
      
    case 1:
      // Hard parse - intense
      post('/workload/parse', { iterations: 100, use_binds: false });
      parseCount.add(1);
      sleep(0.5);
      break;
      
    case 2:
      // Soft parse - intense
      post('/workload/parse', { iterations: 100, use_binds: true });
      parseCount.add(1);
      sleep(0.5);
      break;
      
    case 3:
      // Full scan - heavy I/O
      post('/workload/full-scan', { iterations: 10 });
      diskIOCount.add(1);
      sleep(0.5);
      break;
      
    case 4:
      // Small sorts - fast
      post('/workload/sort', { size: 'small' });
      sortCount.add(1);
      sleep(0.2);
      break;
      
    case 5:
      // Medium sorts
      post('/workload/sort', { size: 'medium' });
      sortCount.add(1);
      sleep(0.5);
      break;
      
    case 6:
      // Large sorts - heavy
      post('/workload/sort', { size: 'large' });
      sortCount.add(1);
      sleep(1);
      break;
      
    case 7:
      // Redo generation - intense
      post('/workload/redo', { operations: 100 });
      sleep(0.5);
      break;
      
    case 8:
      // Rollback activity
      post('/workload/rollback', { operations: 20 });
      sleep(0.5);
      break;
      
    case 9:
      // Cursor activity - fast
      post('/workload/cursor', { count: 50 });
      sleep(0.3);
      break;
      
    case 10:
      // Index scans - fast
      post('/workload/index-scan', { iterations: 50 });
      diskIOCount.add(1);
      sleep(0.3);
      break;
      
    case 11:
      // Physical I/O - heavy
      post('/workload/physical-io', { iterations: 20 });
      diskIOCount.add(1);
      sleep(0.5);
      break;
      
    case 12:
      // Recursive calls
      post('/workload/recursive', { depth: 4 });
      sleep(0.3);
      break;
      
    case 13:
      // Session workload - moderate
      post('/workload/session', { count: 5, duration: 1 });
      sleep(1.5);
      break;
      
    case 14:
      // Wait events - heavy
      post('/workload/wait');
      sleep(0.5);
      break;
      
    case 15:
      // Comprehensive mix - intense
      post('/workload/comprehensive', { intensity: 'high' });
      sleep(0.5);
      break;
      
    case 16:
      // Lock contention - moderate (don't overdo)
      post('/workload/lock', { duration: 2 });
      sleep(2.5);
      break;
      
    case 17:
      // PDB metrics - intense
      post('/workload/pdb', { operations: 50 });
      sleep(0.5);
      break;
      
    case 18:
      // Parallel execution - heavy
      post('/workload/parallel', { degree: 8 });
      sleep(0.5);
      break;
      
    case 19:
      // Network traffic - moderate
      post('/workload/network', { iterations: 30 });
      sleep(0.5);
      break;
      
    case 20:
      // Consistent read - heavy
      post('/workload/consistent-read', { iterations: 30 });
      sleep(1);
      break;
      
    case 21:
      // Block changes - intense
      post('/workload/block-change', { operations: 100 });
      sleep(0.5);
      break;
      
    case 22:
      // Enqueue operations
      post('/workload/enqueue', { iterations: 25 });
      sleep(0.5);
      break;
      
    case 23:
      // Mixed HR operations - fast
      get('/departments');
      sleep(0.05);
      get('/jobs');
      sleep(0.05);
      get('/reports/salary-by-department');
      sleep(0.1);
      break;
      
    default:
      get('/employees');
      sleep(0.1);
  }
}

export function teardown() {
  console.log('Final health check...');
  const health = get('/health');
  console.log(`Health: ${health.status === 200 ? 'OK' : 'FAILED'}`);
  
  const stats = get('/pool-stats');
  if (stats.status === 200) console.log('Pool stats:', stats.body);
}
