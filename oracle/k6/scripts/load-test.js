import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const queryDuration = new Trend('query_duration');
const transactionDuration = new Trend('transaction_duration');
const requestCounter = new Counter('request_count');

// Configuration
const BASE_URL = __ENV.ORACLE_TEST_APP_URL || 'http://localhost:3000';
const LOG_LEVEL = __ENV.LOG_LEVEL || 'INFO';
const DETAILED_LOGGING = __ENV.DETAILED_RESPONSE_LOGGING === 'true';
const SLOW_REQUEST_THRESHOLD = parseInt(__ENV.LOG_SLOW_REQUESTS_MS || '5000');

// Test stages - Continuous 2 week run with sustainable medium load
export const options = {
  stages: [
    { duration: '2m', target: 5 },      // Gradual ramp-up to 5 users
    { duration: '336h', target: 5 },    // Maintain 5 users for 2 weeks (336 hours)
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    errors: ['rate<0.1'],              // Error rate should be below 10%
  },
};

// Logging function
function log(level, message, data = null) {
  const levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  const currentLevel = levels[LOG_LEVEL] || 1;
  const messageLevel = levels[level] || 1;
  
  if (messageLevel >= currentLevel) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] ${message}`;
    if (data && DETAILED_LOGGING) {
      logMessage += ` | Data: ${JSON.stringify(data)}`;
    }
    console.log(logMessage);
  }
}

// Health check function
function healthCheck() {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/health`);
  const duration = Date.now() - startTime;
  
  const success = check(res, {
    'health check status is 200': (r) => r.status === 200,
    'health check has status field': (r) => JSON.parse(r.body).status !== undefined,
  });
  
  if (!success) {
    log('ERROR', 'Health check failed', { status: res.status, body: res.body });
    errorRate.add(1);
  } else {
    log('DEBUG', 'Health check passed', { duration: `${duration}ms` });
  }
  
  if (duration > SLOW_REQUEST_THRESHOLD) {
    log('WARN', `Slow health check: ${duration}ms`);
  }
  
  requestCounter.add(1);
  return success;
}

// Pool statistics check
function checkPoolStats() {
  const startTime = Date.now();
  const res = http.get(`${BASE_URL}/pool-stats`);
  const duration = Date.now() - startTime;
  
  const success = check(res, {
    'pool stats status is 200': (r) => r.status === 200,
  });
  
  if (!success) {
    log('ERROR', 'Pool stats check failed', { status: res.status });
    errorRate.add(1);
  } else {
    log('DEBUG', 'Pool stats retrieved', { duration: `${duration}ms` });
  }
  
  if (duration > SLOW_REQUEST_THRESHOLD) {
    log('WARN', `Slow pool stats request: ${duration}ms`);
  }
  
  requestCounter.add(1);
  return success;
}

// Start workload function
function startWorkload(workloadType, intensity = 'medium', duration = 60) {
  const startTime = Date.now();
  const payload = JSON.stringify({
    type: workloadType,
    intensity: intensity,
    duration: duration,
  });
  
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };
  
  const res = http.post(`${BASE_URL}/workload/start`, payload, params);
  const requestDuration = Date.now() - startTime;
  
  const success = check(res, {
    [`${workloadType} workload started`]: (r) => r.status === 200,
  });
  
  if (!success) {
    log('ERROR', `Failed to start ${workloadType} workload`, { 
      status: res.status, 
      body: res.body 
    });
    errorRate.add(1);
  } else {
    log('INFO', `Started ${workloadType} workload`, { 
      intensity, 
      duration: `${duration}s`,
      requestDuration: `${requestDuration}ms`
    });
  }
  
  if (requestDuration > SLOW_REQUEST_THRESHOLD) {
    log('WARN', `Slow workload start request: ${requestDuration}ms`);
  }
  
  // Track specific workload metrics
  if (workloadType === 'query') {
    queryDuration.add(requestDuration);
  } else if (workloadType === 'transaction') {
    transactionDuration.add(requestDuration);
  }
  
  requestCounter.add(1);
  return success;
}

// Main test scenario
export default function() {
  // 1. Health check
  if (!healthCheck()) {
    log('ERROR', 'Aborting iteration due to failed health check');
    sleep(5);
    return;
  }
  
  sleep(2);
  
  // 2. Check pool statistics
  checkPoolStats();
  
  sleep(3);
  
  // 3. Start workloads with medium intensity for sustainability
  const workloadTypes = ['query', 'transaction', 'connection', 'memory'];
  const randomWorkload = workloadTypes[Math.floor(Math.random() * workloadTypes.length)];
  
  // Use medium intensity for stable 2-week run
  log('INFO', `Starting random workload: ${randomWorkload} with medium intensity`);
  startWorkload(randomWorkload, 'medium', 60);
  
  sleep(5);
  
  // 4. Periodically check pool stats during workload
  checkPoolStats();
  
  sleep(8);
}

// Setup function - runs once at the start
export function setup() {
  log('INFO', '=== Starting Oracle DB Load Test ===');
  log('INFO', `Base URL: ${BASE_URL}`);
  log('INFO', `Log Level: ${LOG_LEVEL}`);
  log('INFO', `Detailed Logging: ${DETAILED_LOGGING}`);
  log('INFO', `Slow Request Threshold: ${SLOW_REQUEST_THRESHOLD}ms`);
  
  // Initial health check
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    log('ERROR', 'Initial health check failed - application may not be ready');
    throw new Error('Application not healthy');
  }
  
  log('INFO', 'Initial health check passed - starting load test');
}

// Teardown function - runs once at the end
export function teardown(data) {
  log('INFO', '=== Load Test Complete ===');
  log('INFO', 'Check metrics for detailed results');
}
