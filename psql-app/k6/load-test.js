import http from 'k6/http';
import { check, sleep } from 'k6';
//import { randomIntBetween } from 'k6/crypto';

export const options = {
  scenarios: {
    movie_matrix: {

// Stress testing
//      executor: 'ramping-vus',
//      startVUs: 0,
//      stages: [
//         { duration: '2m', target: 8 },
//         { duration: '5m', target: 8 },
//        { duration: '2m', target: 0 }
//      ],
//      exec: 'movieMatrixApp'

      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
                { duration: '5m', target: 100 },   // Ramp-up to 100 VUs in 5 minutes
                { duration: '20m', target: 100 },  // Hold at 100 VUs for 20 minutes
                { duration: '5m', target: 200 },   // Ramp-up to 200 VUs in 5 minutes
                { duration: '20m', target: 200 },  // Hold at 200 VUs for 20 minutes
                { duration: '5m', target: 100 },   // Ramp-down to 100 VUs in 5 minutes
                { duration: '5m', target: 0 },     // Ramp-down to 0 VUs in 5 minutes
          ],
          exec: 'movieMatrixApp'

// Load testing
//      executor: 'constant-vus',
//      vus: 500,
//      duration: '30m',
//      exec: 'movieMatrixApp'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<8000']  // 8s for 95th    percentile
  }
};

const BASE_URLS = {
  MOVIE_MATRIX: __ENV.MOVIE_MATRIX_URL || 'http://movie-matrix:5000'
};

//export default function () {
//  const url = `${BASE_URLS.MOVIE_MATRIX}/health`;  // dynamic base URL
//  const response = http.get(url);
//
//  check(response, {
//    'status is 200': (r) => r.status === 200,
//  });
//}

function makeRequest(baseUrl, endpoint) {
  const url = `${baseUrl}${endpoint.path}`;
  const params = {
    headers: { 'Content-Type': 'application/json' }
  };

  try {
    let response;
    switch (endpoint.method.toUpperCase()) {
      case 'GET':
        response = http.get(url, params);
        break;
      case 'POST':
        response = http.post(url, JSON.stringify(endpoint.body || {}), params);
        break;
      case 'PUT':
        response = http.put(url, JSON.stringify(endpoint.body || {}), params);
        break;
    }

    // Simple status check
    check(response, {
      'status was 200': (r) => r.status === 200
    });

    // Adaptive sleep
    sleep(randomIntBetween(1, 3));

  } catch (err) {
        console.error(`Error during request to ${endpoint.path}: ${err.message}`);
        sleep(2); // Sleep on error
  }
}

// Movie-Matrix endpoints
export function movieMatrixApp() {
  const endpoints = [
    // Original application endpoints
    { path: '/actors/top_by_film_count', method: 'GET' },
    { path: '/customers/top_spenders', method: 'GET' },
    { path: '/store-rental-income', method: 'GET' },
    { path: '/all-customers', method: 'GET'},
    { path: '/customer-names', method: 'GET'},
    { path: '/customer-lname', method: 'GET'},
    { path: '/customer-email', method: 'GET'},
    { path: '/customer-count', method: 'GET'},
    { path: '/customer-dis-name', method: 'GET'},
    { path: '/customers-order-date', method: 'GET'},
    { path: '/customers-limit-5', method: 'GET'},
    { path: '/customers-null-phone', method: 'GET'},
    { path: '/order-items', method: 'GET'},
    { path: '/all-products', method: 'GET'},
    { path: '/product-price', method: 'GET'},
    { path: '/product-price-50', method: 'GET'},
    { path: '/avg-product-price', method: 'GET'},
    { path: '/product-category', method: 'GET'},
    { path: '/product-stock-0', method: 'GET'},
    { path: '/product-clothing-stock', method: 'GET'},
    { path: '/product-order-price', method: 'GET'},
    { path: '/product-distinct', method: 'GET'},
    { path: '/product-new', method: 'GET'},
    { path: '/all-orders', method: 'GET'},
    { path: '/order-id' , method: 'GET'},
    { path: '/order-shipped', method: 'GET'},
    { path: '/order-amount' , method: 'GET'},
    { path: '/order-march' , method: 'GET'},
    { path: '/orders-pending', method: 'GET'},
    { path: '/avg-amount-customer' , method: 'GET'},
    { path: '/orders-old-date' , method: 'GET'},
    { path: '/order-amount-100', method: 'GET'},
    { path: '/order-join-customer' , method: 'GET'},
    { path: '/all-order-items', method: 'GET'},
    { path: '/all-employees-details', method: 'GET'},
    { path: '/all-suppliers' , method: 'GET'},
    { path: '/all-payments' , method: 'GET'},
    { path: '/all-categories', method: 'GET'},
    { path: '/all-reviews' , method: 'GET'},
    { path: '/all-shipping', method: 'GET'},

    // Session & Lock Simulation
    { path: '/simulate/long-running-query', method: 'GET' },
    { path: '/simulate/table-lock', method: 'GET' },
    { path: '/simulate/concurrent-sessions', method: 'GET' },

    // Disk I/O Simulation
    { path: '/simulate/sequential-scan', method: 'GET' },
    { path: '/simulate/bulk-insert', method: 'GET' },
    { path: '/simulate/index-scan', method: 'GET' },
    { path: '/simulate/direct-path-io', method: 'GET' },

    // Memory Simulation
    { path: '/simulate/memory-sort', method: 'GET' },
    { path: '/simulate/disk-sort', method: 'GET' },
    { path: '/simulate/buffer-cache', method: 'GET' },
    { path: '/simulate/temp-space', method: 'GET' },

    // Query Performance Simulation
    { path: '/simulate/hard-parse', method: 'GET' },
    { path: '/simulate/soft-parse', method: 'GET' },
    { path: '/simulate/cursor-usage', method: 'GET' },
    { path: '/simulate/execution-plan', method: 'GET' },
    { path: '/simulate/parse-failures', method: 'GET' },
    { path: '/simulate/child-cursors', method: 'GET' },
    { path: '/simulate/execute-without-parse', method: 'GET' },
    { path: '/simulate/slow-query-stats', method: 'GET' },

    // Transaction Simulation
    { path: '/simulate/commits?count=10', method: 'GET' },
    { path: '/simulate/rollbacks?count=5', method: 'GET' },
    { path: '/simulate/transaction-rate', method: 'GET' },

    // Physical I/O Simulation
    { path: '/simulate/physical-reads', method: 'GET' },
    { path: '/simulate/physical-writes', method: 'GET' },
    { path: '/simulate/logical-reads', method: 'GET' },
    { path: '/simulate/io-requests', method: 'GET' },

    // Network & User Activity Simulation
    { path: '/simulate/user-calls', method: 'GET' },
    { path: '/simulate/network-traffic', method: 'GET' },
    { path: '/simulate/session-resources', method: 'GET' },

    // Complex Query Simulation
    { path: '/simulate/analytics-query', method: 'GET' },
    { path: '/simulate/recursive-query', method: 'GET' },
    { path: '/simulate/rows-per-sort', method: 'GET' },

    // DB Internals Simulation
    { path: '/simulate/block-changes', method: 'GET' },
    { path: '/simulate/consistent-reads', method: 'GET' },
    { path: '/simulate/cr-blocks-undo', method: 'GET' },
    { path: '/simulate/index-splits', method: 'GET' },
    { path: '/simulate/checkpoints-redo', method: 'GET' },
    { path: '/simulate/enqueue-operations', method: 'GET' },

    // Cache & Performance Ratios
    { path: '/simulate/cache-ratios', method: 'GET' },
    { path: '/simulate/db-time-response', method: 'GET' },

    // Resource Management & Limits
    { path: '/simulate/resource-limits', method: 'GET' },

    // Wait Events
    { path: '/simulate/wait-events-detailed', method: 'GET' },

    // ==== NEW COMPREHENSIVE METRICS (18 additional endpoints) ====

    // RAC & Clustering Metrics
    { path: '/simulate/rac-instance-status', method: 'GET' },
    { path: '/simulate/asm-diskgroups', method: 'GET' },
    { path: '/simulate/rac-cluster-waits', method: 'GET' },
    { path: '/simulate/rac-service-config', method: 'GET' },
    { path: '/simulate/global-cache-rac', method: 'GET' },

    // Slow Query & Execution Plans
    { path: '/simulate/slow-query-detailed', method: 'GET' },
    { path: '/simulate/blocking-chains', method: 'GET' },

    // Container & PDB Metrics
    { path: '/simulate/container-pdb-status', method: 'GET' },
    { path: '/simulate/datafile-tablespace', method: 'GET' },

    // Connection Pool & Service Metrics
    { path: '/simulate/connection-pool-advanced', method: 'GET' },

    // Database Info & Configuration
    { path: '/simulate/database-version-info', method: 'GET' },

    // Advanced System Metrics
    { path: '/simulate/table-index-scans', method: 'GET' },
    { path: '/simulate/session-resource-detailed', method: 'GET' },
    { path: '/simulate/host-os-load', method: 'GET' },
    { path: '/simulate/parse-execute-quality', method: 'GET' },
    { path: '/simulate/session-process-limits', method: 'GET' },
    { path: '/simulate/advanced-cache-ratios', method: 'GET' },
    { path: '/simulate/db-time-performance', method: 'GET' },
    { path: '/simulate/io-system-metrics', method: 'GET' },
    { path: '/simulate/lob-io-operations', method: 'GET' }
  ];

  const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  // Make the request to the randomly selected endpoint
  makeRequest(BASE_URLS.MOVIE_MATRIX, randomEndpoint);
}

// function to simulate `randomIntBetween` if needed
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}