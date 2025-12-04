const newrelic = require("newrelic");
console.log("New Relic agent status:", newrelic.agent.config.agent_enabled);
const express = require("express");
const { Pool } = require('pg');

// Basic logging middleware
const requestLogger = (serviceName) => (req, res, next) => {
  const startTime = Date.now();

  // Override res.json to capture the response
  const originalJson = res.json;

  res.json = function (data) {
    const duration = Date.now() - startTime;
    console.log(`${new Date().toISOString()} - ${serviceName} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Duration: ${duration}ms${data.error ? ` | Error: ${data.error}` : ''}`);
    return originalJson.apply(this, arguments);
  };
  next();
};

// Enhanced health check with console error logging
async function checkDatabaseConnection(pool) {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1'); // Simple query to verify connection
    client.release();
    return true;
  } catch (err) {
    console.error(new Date().toISOString(), 'Database connection check failed:', err.message);
    return false;
  }
}

async function startMovieMatrixApp() {
  const pool = new Pool({
    host: process.env.PSQL_HOST || 'localhost',
    user: process.env.PSQL_USER || 'postgres',
    password: process.env.PSQL_PASSWORD || '',
    database: process.env.PSQL_DATABASE || 'pagila',
    max: 20,
    idleTimeoutMillis: 120000
  });

  pool.on('connect', async (client) => {
    try {
      await client.query('SET search_path TO pagila, public');
    } catch (err) {
      client.release();
      throw err;
    }
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  const app = express();
  app.use(express.json());
  app.use(requestLogger('Movie-Matrix'));

  app.get('/health', async (req, res) => {
      const dbHealthy = await checkDatabaseConnection(pool);
      if (dbHealthy) {
        res.json({ status: 'ok' });
      } else {
        res.status(500).json({ error: 'Database connection failed' });
      }
    });

  // 1. Search by hire_date (missing index)
    app.get('/actors/top_by_film_count', async (req, res) => {
     newrelic.setTransactionName('fetch-top-actors-by-film-count');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(`
          SELECT a.actor_id, a.first_name, a.last_name, COUNT(f.title) AS film_count
          FROM actor a
          JOIN film_actor fa ON a.actor_id = fa.actor_id
          JOIN film f ON fa.film_id = f.film_id
          GROUP BY a.actor_id, a.first_name, a.last_name
          ORDER BY film_count DESC
          LIMIT 5
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok', data: rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error(`/actors/top_by_film_count | Error: ${err.message}`, err);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // 2. Search by name or department (inefficient OR + LIKE)
    app.get('/customers/top_spenders', async (req, res) => {
     newrelic.setTransactionName('fetch-top-spenders-customer');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(`
          SELECT cu.customer_id, cu.first_name, cu.last_name, COUNT(r.rental_id) AS total_rentals, SUM(p.amount) AS total_amount_spent
          FROM customer cu
          JOIN rental r ON cu.customer_id = r.customer_id
          JOIN payment p ON r.rental_id = p.rental_id GROUP BY cu.customer_id, cu.first_name, cu.last_name
          HAVING COUNT(r.rental_id) > 30 ORDER BY total_rentals DESC, total_amount_spent DESC
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok', data: rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        res.status(500).json({ error: err.message });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/store-rental-income', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT s.store_id, SUM(p.amount) AS total_income
          FROM payment p
          JOIN rental r ON p.rental_id = r.rental_id
          JOIN inventory i ON r.inventory_id = i.inventory_id
          JOIN store s ON i.store_id = s.store_id
          GROUP BY s.store_id
          ORDER BY total_income DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/all-customers', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-names', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT first_name, last_name FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-lname', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers WHERE last_name = 'Smith'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-email', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT email FROM Customers WHERE registration_date >= '2023-01-01'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-count', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT COUNT(*) FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
//        newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customer-dis-name', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT DISTINCT last_name FROM Customers
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customers-order-date', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers ORDER BY registration_date DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-store-rental-income | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/customers-limit-5', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Customers LIMIT 5
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/customers-null-phone', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT customer_id, first_name, last_name FROM Customers WHERE phone_number IS NULL
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/order-items', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, SUM(quantity) FROM OrderItems GROUP BY order_id
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/all-products', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/product-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_name, price FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-price-50', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products WHERE price < 50.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/avg-product-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT AVG(price) FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-category', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products WHERE category = 'Electronics'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/product-stock-0', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_name FROM Products WHERE stock_quantity = 0;
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-clothing-stock', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT SUM(stock_quantity) FROM Products WHERE category = 'Clothing'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-order-price', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Products ORDER BY price DESC
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-distinct', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT DISTINCT category FROM Products
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/product-new', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT product_id, product_name FROM Products WHERE description LIKE '%new%'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/all-orders', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-orders | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-id', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, order_date FROM Orders WHERE customer_id = 1
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });


    // Get total rental income by store
    app.get('/order-shipped', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders WHERE status = 'Shipped'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-amount', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT MAX(total_amount) FROM Orders
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-march', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id FROM Orders WHERE order_date BETWEEN '2023-03-01' AND '2023-03-31'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/orders-pending', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT COUNT(*) FROM Orders WHERE status = 'Pending'
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/avg-amount-customer', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT customer_id, AVG(total_amount) FROM Orders GROUP BY customer_id
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/orders-old-date', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT * FROM Orders ORDER BY order_date
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get total rental income by store
    app.get('/order-amount-100', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result = await client.query(`
          SELECT order_id, total_amount FROM Orders WHERE total_amount > 100.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows });
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-customers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all order items
    app.get('/all-order-items', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM OrderItems WHERE product_id = 5
        `);
        const result2 = await client.query(`
          SELECT AVG(price_per_unit) FROM OrderItems
        `);
        const result3 = await client.query(`
          SELECT oi.order_item_id, p.product_name, oi.quantity FROM OrderItems oi JOIN Products p ON oi.product_id = p.product_id
        `);
        const result4 = await client.query(`
          SELECT order_id FROM OrderItems WHERE quantity > 10
        `);
        const result5 = await client.query(`
          SELECT COUNT(DISTINCT order_id) FROM OrderItems
        `);
        const result6 = await client.query(`
          SELECT * FROM OrderItems ORDER BY price_per_unit * quantity DESC
        `);
        const result7 = await client.query(`
          SELECT product_id, SUM(quantity * price_per_unit) FROM OrderItems GROUP BY product_id
        `);
        const result8 = await client.query(`
          SELECT order_item_id, order_id FROM OrderItems WHERE price_per_unit < 10.00
        `);

        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
                orderItemsWithProductId5: result1.rows,
                averagePricePerUnit: result2.rows[0], // Assuming there's one row in the average query
                orderItemsWithProductNames: result3.rows,
                ordersWithQuantityGreaterThan10: result4.rows,
                distinctOrdersCount: result5.rows[0], // Return the count as a single object
                orderedItemsByValue: result6.rows,
                totalSalesByProduct: result7.rows,
                itemsWithPriceBelow10: result8.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-order-items | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all employees
    app.get('/all-employees-details', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Employees
        `);
        const result2 = await client.query(`
          SELECT first_name, last_name, job_title FROM Employees
        `);
        const result3 = await client.query(`
         SELECT * FROM Employees WHERE department = 'Sales'
        `);
        const result4 = await client.query(`
          SELECT AVG(salary) FROM Employees
        `);
        const result5 = await client.query(`
          SELECT employee_id, first_name, last_name FROM Employees WHERE salary > 60000.00
        `);
        const result6 = await client.query(`
          SELECT COUNT(*) FROM Employees WHERE job_title LIKE '%Engineer%'
        `);
        const result7 = await client.query(`
          SELECT * FROM Employees ORDER BY hire_date DESC
        `);
        const result8 = await client.query(`
          SELECT department, SUM(salary) FROM Employees GROUP BY department
        `);
        const result9 = await client.query(`
          SELECT first_name, last_name FROM Employees WHERE hire_date BETWEEN '2023-01-01' AND '2023-12-31'
        `);
        const result10 = await client.query(`
          SELECT e.first_name, e.last_name, e.job_title, d.department AS department_name FROM Employees e LEFT JOIN (SELECT DISTINCT department FROM Employees) d ON e.department = d.department
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allEmployees: result1.rows,
            employeeNamesAndTitles: result2.rows,
            salesDepartmentEmployees: result3.rows,
            averageSalary: result4.rows[0], // Assuming one row returned for average
            highSalaryEmployees: result5.rows,
            engineerCount: result6.rows[0], // Assuming there's one row with the count
            recentHires: result7.rows,
            departmentSalaries: result8.rows,
            hiresIn2023: result9.rows,
            joinedDepartmentData: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-employees | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all suppliers
    app.get('/all-suppliers', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Suppliers
        `);
        const result2 = await client.query(`
          SELECT supplier_name, contact_email FROM Suppliers
        `);
        const result3 = await client.query(`
         SELECT * FROM Suppliers WHERE supplier_name LIKE 'A%'
        `);
        const result4 = await client.query(`
          SELECT contact_name FROM Suppliers WHERE contact_email IS NULL
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Suppliers
        `);
        const result6 = await client.query(`
          SELECT * FROM Suppliers ORDER BY supplier_name DESC
        `);
        const result7 = await client.query(`
          SELECT supplier_id, contact_name FROM Suppliers WHERE contact_phone LIKE '%555%'
        `);
        const result8 = await client.query(`
          SELECT supplier_name FROM Suppliers WHERE contact_name = 'Wile E. Coyote'
        `);
        const result9 = await client.query(`
          SELECT supplier_id, supplier_name FROM Suppliers WHERE contact_email LIKE '%@initech.com'
        `);
        const result10 = await client.query(`
          SELECT supplier_name, contact_phone FROM Suppliers LIMIT 3
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allSuppliers: result1.rows,
            supplierNamesAndEmails: result2.rows,
            suppliersStartingWithA: result3.rows,
            contactsWithoutEmail: result4.rows,
            totalSupplierCount: result5.rows[0], // Assuming one row returned for count
            suppliersOrderedByNameDesc: result6.rows,
            suppliersWithSpecificPhone: result7.rows,
            specificContactSuppliers: result8.rows,
            suppliersWithInitechEmail: result9.rows,
            firstThreeSuppliers: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-suppliers | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all payments
    app.get('/all-payments', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Payments
        `);
        const result2 = await client.query(`
          SELECT payment_id, payment_date FROM Payments WHERE order_id = 3
        `);
        const result3 = await client.query(`
         SELECT * FROM Payments WHERE payment_method = 'Credit Card'
        `);
        const result4 = await client.query(`
          SELECT AVG(amount) FROM Payments
        `);
        const result5 = await client.query(`
          SELECT order_id, SUM(amount) FROM Payments GROUP BY order_id
        `);
        const result6 = await client.query(`
          SELECT * FROM Payments WHERE payment_date BETWEEN '2023-04-01' AND '2023-04-30'
        `);
        const result7 = await client.query(`
          SELECT payment_method, COUNT(*) FROM Payments GROUP BY payment_method
        `);
        const result8 = await client.query(`
          SELECT * FROM Payments ORDER BY amount DESC
        `);
        const result9 = await client.query(`
          SELECT payment_id, amount FROM Payments WHERE amount > 100.00
        `);
        const result10 = await client.query(`
          SELECT p.payment_id, o.order_date, p.amount FROM Payments p JOIN Orders o ON p.order_id = o.order_id
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allPayments: result1.rows,
            paymentsForOrder3: result2.rows,
            creditCardPayments: result3.rows,
            averagePaymentAmount: result4.rows[0], // Assuming one row returned for average
            totalAmountByOrder: result5.rows,
            paymentsInApril: result6.rows,
            paymentMethodCounts: result7.rows,
            paymentsOrderedByAmountDesc: result8.rows,
            largePayments: result9.rows,
            paymentsWithOrderDates: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-payments | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all categories
    app.get('/all-categories', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Categories
        `);
        const result2 = await client.query(`
          SELECT category_name FROM Categories
        `);
        const result3 = await client.query(`
          SELECT * FROM Categories WHERE category_name LIKE '%s'
        `);
        const result4 = await client.query(`
          SELECT description FROM Categories WHERE category_id = 2
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Categories
        `);
        const result6 = await client.query(`
          SELECT * FROM Categories ORDER BY category_name
        `);
        const result7 = await client.query(`
          SELECT category_id, category_name FROM Categories WHERE description LIKE '%and%'
        `);
        const result8 = await client.query(`
          SELECT category_name FROM Categories WHERE category_id IN (1, 3, 5)
        `);
        const result9 = await client.query(`
          SELECT category_id, category_name FROM Categories LIMIT 3
        `);
        const result10 = await client.query(`
          SELECT c.category_name, p.product_name FROM Categories c LEFT JOIN Products p ON c.category_name = p.category
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allCategories: result1.rows,
            categoryNames: result2.rows,
            categoriesWithNameEndingS: result3.rows,
            descriptionForCategory2: result4.rows,
            totalCategories: result5.rows[0], // Assuming one row returned for count
            categoriesOrderedByName: result6.rows,
            categoriesWithDescriptionAnd: result7.rows,
            specificCategoryNames: result8.rows,
            firstThreeCategories: result9.rows,
            categoryProductJoin: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-categories | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all reviews
    app.get('/all-reviews', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Reviews
        `);
        const result2 = await client.query(`
          SELECT rating, review_text FROM Reviews WHERE product_id = 1
        `);
        const result3 = await client.query(`
         SELECT AVG(rating) FROM Reviews WHERE product_id = 1
        `);
        const result4 = await client.query(`
          SELECT * FROM Reviews WHERE customer_id = 1
        `);
        const result5 = await client.query(`
          SELECT COUNT(*) FROM Reviews WHERE rating = 5
        `);
        const result6 = await client.query(`
          SELECT r.review_id, p.product_name, c.first_name, c.last_name, r.rating FROM Reviews r JOIN Products p ON r.product_id = p.product_id JOIN Customers c ON r.customer_id = c.customer_id
        `);
        const result7 = await client.query(`
          SELECT * FROM Reviews WHERE review_date >= '2023-04-01'
        `);
        const result8 = await client.query(`
          SELECT review_text FROM Reviews WHERE rating < 3
        `);
        const result9 = await client.query(`
          SELECT product_id, AVG(rating) as avg_rating FROM Reviews GROUP BY product_id ORDER BY avg_rating DESC
        `);
        const result10 = await client.query(`
           SELECT review_id, review_text FROM Reviews WHERE review_text LIKE '%great%'
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allReviews: result1.rows,
            specificProductReviews: result2.rows,
            averageProductRating: result3.rows[0],  // Assuming one row returned for average
            customerReviews: result4.rows,
            fiveStarReviewCount: result5.rows[0],  // Assuming there's one row with the count
            reviewDetailsWithNames: result6.rows,
            recentReviews: result7.rows,
            lowRatingReviews: result8.rows,
            productRatings: result9.rows,
            reviewsContainingGreat: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-reviews | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Get all shipping
    app.get('/all-shipping', async (req, res) => {
     newrelic.setTransactionName('fetch-store-rental-income');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');

        const result1 = await client.query(`
          SELECT * FROM Shipping
        `);
        const result2 = await client.query(`
          SELECT order_id, shipping_date, carrier FROM Shipping
        `);
        const result3 = await client.query(`
           SELECT * FROM Shipping WHERE carrier = 'FedEx'
        `);
        const result4 = await client.query(`
          SELECT AVG(delivery_date - shipping_date) FROM Shipping
        `);
        const result5 = await client.query(`
          SELECT order_id FROM Shipping WHERE shipping_date BETWEEN '2023-03-01' AND '2023-03-31'
        `);
        const result6 = await client.query(`
           SELECT COUNT(*) FROM Shipping WHERE delivery_date IS NULL
        `);
        const result7 = await client.query(`
          SELECT s.shipping_id, o.order_date, s.shipping_date, s.delivery_date FROM Shipping s JOIN Orders o ON s.order_id = o.order_id
        `);
        const result8 = await client.query(`
          SELECT * FROM Shipping ORDER BY shipping_date DESC
        `);
        const result9 = await client.query(`
          SELECT shipping_address FROM Shipping WHERE order_id = 3
        `);
        const result10 = await client.query(`
           SELECT carrier, COUNT(*) FROM Shipping GROUP BY carrier
        `);
        await client.query('COMMIT');
        res.json({ status: 'ok',
        data: {
            allShipping: result1.rows,
            shippingOverview: result2.rows,
            fedExShipments: result3.rows,
            averageDeliveryTime: result4.rows[0], // Assuming one row returned for average
            marchShipments: result5.rows,
            undeliveredCount: result6.rows[0], // Assuming there's one row with the count
            shippingWithOrderData: result7.rows,
            orderedRecentShipments: result8.rows,
            orderId3Address: result9.rows,
            carrierCounts: result10.rows
        }});
      } catch (err) {
        if (client) {
          await client.query('ROLLBACK');
        }
       newrelic.noticeError(err);
        console.error('fetch-all-shipping | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== SESSION & LOCK SIMULATION ====================
    
    // Simulate active sessions with long-running queries
    app.get('/simulate/long-running-query', async (req, res) => {
      newrelic.setTransactionName('simulate-long-running-query');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Simulate a long-running query with multiple joins and aggregations
        const result = await client.query(`
          SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            COUNT(DISTINCT o.order_id) as total_orders,
            SUM(o.total_amount) as lifetime_value,
            AVG(oi.quantity) as avg_items_per_order,
            STRING_AGG(DISTINCT p.category, ', ') as categories_purchased
          FROM Customers c
          LEFT JOIN Orders o ON c.customer_id = o.customer_id
          LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
          LEFT JOIN Products p ON oi.product_id = p.product_id
          WHERE c.registration_date >= '2020-01-01'
          GROUP BY c.customer_id, c.first_name, c.last_name
          HAVING COUNT(DISTINCT o.order_id) > 0
          ORDER BY lifetime_value DESC
        `);
        
        await client.query('COMMIT');
        res.json({ status: 'ok', data: result.rows, metric_simulation: 'long_running_queries' });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-long-running-query | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate blocking/locked sessions
    app.get('/simulate/table-lock', async (req, res) => {
      newrelic.setTransactionName('simulate-table-lock');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Lock rows for update (simulates row-level locks)
        const result = await client.query(`
          SELECT * FROM Products 
          WHERE category = 'Electronics' 
          FOR UPDATE
        `);
        
        // Hold the lock for a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_locked: result.rowCount,
          metric_simulation: 'locks.count, locks.blocked_sessions' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-table-lock | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate multiple concurrent sessions
    app.get('/simulate/concurrent-sessions', async (req, res) => {
      newrelic.setTransactionName('simulate-concurrent-sessions');
      const sessionCount = parseInt(req.query.count) || 5;
      
      try {
        const promises = [];
        for (let i = 0; i < sessionCount; i++) {
          promises.push(
            pool.query('SELECT COUNT(*) FROM Customers').then(() => ({ session: i, status: 'completed' }))
          );
        }
        
        const results = await Promise.all(promises);
        res.json({ 
          status: 'ok', 
          sessions_created: sessionCount,
          results,
          metric_simulation: 'sessions.count' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-concurrent-sessions | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      }
    });

    // ==================== DISK I/O SIMULATION ====================
    
    // Simulate heavy disk reads with sequential scans
    app.get('/simulate/sequential-scan', async (req, res) => {
      newrelic.setTransactionName('simulate-sequential-scan');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Force sequential scan by selecting all data without indexes
        const result = await client.query(`
          SELECT p.*, c.category_name
          FROM Products p
          CROSS JOIN Categories c
          WHERE p.description LIKE '%a%'
          ORDER BY p.product_id, c.category_id
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_scanned: result.rowCount,
          metric_simulation: 'disk.reads, disk.blocks_read, system.total_table_scans_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-sequential-scan | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate heavy disk writes
    app.get('/simulate/bulk-insert', async (req, res) => {
      newrelic.setTransactionName('simulate-bulk-insert');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Create temp table and insert bulk data
        await client.query(`
          CREATE TEMP TABLE temp_bulk_data AS
          SELECT 
            generate_series(1, 10000) as id,
            md5(random()::text) as data,
            now() as created_at
        `);
        
        const result = await client.query('SELECT COUNT(*) FROM temp_bulk_data');
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_inserted: result.rows[0].count,
          metric_simulation: 'disk.writes, disk.blocks_written, disk.write_time_milliseconds' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-bulk-insert | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate full index scans
    app.get('/simulate/index-scan', async (req, res) => {
      newrelic.setTransactionName('simulate-index-scan');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Query that uses indexes
        const result = await client.query(`
          SELECT * FROM Customers 
          WHERE last_name BETWEEN 'A' AND 'M'
          ORDER BY last_name, first_name
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_found: result.rowCount,
          metric_simulation: 'system.full_index_scans_per_second, system.total_index_scans_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-index-scan | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== MEMORY SIMULATION ====================
    
    // Simulate memory-intensive sorts
    app.get('/simulate/memory-sort', async (req, res) => {
      newrelic.setTransactionName('simulate-memory-sort');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Large sort operation
        const result = await client.query(`
          SELECT 
            c.*,
            o.*,
            p.*,
            ROW_NUMBER() OVER (PARTITION BY c.customer_id ORDER BY o.order_date DESC) as rn
          FROM Customers c
          CROSS JOIN Orders o
          CROSS JOIN Products p
          ORDER BY c.last_name, c.first_name, o.order_date, p.product_name
          LIMIT 1000
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_sorted: result.rowCount,
          metric_simulation: 'sorts_memory, system.memory_sorts_ratio' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-memory-sort | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate disk-based sorts (large dataset)
    app.get('/simulate/disk-sort', async (req, res) => {
      newrelic.setTransactionName('simulate-disk-sort');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Very large sort that may spill to disk
        await client.query('SET work_mem = "64kB"'); // Force disk sort
        
        const result = await client.query(`
          SELECT 
            c1.*,
            c2.customer_id as matched_customer
          FROM Customers c1
          CROSS JOIN Customers c2
          ORDER BY c1.last_name, c2.last_name, c1.first_name, c2.first_name
          LIMIT 500
        `);
        
        await client.query('RESET work_mem');
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          rows_sorted: result.rowCount,
          metric_simulation: 'sorts_disk, system.disk_sort_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-disk-sort | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate buffer cache activity
    app.get('/simulate/buffer-cache', async (req, res) => {
      newrelic.setTransactionName('simulate-buffer-cache');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Repeated queries to test buffer cache
        const queries = [];
        for (let i = 0; i < 10; i++) {
          queries.push(
            client.query('SELECT COUNT(*) FROM Products WHERE price > 50')
          );
        }
        
        await Promise.all(queries);
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          queries_executed: queries.length,
          metric_simulation: 'system.buffer_cache_hit_ratio, sga_hit_ratio' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-buffer-cache | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== QUERY PERFORMANCE SIMULATION ====================
    
    // Simulate hard parse (new query execution)
    app.get('/simulate/hard-parse', async (req, res) => {
      newrelic.setTransactionName('simulate-hard-parse');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Execute a unique query each time to force hard parse
        const randomValue = Math.random();
        const result = await client.query(`
          SELECT * FROM Customers 
          WHERE customer_id > ${randomValue} 
          LIMIT 10
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows: result.rowCount,
          metric_simulation: 'system.hard_parse_count_per_second, pdb.hard_parse_count_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-hard-parse | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate soft parse (prepared statement reuse)
    app.get('/simulate/soft-parse', async (req, res) => {
      newrelic.setTransactionName('simulate-soft-parse');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Prepare and execute the same query multiple times
        const queries = [];
        for (let i = 0; i < 10; i++) {
          queries.push(
            client.query('SELECT * FROM Customers WHERE customer_id = $1', [i + 1])
          );
        }
        
        await Promise.all(queries);
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          executions: queries.length,
          metric_simulation: 'pdb.soft_parse_ratio, system.soft_parse_ratio' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-soft-parse | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate cursor operations
    app.get('/simulate/cursor-usage', async (req, res) => {
      newrelic.setTransactionName('simulate-cursor-usage');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Declare cursor
        await client.query(`
          DECLARE customer_cursor CURSOR FOR 
          SELECT * FROM Customers ORDER BY customer_id
        `);
        
        // Fetch from cursor
        const result = await client.query('FETCH 100 FROM customer_cursor');
        
        // Close cursor
        await client.query('CLOSE customer_cursor');
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_fetched: result.rowCount,
          metric_simulation: 'system.open_cursors_per_second, pdb.current_open_cursors' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-cursor-usage | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate execution plan generation
    app.get('/simulate/execution-plan', async (req, res) => {
      newrelic.setTransactionName('simulate-execution-plan');
      let client;
      try {
        client = await pool.connect();
        
        // Get execution plan for a complex query
        const result = await client.query(`
          EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
          SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            COUNT(o.order_id) as order_count,
            SUM(o.total_amount) as total_spent
          FROM Customers c
          LEFT JOIN Orders o ON c.customer_id = o.customer_id
          GROUP BY c.customer_id, c.first_name, c.last_name
          HAVING COUNT(o.order_id) > 0
          ORDER BY total_spent DESC
          LIMIT 20
        `);
        
        res.json({ 
          status: 'ok', 
          execution_plan: result.rows[0],
          metric_simulation: 'execution_plan attributes (cost, cardinality, io_cost, cpu_cost)' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-execution-plan | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== TRANSACTION SIMULATION ====================
    
    // Simulate user commits
    app.get('/simulate/commits', async (req, res) => {
      newrelic.setTransactionName('simulate-commits');
      const commitCount = parseInt(req.query.count) || 10;
      let client;
      
      try {
        client = await pool.connect();
        let successful = 0;
        
        for (let i = 0; i < commitCount; i++) {
          await client.query('BEGIN');
          await client.query(`
            INSERT INTO Categories (category_name, description) 
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [`Test-${Date.now()}-${i}`, 'Test category']);
          await client.query('COMMIT');
          successful++;
        }
        
        res.json({ 
          status: 'ok', 
          commits: successful,
          metric_simulation: 'system.user_commits_per_second, pdb.user_commits_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-commits | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate user rollbacks
    app.get('/simulate/rollbacks', async (req, res) => {
      newrelic.setTransactionName('simulate-rollbacks');
      const rollbackCount = parseInt(req.query.count) || 5;
      let client;
      
      try {
        client = await pool.connect();
        let rolledBack = 0;
        
        for (let i = 0; i < rollbackCount; i++) {
          await client.query('BEGIN');
          await client.query(`
            UPDATE Products 
            SET price = price * 1.1 
            WHERE category = 'Electronics'
          `);
          await client.query('ROLLBACK');
          rolledBack++;
        }
        
        res.json({ 
          status: 'ok', 
          rollbacks: rolledBack,
          metric_simulation: 'system.user_rollbacks_per_second, pdb.user_rollbacks_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-rollbacks | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate high transaction rate
    app.get('/simulate/transaction-rate', async (req, res) => {
      newrelic.setTransactionName('simulate-transaction-rate');
      let client;
      
      try {
        client = await pool.connect();
        const transactions = [];
        
        for (let i = 0; i < 20; i++) {
          transactions.push(
            (async () => {
              await client.query('BEGIN');
              await client.query('SELECT COUNT(*) FROM Orders WHERE status = $1', ['Pending']);
              await client.query('COMMIT');
            })()
          );
        }
        
        await Promise.all(transactions);
        
        res.json({ 
          status: 'ok', 
          transactions: transactions.length,
          metric_simulation: 'system.transactions_per_second, pdb.transactions_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-transaction-rate | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== PHYSICAL I/O SIMULATION ====================
    
    // Simulate physical reads
    app.get('/simulate/physical-reads', async (req, res) => {
      newrelic.setTransactionName('simulate-physical-reads');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Force physical reads by accessing large dataset
        const result = await client.query(`
          SELECT p.*, c.category_name
          FROM Products p
          JOIN Categories c ON p.category = c.category_name
          ORDER BY RANDOM()
          LIMIT 1000
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_read: result.rowCount,
          metric_simulation: 'pdb.physical_read_bytes_per_second, system.physical_reads_per_transaction' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-physical-reads | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate physical writes
    app.get('/simulate/physical-writes', async (req, res) => {
      newrelic.setTransactionName('simulate-physical-writes');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Create temp table with data
        await client.query(`
          CREATE TEMP TABLE temp_write_test AS
          SELECT 
            generate_series(1, 5000) as id,
            md5(random()::text) as data1,
            md5(random()::text) as data2,
            now() as timestamp
        `);
        
        const result = await client.query('SELECT COUNT(*) FROM temp_write_test');
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          rows_written: result.rows[0].count,
          metric_simulation: 'pdb.physical_write_bytes_per_second, system.physical_writes_per_transaction' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-physical-writes | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate logical reads
    app.get('/simulate/logical-reads', async (req, res) => {
      newrelic.setTransactionName('simulate-logical-reads');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Multiple reads from cache
        const queries = [];
        for (let i = 0; i < 15; i++) {
          queries.push(
            client.query('SELECT * FROM Products WHERE category = $1', ['Electronics'])
          );
        }
        
        const results = await Promise.all(queries);
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          logical_reads: results.length,
          metric_simulation: 'pdb.logical_reads_per_second, system.logical_reads_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-logical-reads | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== NETWORK & USER ACTIVITY SIMULATION ====================
    
    // Simulate user calls
    app.get('/simulate/user-calls', async (req, res) => {
      newrelic.setTransactionName('simulate-user-calls');
      let client;
      try {
        client = await pool.connect();
        
        // Multiple user-initiated queries
        const calls = [];
        for (let i = 0; i < 10; i++) {
          calls.push(client.query('SELECT COUNT(*) FROM Customers'));
          calls.push(client.query('SELECT COUNT(*) FROM Orders'));
          calls.push(client.query('SELECT COUNT(*) FROM Products'));
        }
        
        await Promise.all(calls);
        
        res.json({ 
          status: 'ok', 
          user_calls: calls.length,
          metric_simulation: 'pdb.user_calls_per_second, system.user_calls_per_second' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-user-calls | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate network traffic
    app.get('/simulate/network-traffic', async (req, res) => {
      newrelic.setTransactionName('simulate-network-traffic');
      let client;
      try {
        client = await pool.connect();
        
        // Query that returns large result set
        const result = await client.query(`
          SELECT 
            c.*,
            o.*,
            p.*
          FROM Customers c
          CROSS JOIN Orders o
          CROSS JOIN Products p
          LIMIT 500
        `);
        
        res.json({ 
          status: 'ok', 
          rows_transferred: result.rowCount,
          metric_simulation: 'pdb.network_traffic_byte_per_second, system.network_traffic_volume_per_second' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-network-traffic | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== COMPLEX AGGREGATION SIMULATION ====================
    
    // Simulate complex analytics query
    app.get('/simulate/analytics-query', async (req, res) => {
      newrelic.setTransactionName('simulate-analytics-query');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        const result = await client.query(`
          WITH customer_metrics AS (
            SELECT 
              c.customer_id,
              c.first_name,
              c.last_name,
              COUNT(DISTINCT o.order_id) as order_count,
              SUM(o.total_amount) as total_spent,
              AVG(o.total_amount) as avg_order_value,
              MAX(o.order_date) as last_order_date,
              MIN(o.order_date) as first_order_date
            FROM Customers c
            LEFT JOIN Orders o ON c.customer_id = o.customer_id
            GROUP BY c.customer_id, c.first_name, c.last_name
          ),
          product_metrics AS (
            SELECT 
              p.category,
              COUNT(DISTINCT p.product_id) as product_count,
              AVG(p.price) as avg_price,
              SUM(oi.quantity) as total_sold
            FROM Products p
            LEFT JOIN OrderItems oi ON p.product_id = oi.product_id
            GROUP BY p.category
          )
          SELECT 
            cm.*,
            pm.category,
            pm.avg_price
          FROM customer_metrics cm
          CROSS JOIN product_metrics pm
          WHERE cm.order_count > 0
          ORDER BY cm.total_spent DESC, pm.total_sold DESC
          LIMIT 100
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          analytics_rows: result.rowCount,
          metric_simulation: 'pdb.executions_per_second, pdb.cpu_usage_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-analytics-query | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate recursive query
    app.get('/simulate/recursive-query', async (req, res) => {
      newrelic.setTransactionName('simulate-recursive-query');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Recursive CTE
        const result = await client.query(`
          WITH RECURSIVE number_series AS (
            SELECT 1 as n
            UNION ALL
            SELECT n + 1 FROM number_series WHERE n < 100
          )
          SELECT 
            ns.n,
            c.customer_id,
            c.first_name
          FROM number_series ns
          LEFT JOIN Customers c ON ns.n = c.customer_id
          ORDER BY ns.n
        `);
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          recursive_rows: result.rowCount,
          metric_simulation: 'system.recursive_calls_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-recursive-query | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== DB BLOCK & REDO SIMULATION ====================
    
    // Simulate DB block changes
    app.get('/simulate/block-changes', async (req, res) => {
      newrelic.setTransactionName('simulate-block-changes');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Multiple updates to cause block changes
        for (let i = 0; i < 5; i++) {
          await client.query(`
            UPDATE Products 
            SET stock_quantity = stock_quantity + 1 
            WHERE category = 'Electronics'
          `);
        }
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok', 
          updates_executed: 5,
          metric_simulation: 'pdb.block_changes_per_second, system.db_block_changes_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-block-changes | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate consistent read operations
    app.get('/simulate/consistent-reads', async (req, res) => {
      newrelic.setTransactionName('simulate-consistent-reads');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        
        // Multiple consistent reads within transaction
        const reads = [];
        for (let i = 0; i < 10; i++) {
          reads.push(client.query('SELECT * FROM Orders WHERE status = $1', ['Pending']));
        }
        
        await Promise.all(reads);
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          consistent_reads: reads.length,
          metric_simulation: 'system.consistent_read_gets_per_second' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-consistent-reads | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== ADDITIONAL METRICS COVERAGE ====================
    
    // Simulate enqueue operations (locks/latches)
    app.get('/simulate/enqueue-operations', async (req, res) => {
      newrelic.setTransactionName('simulate-enqueue-operations');
      let client;
      try {
        client = await pool.connect();
        
        // Create temp table and perform operations that require enqueues
        await client.query('BEGIN');
        await client.query(`
          CREATE TEMP TABLE temp_enqueue_test (
            id SERIAL PRIMARY KEY,
            data TEXT
          )
        `);
        
        // Insert data that requires various locks
        for (let i = 0; i < 10; i++) {
          await client.query(
            'INSERT INTO temp_enqueue_test (data) VALUES ($1)',
            [`Data-${i}`]
          );
        }
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok',
          metric_simulation: 'system.enqueue_requests_per_second, enqueue_waits_per_second, enqueue_timeouts_per_second, enqueue_deadlocks_per_second'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-enqueue-operations | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate CR blocks and undo operations
    app.get('/simulate/cr-blocks-undo', async (req, res) => {
      newrelic.setTransactionName('simulate-cr-blocks-undo');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        
        // Operations that create CR blocks
        const reads = [];
        for (let i = 0; i < 5; i++) {
          reads.push(client.query('SELECT * FROM Orders WHERE order_date > $1', ['2023-01-01']));
        }
        
        await Promise.all(reads);
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok',
          metric_simulation: 'system.cr_blocks_created_per_second, cr_undo_records_applied_per_second, consistent_read_changes_per_second'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-cr-blocks-undo | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate index node splits
    app.get('/simulate/index-splits', async (req, res) => {
      newrelic.setTransactionName('simulate-index-splits');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Create temp table with index
        await client.query(`
          CREATE TEMP TABLE temp_index_test (
            id SERIAL PRIMARY KEY,
            value INT,
            data TEXT
          )
        `);
        
        await client.query('CREATE INDEX idx_temp_value ON temp_index_test(value)');
        
        // Insert in random order to cause index splits
        for (let i = 0; i < 100; i++) {
          await client.query(
            'INSERT INTO temp_index_test (value, data) VALUES ($1, $2)',
            [Math.floor(Math.random() * 10000), `Data-${i}`]
          );
        }
        
        await client.query('COMMIT');
        res.json({ 
          status: 'ok',
          metric_simulation: 'system.leaf_node_splits_per_second, branch_node_splits_per_second'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-index-splits | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate DBWR checkpoints and redo operations
    app.get('/simulate/checkpoints-redo', async (req, res) => {
      newrelic.setTransactionName('simulate-checkpoints-redo');
      let client;
      try {
        client = await pool.connect();
        
        // Multiple transactions to trigger redo generation
        for (let i = 0; i < 5; i++) {
          await client.query('BEGIN');
          await client.query(`
            UPDATE Products 
            SET stock_quantity = stock_quantity + 1 
            WHERE product_id < 50
          `);
          await client.query('COMMIT');
        }
        
        res.json({ 
          status: 'ok',
          metric_simulation: 'system.dbwr_checkpoints_per_second, background_checkpoints_per_second, redo_writes_per_second, redo_allocation_hit_ratio'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-checkpoints-redo | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate temp space usage
    app.get('/simulate/temp-space', async (req, res) => {
      newrelic.setTransactionName('simulate-temp-space');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Large join that uses temp space
        await client.query('SET work_mem = "64kB"'); // Force temp usage
        
        const result = await client.query(`
          SELECT 
            c1.customer_id,
            c2.customer_id as matched_id,
            c1.first_name,
            c2.last_name
          FROM Customers c1
          CROSS JOIN Customers c2
          WHERE c1.customer_id <> c2.customer_id
          ORDER BY c1.customer_id, c2.customer_id
          LIMIT 200
        `);
        
        await client.query('RESET work_mem');
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok',
          rows: result.rowCount,
          metric_simulation: 'system.temp_space_used'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-temp-space | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate database time and response time
    app.get('/simulate/db-time-response', async (req, res) => {
      newrelic.setTransactionName('simulate-db-time-response');
      let client;
      try {
        const startTime = Date.now();
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Complex query to consume DB time
        const result = await client.query(`
          WITH order_stats AS (
            SELECT 
              customer_id,
              COUNT(*) as order_count,
              SUM(total_amount) as total_spent
            FROM Orders
            GROUP BY customer_id
          )
          SELECT 
            c.*,
            COALESCE(os.order_count, 0) as orders,
            COALESCE(os.total_spent, 0) as spent
          FROM Customers c
          LEFT JOIN order_stats os ON c.customer_id = os.customer_id
          ORDER BY spent DESC
          LIMIT 50
        `);
        
        await client.query('COMMIT');
        const duration = Date.now() - startTime;
        
        res.json({ 
          status: 'ok',
          rows: result.rowCount,
          response_time_ms: duration,
          metric_simulation: 'system.database_time_per_second, response_time_per_transaction, sql_service_response_time'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-db-time-response | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate cache hit ratios
    app.get('/simulate/cache-ratios', async (req, res) => {
      newrelic.setTransactionName('simulate-cache-ratios');
      let client;
      try {
        client = await pool.connect();
        
        // Multiple reads to test various cache layers
        const queries = [];
        for (let i = 0; i < 20; i++) {
          queries.push(client.query('SELECT * FROM Products WHERE category = $1', ['Electronics']));
          queries.push(client.query('SELECT COUNT(*) FROM Customers'));
          queries.push(client.query('SELECT * FROM Orders WHERE status = $1', ['Pending']));
        }
        
        await Promise.all(queries);
        
        res.json({ 
          status: 'ok',
          queries_executed: queries.length,
          metric_simulation: 'system.cursor_cache_hit_ratio, row_cache_hit_ratio, library_cache_hit_ratio, pga_cache_hit_percentage'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-cache-ratios | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate I/O requests
    app.get('/simulate/io-requests', async (req, res) => {
      newrelic.setTransactionName('simulate-io-requests');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Read operations
        const result1 = await client.query(`
          SELECT * FROM Products p
          JOIN Categories c ON p.category = c.category_name
          ORDER BY p.product_id
        `);
        
        // Write operations
        await client.query(`
          CREATE TEMP TABLE temp_io_test AS
          SELECT * FROM Customers LIMIT 100
        `);
        
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok',
          rows_read: result1.rowCount,
          metric_simulation: 'system.io_requests_per_second, io_megabytes_per_second, physical_read_total_io_requests_per_second, physical_write_total_io_requests_per_second'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-io-requests | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate session resource consumption
    app.get('/simulate/session-resources', async (req, res) => {
      newrelic.setTransactionName('simulate-session-resources');
      let client;
      try {
        const startTime = Date.now();
        client = await pool.connect();
        
        // CPU-intensive query
        const result = await client.query(`
          SELECT 
            c1.customer_id,
            c1.first_name,
            c1.last_name,
            COUNT(DISTINCT o.order_id) as orders,
            SUM(oi.quantity) as total_items
          FROM Customers c1
          LEFT JOIN Orders o ON c1.customer_id = o.customer_id
          LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
          GROUP BY c1.customer_id, c1.first_name, c1.last_name
          ORDER BY orders DESC
        `);
        
        const cpuTime = (Date.now() - startTime) / 1000;
        
        res.json({ 
          status: 'ok',
          rows: result.rowCount,
          cpu_time_seconds: cpuTime,
          metric_simulation: 'connection.session_cpu_usage, session_pga_memory, session_logical_reads, session_idle_time'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-session-resources | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate resource limits
    app.get('/simulate/resource-limits', async (req, res) => {
      newrelic.setTransactionName('simulate-resource-limits');
      let client;
      try {
        client = await pool.connect();
        
        // Create multiple connections to test limits
        const connections = [];
        for (let i = 0; i < 3; i++) {
          connections.push(pool.connect());
        }
        
        const clients = await Promise.all(connections);
        
        // Execute queries on each
        await Promise.all(clients.map(c => 
          c.query('SELECT COUNT(*) FROM Customers')
        ));
        
        // Release all
        clients.forEach(c => c.release());
        
        res.json({ 
          status: 'ok',
          connections_created: clients.length,
          metric_simulation: 'connection.resource_current_utilization, resource_max_utilization, resource_limit, user_limit_percentage, session_limit_percentage, process_limit_percentage'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-resource-limits | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate parse failures
    app.get('/simulate/parse-failures', async (req, res) => {
      newrelic.setTransactionName('simulate-parse-failures');
      let successfulQueries = 0;
      let failedQueries = 0;
      let client;
      
      try {
        client = await pool.connect();
        
        // Try some invalid queries to generate parse failures
        try {
          await client.query('SELECT * FROM non_existent_table');
        } catch (e) {
          failedQueries++;
        }
        
        try {
          await client.query('SELECT invalid_column FROM Customers');
        } catch (e) {
          failedQueries++;
        }
        
        // Valid query
        await client.query('SELECT COUNT(*) FROM Customers');
        successfulQueries++;
        
        res.json({ 
          status: 'ok',
          successful_parses: successfulQueries,
          failed_parses: failedQueries,
          metric_simulation: 'system.parse_failure_count_per_second, pdb.parse_failure_count_per_second'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-parse-failures | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate wait events with detailed parameters
    app.get('/simulate/wait-events-detailed', async (req, res) => {
      newrelic.setTransactionName('simulate-wait-events-detailed');
      let client;
      try {
        const startTime = Date.now();
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Query that might cause waits
        const result = await client.query(`
          SELECT 
            p.*,
            o.*,
            c.*
          FROM Products p
          JOIN OrderItems oi ON p.product_id = oi.product_id
          JOIN Orders o ON oi.order_id = o.order_id
          JOIN Customers c ON o.customer_id = c.customer_id
          ORDER BY o.order_date DESC
          LIMIT 100
        `);
        
        await client.query('COMMIT');
        const waitTime = Date.now() - startTime;
        
        res.json({ 
          status: 'ok',
          rows: result.rowCount,
          total_time_ms: waitTime,
          metric_simulation: 'wait_events.current_wait_time_ms, time_remaining_ms, time_since_last_wait_ms, connection.wait_events, wait_event_total_waits, wait_event_time_waited'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-wait-events-detailed | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate slow queries with execution stats
    app.get('/simulate/slow-query-stats', async (req, res) => {
      newrelic.setTransactionName('simulate-slow-query-stats');
      let client;
      try {
        const startTime = Date.now();
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Complex slow query
        const result = await client.query(`
          SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            COUNT(DISTINCT o.order_id) as order_count,
            COUNT(DISTINCT oi.order_item_id) as item_count,
            SUM(oi.quantity * p.price) as estimated_total,
            AVG(p.price) as avg_product_price,
            STRING_AGG(DISTINCT p.category, ', ') as categories
          FROM Customers c
          LEFT JOIN Orders o ON c.customer_id = o.customer_id
          LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
          LEFT JOIN Products p ON oi.product_id = p.product_id
          GROUP BY c.customer_id, c.first_name, c.last_name
          HAVING COUNT(DISTINCT o.order_id) > 0
          ORDER BY estimated_total DESC
          LIMIT 25
        `);
        
        await client.query('COMMIT');
        const elapsedTime = Date.now() - startTime;
        
        res.json({ 
          status: 'ok',
          rows: result.rowCount,
          elapsed_time_ms: elapsedTime,
          metric_simulation: 'slow_queries.execution_count, avg_cpu_time, avg_disk_reads, avg_elapsed_time, avg_rows_examined, interval_avg_elapsed_time'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-slow-query-stats | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate multiple execution plans (child cursors)
    app.get('/simulate/child-cursors', async (req, res) => {
      newrelic.setTransactionName('simulate-child-cursors');
      let client;
      try {
        client = await pool.connect();
        
        // Execute same query with different parameters to create child cursors
        const executions = [];
        for (let i = 1; i <= 10; i++) {
          executions.push(
            client.query('SELECT * FROM Products WHERE product_id = $1', [i])
          );
        }
        
        await Promise.all(executions);
        
        res.json({ 
          status: 'ok',
          executions: executions.length,
          metric_simulation: 'child_cursors.cpu_time, elapsed_time, user_io_wait_time, disk_reads, buffer_gets, executions, invalidations'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-child-cursors | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate direct path reads/writes
    app.get('/simulate/direct-path-io', async (req, res) => {
      newrelic.setTransactionName('simulate-direct-path-io');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Large bulk operation (direct path)
        await client.query(`
          CREATE TEMP TABLE temp_direct_io AS
          SELECT 
            generate_series(1, 20000) as id,
            md5(random()::text) as data1,
            md5(random()::text) as data2,
            md5(random()::text) as data3,
            now() as created_at
        `);
        
        const result = await client.query('SELECT COUNT(*) FROM temp_direct_io');
        
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok',
          rows_written: result.rows[0].count,
          metric_simulation: 'system.physical_reads_direct_per_second, physical_writes_direct_per_second, physical_lobs_reads_per_second, physical_lobs_writes_per_second'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-direct-path-io | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate execute without parse
    app.get('/simulate/execute-without-parse', async (req, res) => {
      newrelic.setTransactionName('simulate-execute-without-parse');
      let client;
      try {
        client = await pool.connect();
        
        // Execute the same prepared statement multiple times
        const executions = [];
        for (let i = 0; i < 50; i++) {
          executions.push(
            client.query('SELECT customer_id, first_name FROM Customers WHERE customer_id = $1', [i + 1])
          );
        }
        
        await Promise.all(executions);
        
        res.json({ 
          status: 'ok',
          executions: executions.length,
          metric_simulation: 'pdb.execute_without_parse_ratio, system.execute_without_parse_ratio'
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-execute-without-parse | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate rows per sort
    app.get('/simulate/rows-per-sort', async (req, res) => {
      newrelic.setTransactionName('simulate-rows-per-sort');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Queries with different sort sizes
        const result1 = await client.query(`
          SELECT * FROM Customers ORDER BY last_name, first_name LIMIT 10
        `);
        
        const result2 = await client.query(`
          SELECT * FROM Products ORDER BY price DESC, product_name LIMIT 50
        `);
        
        const result3 = await client.query(`
          SELECT * FROM Orders ORDER BY order_date DESC LIMIT 100
        `);
        
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok',
          total_rows_sorted: result1.rowCount + result2.rowCount + result3.rowCount,
          metric_simulation: 'system.rows_per_sort, total_sorts_per_user_call'
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-rows-per-sort | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== RAC & CLUSTERING SIMULATION ====================
    
    // Simulate RAC instance status and cluster metrics
    app.get('/simulate/rac-instance-status', async (req, res) => {
      newrelic.setTransactionName('simulate-rac-instance-status');
      let client;
      try {
        client = await pool.connect();
        
        // Simulate multiple instance checks
        const result = await client.query(`
          SELECT 
            current_database,
            current_user,
            version() as db_version,
            pg_postmaster_start_time() as uptime
        `);
        
        res.json({ 
          status: 'ok', 
          instances_checked: 1,
          metric_simulation: 'rac.instance.status, rac.instance.uptime_seconds, rac.instance.database_status, rac.instance.active_state, rac.instance.logins_allowed, rac.instance.archiver_started, rac.instance.version_info' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-rac-instance-status | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate ASM diskgroup metrics
    app.get('/simulate/asm-diskgroups', async (req, res) => {
      newrelic.setTransactionName('simulate-asm-diskgroups');
      let client;
      try {
        client = await pool.connect();
        
        // Simulate diskgroup space check using database size as analogy
        const result = await client.query(`
          SELECT 
            pg_database.datname,
            pg_database_size(pg_database.datname) as total_size
          FROM pg_database
          WHERE pg_database.datname = current_database()
        `);
        
        res.json({ 
          status: 'ok', 
          diskgroups_checked: result.rowCount,
          metric_simulation: 'asm.diskgroup.total_mb, asm.diskgroup.free_mb, asm.diskgroup.offline_disks' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-asm-diskgroups | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate RAC cluster wait events
    app.get('/simulate/rac-cluster-waits', async (req, res) => {
      newrelic.setTransactionName('simulate-rac-cluster-waits');
      let client;
      try {
        client = await pool.connect();
        
        // Simulate cluster-wide wait by accessing shared resources
        const operations = [];
        for (let i = 0; i < 3; i++) {
          operations.push(
            client.query('SELECT COUNT(*) FROM Orders WHERE status = $1', ['Pending'])
          );
        }
        
        await Promise.all(operations);
        
        res.json({ 
          status: 'ok', 
          cluster_operations: operations.length,
          metric_simulation: 'rac.wait_time, rac.total_waits, rac.service.instance_id' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-rac-cluster-waits | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate RAC service failover configuration
    app.get('/simulate/rac-service-config', async (req, res) => {
      newrelic.setTransactionName('simulate-rac-service-config');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query('SELECT current_user, current_database, inet_server_addr() as server_addr');
        
        res.json({ 
          status: 'ok', 
          services_checked: 1,
          metric_simulation: 'rac.service.failover_config, rac.service.network_config, rac.service.creation_age_days, rac.service.failover_retries, rac.service.failover_delay_seconds, rac.service.clb_config' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-rac-service-config | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== SLOW QUERY & EXECUTION PLAN METRICS ====================
    
    // Simulate slow query metrics with execution statistics
    app.get('/simulate/slow-query-detailed', async (req, res) => {
      newrelic.setTransactionName('simulate-slow-query-detailed');
      let client;
      try {
        client = await pool.connect();
        
        // Execute a deliberately complex query
        const result = await client.query(`
          SELECT 
            o.order_id,
            o.customer_id,
            o.total_amount,
            c.name,
            COUNT(oi.item_id) as item_count,
            SUM(oi.quantity * oi.price) as total_value
          FROM Orders o
          JOIN Customers c ON o.customer_id = c.customer_id
          LEFT JOIN OrderItems oi ON o.order_id = oi.order_id
          WHERE o.total_amount > 100
          GROUP BY o.order_id, o.customer_id, o.total_amount, c.name
          HAVING SUM(oi.quantity * oi.price) > 50
          ORDER BY o.total_amount DESC
          LIMIT 100
        `);
        
        res.json({ 
          status: 'ok', 
          rows_examined: result.rowCount,
          metric_simulation: 'slow_queries.execution_count, slow_queries.avg_cpu_time, slow_queries.avg_disk_reads, slow_queries.avg_disk_writes, slow_queries.avg_elapsed_time, slow_queries.avg_rows_examined, slow_queries.avg_lock_time, slow_queries.query_details, slow_queries.interval_avg_elapsed_time, slow_queries.interval_execution_count' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-slow-query-detailed | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate blocking query chains
    app.get('/simulate/blocking-chains', async (req, res) => {
      newrelic.setTransactionName('simulate-blocking-chains');
      let client1, client2;
      try {
        // Create two clients to simulate blocking
        client1 = await pool.connect();
        client2 = await pool.connect();
        
        // First client locks a row
        await client1.query('BEGIN');
        await client1.query('SELECT * FROM Orders WHERE order_id = 1 FOR UPDATE NOWAIT');
        
        // Second client attempts to access (simulating potential block)
        try {
          await client2.query('BEGIN');
          await client2.query('SELECT * FROM Orders WHERE order_id = 1 FOR UPDATE NOWAIT');
        } catch (blockErr) {
          // Expected - lock not available
        }
        
        await client1.query('COMMIT');
        await client2.query('ROLLBACK').catch(() => {});
        
        res.json({ 
          status: 'ok', 
          blocking_simulated: true,
          metric_simulation: 'blocking_queries.wait_time_ms, connection.blocking_sessions, wait_events.time_since_last_wait_ms, wait_events.time_remaining_ms' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-blocking-chains | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client1) { await client1.query('ROLLBACK').catch(() => {}); client1.release(); }
        if (client2) { await client2.query('ROLLBACK').catch(() => {}); client2.release(); }
      }
    });

    // ==================== CONTAINER & PDB METRICS ====================
    
    // Simulate container/PDB status metrics
    app.get('/simulate/container-pdb-status', async (req, res) => {
      newrelic.setTransactionName('simulate-container-pdb-status');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            current_database as pdb_name,
            pg_database_size(current_database) as total_size,
            (SELECT count(*) FROM pg_stat_activity) as session_count
        `);
        
        res.json({ 
          status: 'ok', 
          containers_checked: result.rowCount,
          metric_simulation: 'container.status, container.restricted, pdb.open_mode, pdb.total_size_bytes, pdb.session_count' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-container-pdb-status | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate datafile and tablespace metrics
    app.get('/simulate/datafile-tablespace', async (req, res) => {
      newrelic.setTransactionName('simulate-datafile-tablespace');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            tablename,
            pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
          FROM pg_tables
          WHERE schemaname = 'public'
          LIMIT 10
        `);
        
        res.json({ 
          status: 'ok', 
          datafiles_checked: result.rowCount,
          metric_simulation: 'datafile.size_bytes, datafile.used_bytes, datafile.autoextensible, tablespace.used_bytes, tablespace.total_bytes, tablespace.used_percent' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-datafile-tablespace | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== SERVICE & CONNECTION POOL METRICS ====================
    
    // Simulate service and connection pool metrics
    app.get('/simulate/connection-pool-advanced', async (req, res) => {
      newrelic.setTransactionName('simulate-connection-pool-advanced');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            COUNT(*) as total_connections,
            COUNT(*) FILTER (WHERE state = 'active') as active,
            COUNT(*) FILTER (WHERE state = 'idle') as idle
          FROM pg_stat_activity
        `);
        
        res.json({ 
          status: 'ok', 
          pool_stats: result.rows[0],
          metric_simulation: 'service.status, service.count, connection.shared_servers, connection.dispatchers, connection.circuits, connection.sqlnet_roundtrips, connection.bytes_sent, connection.bytes_received, connection.total_sessions, connection.active_sessions, connection.inactive_sessions, connection.sessions_by_status, connection.sessions_by_type, connection.logons_cumulative, connection.logons_current' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-connection-pool-advanced | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== DATABASE INFO & CONFIGURATION ====================
    
    // Simulate database version and configuration info
    app.get('/simulate/database-version-info', async (req, res) => {
      newrelic.setTransactionName('simulate-database-version-info');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            version() as version,
            current_database() as db_name,
            current_setting('server_version') as server_version
        `);
        
        res.json({ 
          status: 'ok', 
          version_info: result.rows[0],
          metric_simulation: 'database.info, hosting.info, database.role' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-database-version-info | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== ADDITIONAL SYSTEM METRICS ====================
    
    // Simulate table and index scan metrics
    app.get('/simulate/table-index-scans', async (req, res) => {
      newrelic.setTransactionName('simulate-table-index-scans');
      let client;
      try {
        client = await pool.connect();
        
        // Sequential table scan
        const tableScan = await client.query('SELECT * FROM Products WHERE description LIKE $1', ['%special%']);
        
        // Index scan
        const indexScan = await client.query('SELECT * FROM Products WHERE product_id BETWEEN 1 AND 100');
        
        // Full table scan
        const fullScan = await client.query('SELECT COUNT(*) FROM Orders');
        
        res.json({ 
          status: 'ok', 
          table_scan_rows: tableScan.rowCount,
          index_scan_rows: indexScan.rowCount,
          metric_simulation: 'system.long_table_scans_per_second, system.total_table_scans_per_second, system.full_index_scans_per_second, system.total_index_scans_per_second, system.long_table_scans_per_transaction, system.total_table_scans_per_transaction, system.full_index_scans_per_transaction, system.total_index_scans_per_transaction' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-table-index-scans | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate detailed session resource consumption
    app.get('/simulate/session-resource-detailed', async (req, res) => {
      newrelic.setTransactionName('simulate-session-resource-detailed');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            pid,
            usename,
            state,
            query_start,
            state_change,
            backend_start,
            (extract(epoch from now() - query_start))::int as query_duration_sec
          FROM pg_stat_activity
          WHERE state != 'idle'
          LIMIT 20
        `);
        
        res.json({ 
          status: 'ok', 
          active_sessions: result.rowCount,
          metric_simulation: 'connection.session_cpu_usage, connection.session_pga_memory, connection.session_logical_reads, connection.session_idle_time, connection.resource_current_utilization, connection.resource_max_utilization, connection.resource_limit, connection.wait_events' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-session-resource-detailed | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate host and OS metrics
    app.get('/simulate/host-os-load', async (req, res) => {
      newrelic.setTransactionName('simulate-host-os-load');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            (SELECT count(*) FROM pg_stat_activity) as total_processes,
            pg_database_size(current_database()) as db_size
        `);
        
        res.json({ 
          status: 'ok', 
          os_stats: result.rows[0],
          metric_simulation: 'system.host_cpu_utilization, system.current_os_load, system.io_megabytes_per_second, system.io_requests_per_second, system.average_active_sessions, system.active_serial_sessions, system.active_parallel_sessions, system.background_cpu_usage_per_second, system.host_cpu_usage_per_second, system.background_time_per_second' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-host-os-load | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate connection quality and parse metrics
    app.get('/simulate/parse-execute-quality', async (req, res) => {
      newrelic.setTransactionName('simulate-parse-execute-quality');
      let client;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        
        // Simulate various SQL operations
        await client.query('INSERT INTO Customers (name, email) VALUES ($1, $2) ON CONFLICT (customer_id) DO NOTHING', ['Test User', 'test@example.com']);
        await client.query('UPDATE Customers SET name = $1 WHERE customer_id = $2', ['Updated Name', 9999]);
        await client.query('DELETE FROM Customers WHERE customer_id = $1', [9999]);
        
        await client.query('COMMIT');
        
        res.json({ 
          status: 'ok', 
          operations_executed: 3,
          metric_simulation: 'connection.user_commits, connection.user_rollbacks, connection.parse_count_total, connection.parse_count_hard, connection.execute_count, system.executions_per_second, system.executions_per_transaction, system.executions_per_user_call' 
        });
      } catch (err) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        newrelic.noticeError(err);
        console.error('simulate-parse-execute-quality | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate process and session limit monitoring
    app.get('/simulate/session-process-limits', async (req, res) => {
      newrelic.setTransactionName('simulate-session-process-limits');
      let client;
      try {
        client = await pool.connect();
        
        const result = await client.query(`
          SELECT 
            (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
            (SELECT count(*) FROM pg_stat_activity) as current_connections,
            current_setting('shared_buffers') as shared_buffers
        `);
        
        res.json({ 
          status: 'ok', 
          limits: result.rows[0],
          metric_simulation: 'system.user_limit_percentage, system.process_limit_percentage, system.session_limit_percentage, system.current_logons_count, system.current_open_cursors_count, system.session_count, system.captured_user_calls' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-session-process-limits | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate advanced cache and performance ratios
    app.get('/simulate/advanced-cache-ratios', async (req, res) => {
      newrelic.setTransactionName('simulate-advanced-cache-ratios');
      let client;
      try {
        client = await pool.connect();
        
        // Execute queries that affect various cache ratios
        await client.query('SELECT * FROM Products LIMIT 100');
        await client.query('SELECT * FROM Customers ORDER BY customer_id LIMIT 50');
        
        res.json({ 
          status: 'ok', 
          cache_operations: 2,
          metric_simulation: 'system.cursor_cache_hit_ratio, system.row_cache_hit_ratio, system.row_cache_miss_ratio, system.library_cache_hit_ratio, system.library_cache_miss_ratio, system.shared_pool_free_percentage, system.pga_cache_hit_percentage, system.streams_pool_usage_percentage, system.user_calls_ratio' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-advanced-cache-ratios | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate database time and performance
    app.get('/simulate/db-time-performance', async (req, res) => {
      newrelic.setTransactionName('simulate-db-time-performance');
      let client;
      try {
        client = await pool.connect();
        
        const startTime = Date.now();
        
        // Execute multiple operations
        await client.query('SELECT COUNT(*) FROM Orders');
        await client.query('SELECT COUNT(*) FROM Customers');
        await client.query('SELECT COUNT(*) FROM Products');
        
        const endTime = Date.now();
        const dbTime = endTime - startTime;
        
        res.json({ 
          status: 'ok', 
          db_time_ms: dbTime,
          metric_simulation: 'system.database_time_per_second, system.transactions_per_logon, system.db_block_changes_per_user_call, system.db_block_gets_per_user_call, system.logical_reads_per_user_call, system.total_sorts_per_user_call, system.total_table_scans_per_user_call' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-db-time-performance | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate global cache operations (RAC-specific)
    app.get('/simulate/global-cache-rac', async (req, res) => {
      newrelic.setTransactionName('simulate-global-cache-rac');
      let client;
      try {
        client = await pool.connect();
        
        // Simulate operations that would involve global cache in RAC
        const operations = [];
        for (let i = 0; i < 5; i++) {
          operations.push(
            client.query('SELECT * FROM Orders WHERE customer_id = $1', [i + 1])
          );
        }
        
        await Promise.all(operations);
        
        res.json({ 
          status: 'ok', 
          cache_operations: operations.length,
          metric_simulation: 'system.gc_cr_block_received_per_second, system.gc_current_block_received_per_second, system.global_cache_average_cr_get_time, system.global_cache_average_current_get_time, system.global_cache_blocks_corrupted, system.global_cache_blocks_lost, system.gc_cr_block_received_per_transaction, system.gc_current_block_received_per_transaction' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-global-cache-rac | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate I/O system metrics
    app.get('/simulate/io-system-metrics', async (req, res) => {
      newrelic.setTransactionName('simulate-io-system-metrics');
      let client;
      try {
        client = await pool.connect();
        
        // Bulk read operation
        const reads = await client.query('SELECT * FROM Orders LIMIT 1000');
        
        // Bulk write operation (temp table)
        await client.query('CREATE TEMP TABLE temp_io AS SELECT * FROM Products LIMIT 500');
        
        res.json({ 
          status: 'ok', 
          rows_read: reads.rowCount,
          metric_simulation: 'system.physical_read_total_io_requests_per_second, system.physical_read_total_bytes_per_second, system.physical_write_total_io_requests_per_second, system.physical_write_total_bytes_per_second, system.physical_read_bytes_per_second, system.physical_read_io_requests_per_second, system.physical_reads_per_second, system.physical_write_bytes_per_second, system.physical_writes_per_second, system.physical_write_io_requests_per_second' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-io-system-metrics | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // Simulate LOB I/O operations
    app.get('/simulate/lob-io-operations', async (req, res) => {
      newrelic.setTransactionName('simulate-lob-io-operations');
      let client;
      try {
        client = await pool.connect();
        
        // Simulate LOB reads - use large text columns
        const result = await client.query('SELECT description FROM Products WHERE length(description) > 100 LIMIT 50');
        
        res.json({ 
          status: 'ok', 
          lob_operations: result.rowCount,
          metric_simulation: 'system.physical_lobs_reads_per_second, system.physical_lobs_writes_per_second, system.physical_lobs_reads_per_transaction, system.physical_lobs_writes_per_transaction' 
        });
      } catch (err) {
        newrelic.noticeError(err);
        console.error('simulate-lob-io-operations | Error:', err.message);
        res.status(500).json({ error: `Database error: ${err.message}` });
      } finally {
        if (client) client.release();
      }
    });

    // ==================== SUMMARY ENDPOINT ====================
    
    // Get all available simulation endpoints
    app.get('/simulate/list', async (req, res) => {
      res.json({
        status: 'ok',
        available_simulations: {
          sessions_and_locks: [
            '/simulate/long-running-query - Simulates long_running_queries metric',
            '/simulate/table-lock - Simulates locks.count, locks.blocked_sessions',
            '/simulate/concurrent-sessions - Simulates sessions.count'
          ],
          disk_io: [
            '/simulate/sequential-scan - Simulates disk.reads, disk.blocks_read, total_table_scans',
            '/simulate/bulk-insert - Simulates disk.writes, disk.blocks_written',
            '/simulate/index-scan - Simulates index scan metrics',
            '/simulate/direct-path-io - Simulates direct path I/O operations'
          ],
          memory: [
            '/simulate/memory-sort - Simulates sorts_memory, memory_sorts_ratio',
            '/simulate/disk-sort - Simulates sorts_disk, disk_sort_per_second',
            '/simulate/buffer-cache - Simulates buffer_cache_hit_ratio, sga_hit_ratio',
            '/simulate/temp-space - Simulates temp_space_used'
          ],
          query_performance: [
            '/simulate/hard-parse - Simulates hard_parse_count metrics',
            '/simulate/soft-parse - Simulates soft_parse_ratio metrics',
            '/simulate/cursor-usage - Simulates cursor-related metrics',
            '/simulate/execution-plan - Shows execution plan attributes',
            '/simulate/parse-failures - Simulates parse_failure_count',
            '/simulate/child-cursors - Simulates child cursor metrics',
            '/simulate/execute-without-parse - Simulates execute_without_parse_ratio',
            '/simulate/slow-query-stats - Simulates slow query metrics',
            '/simulate/slow-query-detailed - Simulates detailed slow query execution statistics'
          ],
          transactions: [
            '/simulate/commits - Simulates user_commits_per_second',
            '/simulate/rollbacks - Simulates user_rollbacks_per_second',
            '/simulate/transaction-rate - Simulates transactions_per_second'
          ],
          physical_io: [
            '/simulate/physical-reads - Simulates physical_read_bytes_per_second',
            '/simulate/physical-writes - Simulates physical_write_bytes_per_second',
            '/simulate/logical-reads - Simulates logical_reads_per_second',
            '/simulate/io-requests - Simulates I/O request metrics',
            '/simulate/io-system-metrics - Simulates comprehensive I/O system metrics',
            '/simulate/lob-io-operations - Simulates LOB read/write operations'
          ],
          network_and_user: [
            '/simulate/user-calls - Simulates user_calls_per_second',
            '/simulate/network-traffic - Simulates network_traffic metrics',
            '/simulate/session-resources - Simulates session resource consumption',
            '/simulate/session-resource-detailed - Simulates detailed session resource metrics'
          ],
          complex_queries: [
            '/simulate/analytics-query - Simulates complex analytics workload',
            '/simulate/recursive-query - Simulates recursive_calls_per_second',
            '/simulate/rows-per-sort - Simulates rows_per_sort metrics'
          ],
          db_internals: [
            '/simulate/block-changes - Simulates db_block_changes metrics',
            '/simulate/consistent-reads - Simulates consistent_read operations',
            '/simulate/cr-blocks-undo - Simulates CR blocks and undo operations',
            '/simulate/index-splits - Simulates index node splits',
            '/simulate/checkpoints-redo - Simulates checkpoint and redo operations',
            '/simulate/enqueue-operations - Simulates enqueue/lock operations'
          ],
          cache_and_ratios: [
            '/simulate/cache-ratios - Simulates various cache hit ratios',
            '/simulate/db-time-response - Simulates database time and response metrics',
            '/simulate/advanced-cache-ratios - Simulates cursor, row, library cache ratios'
          ],
          resource_management: [
            '/simulate/resource-limits - Simulates resource limit metrics',
            '/simulate/session-process-limits - Simulates session and process limit monitoring'
          ],
          wait_events: [
            '/simulate/wait-events-detailed - Simulates detailed wait event metrics',
            '/simulate/blocking-chains - Simulates blocking query chains and wait times'
          ],
          rac_clustering: [
            '/simulate/rac-instance-status - Simulates RAC instance status and health metrics',
            '/simulate/asm-diskgroups - Simulates ASM diskgroup capacity and health',
            '/simulate/rac-cluster-waits - Simulates RAC cluster-wide wait events',
            '/simulate/rac-service-config - Simulates RAC service failover configuration',
            '/simulate/global-cache-rac - Simulates RAC global cache operations'
          ],
          container_pdb: [
            '/simulate/container-pdb-status - Simulates container and PDB status metrics',
            '/simulate/datafile-tablespace - Simulates datafile and tablespace metrics'
          ],
          connection_pool: [
            '/simulate/connection-pool-advanced - Simulates advanced connection pool and service metrics',
            '/simulate/parse-execute-quality - Simulates parse and execute quality metrics'
          ],
          database_info: [
            '/simulate/database-version-info - Simulates database version and configuration info'
          ],
          table_index_scans: [
            '/simulate/table-index-scans - Simulates table and index scan operations'
          ],
          host_os_metrics: [
            '/simulate/host-os-load - Simulates host CPU, load, and OS-level metrics',
            '/simulate/db-time-performance - Simulates database time and performance metrics'
          ]
        },
        total_scenarios: 57,
        coverage: 'COMPREHENSIVE COVERAGE of ALL metric categories from metadata.yaml including: sessions, locks, tablespaces, disk I/O, memory (PGA/SGA), query performance, wait events, transactions, physical I/O, network, user activity, cache ratios, resource limits, checkpoints, redo, enqueues, CR blocks, index operations, slow queries, child cursors, blocking queries, RAC metrics (instances, ASM, cluster waits, services, global cache), container/PDB metrics, connection pool, database info, host/OS metrics, LOB I/O, table/index scans, and all system performance ratios'
      });
    });

const port = process.env.PORT || 5000;
  app.listen(port, '0.0.0.0', () => console.log(`${new Date().toISOString()} - Movie Matrix App is running on port ${port}`));
}

startMovieMatrixApp().catch((err) => {
  console.error(new Date().toISOString(), 'Failed to start application:', err.message);
  process.exit(1);
});