// HR Schema Workload Simulator
// Purpose: Simulates real-world database workload to generate conditions monitored by newrelicoraclereceiver
// - Generates slow queries with high avg_elapsed_time_ms in v$sqlarea
// - Creates wait events (I/O, locking, concurrency waits)
// - Produces blocking sessions (session A locks, session B waits)
// - Generates child cursors with different execution plans

package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	_ "github.com/godror/godror"
)

// Config holds database connection and workload parameters
type Config struct {
	// Database connection
	User          string
	Password      string
	ConnectString string

	// Workload parameters
	Duration           time.Duration
	SlowQueryWorkers   int
	BlockingWorkers    int
	IOWorkers          int
	ChildCursorWorkers int
	ConcurrencyWorkers int
}

// WorkloadStats tracks execution statistics
type WorkloadStats struct {
	mu                    sync.Mutex
	SlowQueriesRun        int
	BlockingEventsCreated int
	IOQueriesRun          int
	ChildCursorsCreated   int
	WaitEventsGenerated   int
	Errors                int
}

func (ws *WorkloadStats) IncrementSlowQueries() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.SlowQueriesRun++
}

func (ws *WorkloadStats) IncrementBlockingEvents() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.BlockingEventsCreated++
}

func (ws *WorkloadStats) IncrementIOQueries() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.IOQueriesRun++
}

func (ws *WorkloadStats) IncrementChildCursors() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.ChildCursorsCreated++
}

func (ws *WorkloadStats) IncrementWaitEvents() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.WaitEventsGenerated++
}

func (ws *WorkloadStats) IncrementErrors() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.Errors++
}

func (ws *WorkloadStats) Print() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	fmt.Printf("\n=== Workload Statistics ===\n")
	fmt.Printf("Slow Queries Run:         %d\n", ws.SlowQueriesRun)
	fmt.Printf("Blocking Events Created:  %d\n", ws.BlockingEventsCreated)
	fmt.Printf("I/O Intensive Queries:    %d\n", ws.IOQueriesRun)
	fmt.Printf("Child Cursors Generated:  %d\n", ws.ChildCursorsCreated)
	fmt.Printf("Wait Events Generated:    %d\n", ws.WaitEventsGenerated)
	fmt.Printf("Errors:                   %d\n", ws.Errors)
	fmt.Printf("===========================\n\n")
}

func main() {
	// Command line flags
	var (
		user          = flag.String("user", getEnv("ORACLE_USER", "hr"), "Oracle username")
		password      = flag.String("password", getEnv("ORACLE_PASSWORD", ""), "Oracle password")
		connectString = flag.String("connect", getEnv("ORACLE_CONNECT_STRING", ""), "Oracle connect string (host:port/service)")
		duration      = flag.Duration("duration", 5*time.Minute, "Duration to run workload (e.g., 5m, 10m, 1h)")
		slowWorkers   = flag.Int("slow-workers", 2, "Number of slow query workers")
		blockWorkers  = flag.Int("block-workers", 3, "Number of blocking scenario workers")
		ioWorkers     = flag.Int("io-workers", 2, "Number of I/O intensive workers")
		childWorkers  = flag.Int("child-workers", 2, "Number of child cursor workers")
		concurrency   = flag.Int("concurrency-workers", 2, "Number of concurrency wait workers")
	)
	flag.Parse()

	if *password == "" || *connectString == "" {
		log.Fatal("ERROR: Oracle password and connect string are required\n" +
			"Usage: ./hr-workload-simulator -password <password> -connect <host:port/service>\n" +
			"Or set ORACLE_PASSWORD and ORACLE_CONNECT_STRING environment variables")
	}

	config := Config{
		User:               *user,
		Password:           *password,
		ConnectString:      *connectString,
		Duration:           *duration,
		SlowQueryWorkers:   *slowWorkers,
		BlockingWorkers:    *blockWorkers,
		IOWorkers:          *ioWorkers,
		ChildCursorWorkers: *childWorkers,
		ConcurrencyWorkers: *concurrency,
	}

	fmt.Printf("\n=== HR Workload Simulator ===\n")
	fmt.Printf("Database: %s@%s\n", config.User, config.ConnectString)
	fmt.Printf("Duration: %v\n", config.Duration)
	fmt.Printf("Workers: Slow=%d, Blocking=%d, I/O=%d, ChildCursor=%d, Concurrency=%d\n",
		config.SlowQueryWorkers, config.BlockingWorkers, config.IOWorkers,
		config.ChildCursorWorkers, config.ConcurrencyWorkers)
	fmt.Printf("==============================\n\n")

	// Create database connection pool
	dsn := fmt.Sprintf("%s/%s@%s", config.User, config.Password, config.ConnectString)
	db, err := sql.Open("godror", dsn)
	if err != nil {
		log.Fatalf("Failed to create database connection: %v", err)
	}
	defer db.Close()

	// Configure connection pool
	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Test connection
	ctx := context.Background()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	fmt.Println("✓ Database connection successful")

	// Verify HR schema tables
	if err := verifyHRSchema(ctx, db); err != nil {
		log.Fatalf("Failed to verify HR schema: %v", err)
	}
	fmt.Println("✓ HR schema verified")

	// Initialize statistics
	stats := &WorkloadStats{}

	// Create context with cancellation
	ctx, cancel := context.WithTimeout(context.Background(), config.Duration)
	defer cancel()

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	var wg sync.WaitGroup

	// Start workload generators
	fmt.Println("\n🚀 Starting workload generators...")

	// 1. Slow Query Workers - Generate queries with high avg_elapsed_time_ms
	for i := 0; i < config.SlowQueryWorkers; i++ {
		wg.Add(1)
		go slowQueryWorker(ctx, &wg, db, i, stats)
	}

	// 2. Blocking Workers - Create lock contention and blocking sessions
	for i := 0; i < config.BlockingWorkers; i++ {
		wg.Add(1)
		go blockingWorker(ctx, &wg, db, i, stats)
	}

	// 3. I/O Intensive Workers - Generate disk reads/writes
	for i := 0; i < config.IOWorkers; i++ {
		wg.Add(1)
		go ioIntensiveWorker(ctx, &wg, db, i, stats)
	}

	// 4. Child Cursor Workers - Create multiple execution plans for same SQL_ID
	for i := 0; i < config.ChildCursorWorkers; i++ {
		wg.Add(1)
		go childCursorWorker(ctx, &wg, db, i, stats)
	}

	// 5. Concurrency Wait Workers - Generate latch/enqueue waits
	for i := 0; i < config.ConcurrencyWorkers; i++ {
		wg.Add(1)
		go concurrencyWorker(ctx, &wg, db, i, stats)
	}

	// Statistics reporter
	wg.Add(1)
	go statsReporter(ctx, &wg, stats, 10*time.Second)

	// Wait for interrupt or timeout
	go func() {
		select {
		case <-sigChan:
			fmt.Println("\n⚠️  Interrupt received, shutting down...")
			cancel()
		case <-ctx.Done():
			fmt.Println("\n⏱️  Duration elapsed, shutting down...")
		}
	}()

	// Wait for all workers to finish
	wg.Wait()

	// Print final statistics
	fmt.Println("\n✅ Workload simulation completed")
	stats.Print()
}

// verifyHRSchema checks if required HR tables exist
func verifyHRSchema(ctx context.Context, db *sql.DB) error {
	tables := []string{"EMPLOYEES", "DEPARTMENTS", "JOBS", "LOCATIONS", "COUNTRIES", "REGIONS"}
	for _, table := range tables {
		var count int
		query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
		if err := db.QueryRowContext(ctx, query).Scan(&count); err != nil {
			return fmt.Errorf("table %s not accessible: %v", table, err)
		}
		fmt.Printf("  • %s: %d rows\n", table, count)
	}
	return nil
}

// slowQueryWorker generates CPU-intensive queries with high elapsed time
func slowQueryWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[SlowQuery-%d] Started", workerID)

	queries := []string{
		// Cartesian join - very slow, high CPU
		`SELECT /*+ NO_INDEX(e1) NO_INDEX(e2) */ 
		 e1.employee_id, e1.first_name, e2.employee_id, e2.first_name
		 FROM employees e1, employees e2 
		 WHERE e1.salary < e2.salary
		 AND ROWNUM <= 1000`,

		// Complex aggregation with multiple joins
		`SELECT /*+ USE_HASH(e d j l c r) */
		 d.department_name,
		 COUNT(DISTINCT e.employee_id) as emp_count,
		 AVG(e.salary) as avg_salary,
		 MAX(e.hire_date) as latest_hire,
		 c.country_name,
		 r.region_name
		 FROM employees e
		 JOIN departments d ON e.department_id = d.department_id
		 JOIN jobs j ON e.job_id = j.job_id
		 JOIN locations l ON d.location_id = l.location_id
		 JOIN countries c ON l.country_id = c.country_id
		 JOIN regions r ON c.region_id = r.region_id
		 GROUP BY d.department_name, c.country_name, r.region_name
		 ORDER BY avg_salary DESC`,

		// Recursive query with self-joins
		`SELECT e1.employee_id, e1.first_name, e1.last_name, e1.salary,
		 e2.first_name || ' ' || e2.last_name as manager_name,
		 e3.first_name || ' ' || e3.last_name as manager_manager_name
		 FROM employees e1
		 LEFT JOIN employees e2 ON e1.manager_id = e2.employee_id
		 LEFT JOIN employees e3 ON e2.manager_id = e3.employee_id
		 WHERE e1.salary > (SELECT AVG(salary) * 0.8 FROM employees)
		 ORDER BY e1.salary DESC`,

		// Complex analytical query
		`SELECT department_id, first_name, last_name, salary,
		 RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) as salary_rank,
		 LAG(salary) OVER (PARTITION BY department_id ORDER BY hire_date) as prev_salary,
		 LEAD(salary) OVER (PARTITION BY department_id ORDER BY hire_date) as next_salary,
		 AVG(salary) OVER (PARTITION BY department_id) as dept_avg_salary
		 FROM employees
		 WHERE department_id IS NOT NULL
		 ORDER BY department_id, salary_rank`,
	}

	for {
		select {
		case <-ctx.Done():
			log.Printf("[SlowQuery-%d] Stopped", workerID)
			return
		default:
			// Pick random query
			query := queries[rand.Intn(len(queries))]

			start := time.Now()
			rows, err := db.QueryContext(ctx, query)
			if err != nil {
				log.Printf("[SlowQuery-%d] Error: %v", workerID, err)
				stats.IncrementErrors()
				time.Sleep(2 * time.Second)
				continue
			}

			// Consume results to ensure full execution
			rowCount := 0
			for rows.Next() {
				rowCount++
			}
			rows.Close()

			elapsed := time.Since(start)
			log.Printf("[SlowQuery-%d] Query executed in %v (%d rows)", workerID, elapsed, rowCount)
			stats.IncrementSlowQueries()

			// Small delay between queries
			time.Sleep(time.Duration(rand.Intn(3000)) * time.Millisecond)
		}
	}
}

// blockingWorker creates blocking scenarios with row locks
func blockingWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[Blocking-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Blocking-%d] Stopped", workerID)
			return
		default:
			// Create blocking scenario
			if err := createBlockingScenario(ctx, db, workerID, stats); err != nil {
				log.Printf("[Blocking-%d] Error: %v", workerID, err)
				stats.IncrementErrors()
			}

			// Wait before next blocking scenario
			time.Sleep(time.Duration(5+rand.Intn(10)) * time.Second)
		}
	}
}

// createBlockingScenario simulates a blocking situation
func createBlockingScenario(ctx context.Context, db *sql.DB, workerID int, stats *WorkloadStats) error {
	// Get random employee IDs
	var emp1, emp2 int
	err := db.QueryRowContext(ctx,
		"SELECT employee_id FROM employees WHERE ROWNUM = 1 ORDER BY DBMS_RANDOM.VALUE").Scan(&emp1)
	if err != nil {
		return fmt.Errorf("failed to get employee 1: %v", err)
	}
	err = db.QueryRowContext(ctx,
		"SELECT employee_id FROM employees WHERE employee_id != :1 AND ROWNUM = 1 ORDER BY DBMS_RANDOM.VALUE", emp1).Scan(&emp2)
	if err != nil {
		return fmt.Errorf("failed to get employee 2: %v", err)
	}

	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	// Session 1: Lock first employee (blocker)
	wg.Add(1)
	go func() {
		defer wg.Done()

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- fmt.Errorf("blocker: failed to get connection: %v", err)
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- fmt.Errorf("blocker: failed to begin transaction: %v", err)
			return
		}
		defer tx.Rollback() // Always rollback to avoid permanent changes

		// Lock the row with SELECT FOR UPDATE
		var salary float64
		query := "SELECT salary FROM employees WHERE employee_id = :1 FOR UPDATE"
		err = tx.QueryRowContext(ctx, query, emp1).Scan(&salary)
		if err != nil {
			errChan <- fmt.Errorf("blocker: failed to lock row: %v", err)
			return
		}

		log.Printf("[Blocking-%d] 🔒 Session 1 locked employee %d (salary=%.2f)", workerID, emp1, salary)
		stats.IncrementWaitEvents()

		// Hold lock for 8-15 seconds to create blocking
		holdTime := time.Duration(8+rand.Intn(8)) * time.Second
		time.Sleep(holdTime)

		log.Printf("[Blocking-%d] 🔓 Session 1 releasing lock on employee %d after %v", workerID, emp1, holdTime)
	}()

	// Session 2: Try to lock same employee (blocked session) - starts after 2 seconds
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Wait for blocker to acquire lock
		time.Sleep(2 * time.Second)

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- fmt.Errorf("blocked: failed to get connection: %v", err)
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- fmt.Errorf("blocked: failed to begin transaction: %v", err)
			return
		}
		defer tx.Rollback()

		log.Printf("[Blocking-%d] ⏳ Session 2 attempting to lock employee %d (will block)...", workerID, emp1)

		// This will block until session 1 releases
		var salary float64
		query := "SELECT salary FROM employees WHERE employee_id = :1 FOR UPDATE"
		start := time.Now()
		err = tx.QueryRowContext(ctx, query, emp1).Scan(&salary)
		waitTime := time.Since(start)

		if err != nil {
			errChan <- fmt.Errorf("blocked: failed to acquire lock: %v", err)
			return
		}

		log.Printf("[Blocking-%d] ✅ Session 2 acquired lock on employee %d after waiting %v",
			workerID, emp1, waitTime)
		stats.IncrementBlockingEvents()
	}()

	wg.Wait()
	close(errChan)

	// Check for errors
	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

// ioIntensiveWorker generates I/O intensive queries (full table scans)
func ioIntensiveWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[IO-%d] Started", workerID)

	queries := []string{
		// Full table scan with no index
		`SELECT /*+ FULL(e) */ * FROM employees e WHERE LOWER(first_name) LIKE '%a%'`,

		// Multiple full table scans with joins
		`SELECT /*+ FULL(e) FULL(d) FULL(l) */
		 e.*, d.department_name, l.city
		 FROM employees e, departments d, locations l
		 WHERE e.department_id = d.department_id
		 AND d.location_id = l.location_id
		 AND LOWER(e.email) LIKE '%'||LOWER(l.city)||'%'`,

		// Sorting large result set (requires disk sorts)
		`SELECT /*+ FULL(e) */ 
		 e.*, 
		 DENSE_RANK() OVER (ORDER BY salary DESC) as rank,
		 NTILE(10) OVER (ORDER BY hire_date) as tenure_bucket
		 FROM employees e
		 ORDER BY salary DESC, hire_date DESC`,

		// Hash join with large result sets
		`SELECT /*+ USE_HASH(e1 e2) FULL(e1) FULL(e2) */
		 e1.employee_id, e1.first_name, e1.salary,
		 COUNT(e2.employee_id) as subordinates
		 FROM employees e1
		 LEFT JOIN employees e2 ON e1.employee_id = e2.manager_id
		 GROUP BY e1.employee_id, e1.first_name, e1.salary
		 HAVING COUNT(e2.employee_id) > 0
		 ORDER BY subordinates DESC`,
	}

	for {
		select {
		case <-ctx.Done():
			log.Printf("[IO-%d] Stopped", workerID)
			return
		default:
			query := queries[rand.Intn(len(queries))]

			start := time.Now()
			rows, err := db.QueryContext(ctx, query)
			if err != nil {
				log.Printf("[IO-%d] Error: %v", workerID, err)
				stats.IncrementErrors()
				time.Sleep(2 * time.Second)
				continue
			}

			rowCount := 0
			for rows.Next() {
				rowCount++
			}
			rows.Close()

			elapsed := time.Since(start)
			log.Printf("[IO-%d] I/O query executed in %v (%d rows)", workerID, elapsed, rowCount)
			stats.IncrementIOQueries()

			time.Sleep(time.Duration(rand.Intn(4000)) * time.Millisecond)
		}
	}
}

// childCursorWorker generates multiple child cursors for same SQL_ID
func childCursorWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[ChildCursor-%d] Started", workerID)

	// Base query that will create multiple child cursors with bind variables
	baseQuery := "SELECT employee_id, first_name, last_name, salary FROM employees WHERE department_id = :1 AND salary > :2"

	// Different bind value combinations to create different execution plans
	bindSets := [][]interface{}{
		{10, 5000},  // Small dept, low salary
		{50, 10000}, // Medium dept, high salary
		{80, 8000},  // Large dept, medium salary
		{90, 15000}, // Executive dept, very high salary
		{60, 6000},  // IT dept, medium-low salary
	}

	for {
		select {
		case <-ctx.Done():
			log.Printf("[ChildCursor-%d] Stopped", workerID)
			return
		default:
			// Execute same SQL with different bind values
			for _, binds := range bindSets {
				rows, err := db.QueryContext(ctx, baseQuery, binds...)
				if err != nil {
					log.Printf("[ChildCursor-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
					continue
				}

				rowCount := 0
				for rows.Next() {
					rowCount++
				}
				rows.Close()

				log.Printf("[ChildCursor-%d] Executed with binds dept=%v, salary=%v (%d rows)",
					workerID, binds[0], binds[1], rowCount)
				stats.IncrementChildCursors()

				time.Sleep(time.Duration(500+rand.Intn(1000)) * time.Millisecond)
			}

			// Longer pause between full cycles
			time.Sleep(time.Duration(3+rand.Intn(5)) * time.Second)
		}
	}
}

// concurrencyWorker generates queries that create concurrency waits
func concurrencyWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[Concurrency-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Concurrency-%d] Stopped", workerID)
			return
		default:
			// Rapid-fire queries to create latch contention
			for i := 0; i < 10; i++ {
				query := `SELECT COUNT(*), AVG(salary), MAX(salary), MIN(salary) 
						  FROM employees 
						  WHERE hire_date > SYSDATE - 3650`

				var count, avg, max, min sql.NullFloat64
				err := db.QueryRowContext(ctx, query).Scan(&count, &avg, &max, &min)
				if err != nil {
					log.Printf("[Concurrency-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
					continue
				}

				stats.IncrementWaitEvents()
			}

			log.Printf("[Concurrency-%d] Executed burst of 10 concurrent queries", workerID)
			time.Sleep(time.Duration(2+rand.Intn(4)) * time.Second)
		}
	}
}

// statsReporter periodically prints statistics
func statsReporter(ctx context.Context, wg *sync.WaitGroup, stats *WorkloadStats, interval time.Duration) {
	defer wg.Done()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stats.Print()
		}
	}
}

// getEnv retrieves environment variable or returns default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
