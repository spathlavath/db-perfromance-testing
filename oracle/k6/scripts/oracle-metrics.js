/**
 * K6 Load Test - Oracle Metrics Stimulation
 * Stimulates all metrics collected by newrelicoraclereceiver
 * 
 * Usage:
 *   k6 run oracle-metrics.js
 *   k6 run --vus 5 --duration 10m oracle-metrics.js
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
  stages: [
    { duration: '30s', target: 10 },  // Ramp up fast
    { duration: '2m', target: 25 },   // Heavy load
    { duration: '5m', target: 50 },   // Crazy load
    { duration: '3m', target: 75 },   // Maximum load
    { duration: '2m', target: 50 },   // Back down
    { duration: '1m', target: 0 },    // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<30000'],
    errors: ['rate<0.3'],
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
  console.log('='.repeat(80));
  console.log('🚀 K6 LOAD TEST STARTING - Oracle Metrics Stimulation');
  console.log('='.repeat(80));
  console.log('Health check...');
  const health = get('/health');
  if (health.status !== 200) throw new Error('API unhealthy');
  console.log('✅ API is healthy - Starting workload with 33 endpoint types');
  console.log('📊 Test stages: 30s→10VU, 2m→25VU, 5m→50VU, 3m→75VU (peak), 2m→50VU, 1m→0VU');
  console.log('='.repeat(80));
}

export default function() {
  const workload = Math.floor(Math.random() * 33);
  
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
      // General wait events - heavy
      post('/workload/wait');
      sleep(0.5);
      break;
      
    case 15:
      // DB file sequential read - fast
      post('/workload/wait/db-file-seq-read', { iterations: 50 });
      sleep(0.3);
      break;
      
    case 16:
      // DB file scattered read - moderate
      post('/workload/wait/db-file-scattered-read', { iterations: 20 });
      sleep(0.5);
      break;
      
    case 17:
      // Log file sync - moderate
      post('/workload/wait/log-file-sync', { iterations: 30 });
      sleep(0.5);
      break;
      
    case 18:
      // Latch free - intense
      post('/workload/wait/latch-free', { iterations: 100 });
      sleep(0.5);
      break;
      
    case 19:
      // Buffer busy waits - moderate
      post('/workload/wait/buffer-busy', { iterations: 40 });
      sleep(0.5);
      break;
      
    case 20:
      // Direct path read/write - heavy
      post('/workload/wait/direct-path', { iterations: 10 });
      sleep(1);
      break;
      
    case 21:
      // Library cache lock/pin - moderate
      post('/workload/wait/library-cache', { iterations: 50 });
      sleep(0.5);
      break;
      
    case 22:
      // SQL*Net message - fast
      post('/workload/wait/sqlnet-message', { iterations: 100 });
      sleep(0.3);
      break;
      
    case 23:
      // Row cache lock - moderate
      post('/workload/wait/row-cache-lock', { iterations: 30 });
      sleep(0.3);
      break;
      
    case 24:
      // Comprehensive mix - intense
      post('/workload/comprehensive', { intensity: 'high' });
      sleep(0.5);
      break;
      
    case 25:
      // Lock contention - moderate (don't overdo)
      post('/workload/lock', { duration: 2 });
      sleep(2.5);
      break;
      
    case 26:
      // PDB metrics - intense
      post('/workload/pdb', { operations: 50 });
      sleep(0.5);
      break;
      
    case 27:
      // Parallel execution - heavy
      post('/workload/parallel', { degree: 8 });
      sleep(0.5);
      break;
      
    case 28:
      // Network traffic - moderate
      post('/workload/network', { iterations: 30 });
      sleep(0.5);
      break;
      
    case 29:
      // Consistent read - heavy
      post('/workload/consistent-read', { iterations: 30 });
      sleep(1);
      break;
      
    case 30:
      // Block changes - intense
      post('/workload/block-change', { operations: 100 });
      sleep(0.5);
      break;
      
    case 31:
      // Enqueue operations
      post('/workload/enqueue', { iterations: 25 });
      sleep(0.5);
      break;
      
    case 32:
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
