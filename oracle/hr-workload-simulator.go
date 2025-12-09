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
	"errors"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"os"
	"os/signal"
	"strings"
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

	// New Oracle-specific lock and wait scenarios
	TableLockWorkers       int // enq: TM - table lock contention
	CommitWorkers          int // log file sync - commit contention
	BufferBusyWorkers      int // buffer busy waits
	SequenceWorkers        int // enq: SQ - sequence contention
	IndexContentionWorkers int // index range lock contention
	TempSegmentWorkers     int // direct path temp - temp I/O waits

	// Additional Oracle metrics and wait scenarios
	EnableScheduledMetrics bool          // Enable scheduled metrics burst
	MetricsInterval        time.Duration // Interval for scheduled metrics (default 5s)
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

	// New scenario counters
	TableLocksCreated   int
	CommitContentions   int
	BufferBusyEvents    int
	SequenceContentions int
	IndexContentions    int
	TempSegmentWaits    int

	// Additional metrics counters
	TablespacePressureEvents   int
	UndoSegmentContentions     int
	LibraryCacheContentions    int
	RowCacheContentions        int
	CheckpointActivities       int
	ArchiveLogActivities       int
	ParseActivities            int
	SQLNetActivities           int
	ControlFileWaits           int
	LibraryCachePinWaits       int
	RowCacheLockWaits          int
	DBFileSyncWaits            int
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

// isShutdownError checks if an error is due to context cancellation or shutdown
func isShutdownError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	return errors.Is(err, context.Canceled) ||
		errors.Is(err, context.DeadlineExceeded) ||
		strings.Contains(errStr, "context canceled") ||
		strings.Contains(errStr, "context deadline exceeded") ||
		strings.Contains(errStr, "ORA-00054") // Resource busy - expected during shutdown
}

func (ws *WorkloadStats) IncrementTableLocks() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.TableLocksCreated++
}

func (ws *WorkloadStats) IncrementCommitContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.CommitContentions++
}

func (ws *WorkloadStats) IncrementBufferBusy() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.BufferBusyEvents++
}

func (ws *WorkloadStats) IncrementSequenceContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.SequenceContentions++
}

func (ws *WorkloadStats) IncrementIndexContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.IndexContentions++
}

func (ws *WorkloadStats) IncrementTempSegmentWaits() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.TempSegmentWaits++
}

func (ws *WorkloadStats) IncrementTablespacePressure() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.TablespacePressureEvents++
}

func (ws *WorkloadStats) IncrementUndoSegmentContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.UndoSegmentContentions++
}

func (ws *WorkloadStats) IncrementLibraryCacheContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.LibraryCacheContentions++
}

func (ws *WorkloadStats) IncrementRowCacheContentions() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.RowCacheContentions++
}

func (ws *WorkloadStats) IncrementCheckpointActivities() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.CheckpointActivities++
}

func (ws *WorkloadStats) IncrementArchiveLogActivities() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.ArchiveLogActivities++
}

func (ws *WorkloadStats) IncrementParseActivities() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.ParseActivities++
}

func (ws *WorkloadStats) IncrementSQLNetActivities() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.SQLNetActivities++
}

func (ws *WorkloadStats) IncrementControlFileWaits() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.ControlFileWaits++
}

func (ws *WorkloadStats) IncrementLibraryCachePinWaits() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.LibraryCachePinWaits++
}

func (ws *WorkloadStats) IncrementRowCacheLockWaits() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.RowCacheLockWaits++
}

func (ws *WorkloadStats) IncrementDBFileSyncWaits() {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	ws.DBFileSyncWaits++
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
	fmt.Printf("Table Locks Created:      %d\n", ws.TableLocksCreated)
	fmt.Printf("Commit Contentions:       %d\n", ws.CommitContentions)
	fmt.Printf("Buffer Busy Events:       %d\n", ws.BufferBusyEvents)
	fmt.Printf("Sequence Contentions:     %d\n", ws.SequenceContentions)
	fmt.Printf("Index Contentions:        %d\n", ws.IndexContentions)
	fmt.Printf("Temp Segment Waits:       %d\n", ws.TempSegmentWaits)
	fmt.Printf("\n--- Scheduled Metrics ---\n")
	fmt.Printf("Tablespace Pressure:      %d\n", ws.TablespacePressureEvents)
	fmt.Printf("Undo Segment Contentions: %d\n", ws.UndoSegmentContentions)
	fmt.Printf("Library Cache Contention: %d\n", ws.LibraryCacheContentions)
	fmt.Printf("Row Cache Contention:     %d\n", ws.RowCacheContentions)
	fmt.Printf("Checkpoint Activities:    %d\n", ws.CheckpointActivities)
	fmt.Printf("Archive Log Activities:   %d\n", ws.ArchiveLogActivities)
	fmt.Printf("Parse Activities:         %d\n", ws.ParseActivities)
	fmt.Printf("SQL*Net Activities:       %d\n", ws.SQLNetActivities)
	fmt.Printf("Control File Waits:       %d\n", ws.ControlFileWaits)
	fmt.Printf("Library Cache Pin Waits:  %d\n", ws.LibraryCachePinWaits)
	fmt.Printf("Row Cache Lock Waits:     %d\n", ws.RowCacheLockWaits)
	fmt.Printf("DB File Sync Waits:       %d\n", ws.DBFileSyncWaits)
	fmt.Printf("\nErrors:                   %d\n", ws.Errors)
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

		// New Oracle-specific scenario workers
		tableLockWorkers  = flag.Int("table-lock-workers", 0, "Number of table lock workers (enq: TM)")
		commitWorkers     = flag.Int("commit-workers", 0, "Number of commit contention workers (log file sync)")
		bufferBusyWorkers = flag.Int("buffer-busy-workers", 0, "Number of buffer busy workers")
		sequenceWorkers   = flag.Int("sequence-workers", 0, "Number of sequence contention workers (enq: SQ)")
		indexWorkers      = flag.Int("index-workers", 0, "Number of index contention workers")
		tempWorkers       = flag.Int("temp-workers", 0, "Number of temp segment I/O workers")

		// Scheduled metrics
		enableMetrics   = flag.Bool("enable-metrics", false, "Enable scheduled metrics burst (recommended)")
		metricsInterval = flag.Duration("metrics-interval", 5*time.Second, "Interval for scheduled metrics burst")
	)
	flag.Parse()

	if *password == "" || *connectString == "" {
		log.Fatal("ERROR: Oracle password and connect string are required\n" +
			"Usage: ./hr-workload-simulator -password <password> -connect <host:port/service>\n" +
			"Or set ORACLE_PASSWORD and ORACLE_CONNECT_STRING environment variables")
	}

	config := Config{
		User:                   *user,
		Password:               *password,
		ConnectString:          *connectString,
		Duration:               *duration,
		SlowQueryWorkers:       *slowWorkers,
		BlockingWorkers:        *blockWorkers,
		IOWorkers:              *ioWorkers,
		ChildCursorWorkers:     *childWorkers,
		ConcurrencyWorkers:     *concurrency,
		TableLockWorkers:       *tableLockWorkers,
		CommitWorkers:          *commitWorkers,
		BufferBusyWorkers:      *bufferBusyWorkers,
		SequenceWorkers:        *sequenceWorkers,
		IndexContentionWorkers: *indexWorkers,
		TempSegmentWorkers:     *tempWorkers,
		EnableScheduledMetrics: *enableMetrics,
		MetricsInterval:        *metricsInterval,
	}

	fmt.Printf("\n=== HR Workload Simulator (Enhanced) ===\n")
	fmt.Printf("Database: %s@%s\n", config.User, config.ConnectString)
	fmt.Printf("Duration: %v\n", config.Duration)
	fmt.Printf("Classic Workers: Slow=%d, Blocking=%d, I/O=%d, ChildCursor=%d, Concurrency=%d\n",
		config.SlowQueryWorkers, config.BlockingWorkers, config.IOWorkers,
		config.ChildCursorWorkers, config.ConcurrencyWorkers)
	fmt.Printf("Enhanced Workers: TableLock=%d, Commit=%d, BufferBusy=%d, Sequence=%d, Index=%d, Temp=%d\n",
		config.TableLockWorkers, config.CommitWorkers, config.BufferBusyWorkers,
		config.SequenceWorkers, config.IndexContentionWorkers, config.TempSegmentWorkers)
	fmt.Printf("========================================\n\n")

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

	// 6. Table Lock Workers - Generate enq: TM table lock contention
	for i := 0; i < config.TableLockWorkers; i++ {
		wg.Add(1)
		go tableLockWorker(ctx, &wg, db, i, stats)
	}

	// 7. Commit Contention Workers - Generate log file sync waits
	for i := 0; i < config.CommitWorkers; i++ {
		wg.Add(1)
		go commitContentionWorker(ctx, &wg, db, i, stats)
	}

	// 8. Buffer Busy Workers - Generate buffer busy waits
	for i := 0; i < config.BufferBusyWorkers; i++ {
		wg.Add(1)
		go bufferBusyWorker(ctx, &wg, db, i, stats)
	}

	// 9. Sequence Workers - Generate enq: SQ sequence contention
	for i := 0; i < config.SequenceWorkers; i++ {
		wg.Add(1)
		go sequenceWorker(ctx, &wg, db, i, stats)
	}

	// 10. Index Contention Workers - Generate index range lock contention
	for i := 0; i < config.IndexContentionWorkers; i++ {
		wg.Add(1)
		go indexContentionWorker(ctx, &wg, db, i, stats)
	}

	// 11. Temp Segment Workers - Generate direct path temp I/O waits
	for i := 0; i < config.TempSegmentWorkers; i++ {
		wg.Add(1)
		go tempSegmentWorker(ctx, &wg, db, i, stats)
	}

	// 12. Scheduled Metrics Generator - Burst of comprehensive metrics
	if config.EnableScheduledMetrics {
		wg.Add(1)
		go scheduledMetricsGenerator(ctx, &wg, db, stats, config.MetricsInterval)
		fmt.Printf("✓ Scheduled metrics generator enabled (interval=%v)\n", config.MetricsInterval)
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

		// Ultra-complex multi-join query with aggregations, window functions, and subqueries
		// This creates extreme CPU load with complex join conditions and calculations
		`SELECT /*+ USE_HASH(e d j l c r) FULL(e) FULL(d) */
		 e.employee_id,
		 e.first_name || ' ' || e.last_name as full_name,
		 e.salary,
		 e.commission_pct,
		 e.hire_date,
		 d.department_id,
		 d.department_name,
		 j.job_id,
		 j.job_title,
		 j.min_salary,
		 j.max_salary,
		 l.city,
		 l.state_province,
		 c.country_name,
		 r.region_id,
		 r.region_name,
		 -- Complex calculations
		 ROUND(e.salary / NULLIF(j.min_salary, 0) * 100, 2) as salary_vs_min_pct,
		 ROUND(e.salary / NULLIF(j.max_salary, 0) * 100, 2) as salary_vs_max_pct,
		 ROUND(MONTHS_BETWEEN(SYSDATE, e.hire_date) / 12, 2) as years_employed,
		 -- Window functions for ranking
		 RANK() OVER (PARTITION BY d.department_id ORDER BY e.salary DESC) as dept_salary_rank,
		 DENSE_RANK() OVER (PARTITION BY r.region_id ORDER BY e.salary DESC) as region_salary_rank,
		 NTILE(10) OVER (ORDER BY e.salary) as salary_decile,
		 -- Aggregations over windows
		 AVG(e.salary) OVER (PARTITION BY d.department_id) as dept_avg_salary,
		 MAX(e.salary) OVER (PARTITION BY d.department_id) as dept_max_salary,
		 MIN(e.salary) OVER (PARTITION BY d.department_id) as dept_min_salary,
		 COUNT(*) OVER (PARTITION BY d.department_id) as dept_employee_count,
		 AVG(e.salary) OVER (PARTITION BY j.job_id) as job_avg_salary,
		 AVG(e.salary) OVER (PARTITION BY r.region_id) as region_avg_salary,
		 -- Moving averages
		 AVG(e.salary) OVER (PARTITION BY d.department_id ORDER BY e.hire_date
		                     ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) as moving_avg_salary,
		 -- Lag/Lead for comparisons
		 LAG(e.salary, 1) OVER (PARTITION BY d.department_id ORDER BY e.hire_date) as prev_hire_salary,
		 LEAD(e.salary, 1) OVER (PARTITION BY d.department_id ORDER BY e.hire_date) as next_hire_salary,
		 -- Subquery for job history count
		 (SELECT COUNT(*) FROM job_history jh2 WHERE jh2.employee_id = e.employee_id) as job_changes,
		 -- Complex case expressions with correlated subqueries
		 CASE
		   WHEN e.salary > (SELECT AVG(salary) * 1.5 FROM employees WHERE department_id = e.department_id)
		   THEN 'Top Performer'
		   WHEN e.salary > (SELECT AVG(salary) FROM employees WHERE department_id = e.department_id)
		   THEN 'Above Average'
		   WHEN e.salary > (SELECT AVG(salary) * 0.75 FROM employees WHERE department_id = e.department_id)
		   THEN 'Average'
		   ELSE 'Below Average'
		 END as performance_tier,
		 -- Commission calculations
		 CASE
		   WHEN e.commission_pct IS NOT NULL
		   THEN ROUND(e.salary * (1 + e.commission_pct), 2)
		   ELSE e.salary
		 END as total_compensation
		 FROM employees e
		 INNER JOIN departments d ON e.department_id = d.department_id
		 INNER JOIN jobs j ON e.job_id = j.job_id
		 INNER JOIN locations l ON d.location_id = l.location_id
		 INNER JOIN countries c ON l.country_id = c.country_id
		 INNER JOIN regions r ON c.region_id = r.region_id
		 WHERE e.salary IS NOT NULL
		   AND e.hire_date IS NOT NULL
		   AND d.department_id IS NOT NULL
		 ORDER BY
		   r.region_name,
		   d.department_name,
		   e.salary DESC`,
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

			// Shorter delay to maintain more queries in-flight for better monitoring coverage
			// 0.5-2 seconds instead of 0-3 seconds creates better overlap
			sleepTime := time.Duration(500+rand.Intn(1500)) * time.Millisecond
			time.Sleep(sleepTime)
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
				if !isShutdownError(err) {
					log.Printf("[Blocking-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
				}
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
					if !isShutdownError(err) {
						log.Printf("[ChildCursor-%d] Error: %v", workerID, err)
						stats.IncrementErrors()
					}
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

// tableLockWorker creates table-level lock contention (enq: TM)
func tableLockWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[TableLock-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[TableLock-%d] Stopped", workerID)
			return
		default:
			if err := createTableLockScenario(ctx, db, workerID, stats); err != nil {
				if !isShutdownError(err) {
					log.Printf("[TableLock-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
				}
			}

			// Wait before next table lock scenario
			time.Sleep(time.Duration(15+rand.Intn(15)) * time.Second)
		}
	}
}

// createTableLockScenario creates table-level lock contention
func createTableLockScenario(ctx context.Context, db *sql.DB, workerID int, stats *WorkloadStats) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	// Session 1: Lock entire table
	wg.Add(1)
	go func() {
		defer wg.Done()

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- fmt.Errorf("table locker: failed to get connection: %v", err)
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- fmt.Errorf("table locker: failed to begin transaction: %v", err)
			return
		}
		defer tx.Rollback()

		// Lock entire table in EXCLUSIVE mode
		_, err = tx.ExecContext(ctx, "LOCK TABLE employees IN EXCLUSIVE MODE NOWAIT")
		if err != nil {
			errChan <- fmt.Errorf("table locker: failed to lock table: %v", err)
			return
		}

		log.Printf("[TableLock-%d] 🔒 Session 1 locked EMPLOYEES table (EXCLUSIVE mode)", workerID)
		stats.IncrementWaitEvents()

		// Hold table lock for 10-15 seconds
		holdTime := time.Duration(10+rand.Intn(6)) * time.Second
		time.Sleep(holdTime)

		log.Printf("[TableLock-%d] 🔓 Session 1 releasing table lock after %v", workerID, holdTime)
	}()

	// Session 2: Try to update table (will wait for TM enqueue)
	wg.Add(1)
	go func() {
		defer wg.Done()

		// Wait for session 1 to acquire table lock
		time.Sleep(2 * time.Second)

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- fmt.Errorf("blocked updater: failed to get connection: %v", err)
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- fmt.Errorf("blocked updater: failed to begin transaction: %v", err)
			return
		}
		defer tx.Rollback()

		log.Printf("[TableLock-%d] ⏳ Session 2 attempting UPDATE on EMPLOYEES (will block on TM enqueue)...", workerID)

		start := time.Now()
		_, err = tx.ExecContext(ctx, "UPDATE employees SET salary = salary + 1 WHERE employee_id = 100")
		waitTime := time.Since(start)

		if err != nil {
			errChan <- fmt.Errorf("blocked updater: failed to update: %v", err)
			return
		}

		log.Printf("[TableLock-%d] ✅ Session 2 acquired TM lock and completed UPDATE after waiting %v", workerID, waitTime)
		stats.IncrementTableLocks()
	}()

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

// commitContentionWorker creates commit contention (log file sync waits)
func commitContentionWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[CommitContention-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[CommitContention-%d] Stopped", workerID)
			return
		default:
			// High-frequency commits create log file sync waits
			conn, err := db.Conn(ctx)
			if err != nil {
				log.Printf("[CommitContention-%d] Error getting connection: %v", workerID, err)
				stats.IncrementErrors()
				time.Sleep(2 * time.Second)
				continue
			}

			commitCount := 0
			for i := 0; i < 50; i++ {
				tx, err := conn.BeginTx(ctx, nil)
				if err != nil {
					if !isShutdownError(err) {
						log.Printf("[CommitContention-%d] Error beginning tx: %v", workerID, err)
					}
					break
				}

				// Small update
				_, err = tx.ExecContext(ctx, "UPDATE employees SET salary = salary + 1 WHERE employee_id = :1", 100+rand.Intn(10))
				if err != nil {
					tx.Rollback()
					if !isShutdownError(err) {
						log.Printf("[CommitContention-%d] Error updating: %v", workerID, err)
					}
					break
				}

				// Commit immediately - creates log file sync waits
				if err := tx.Commit(); err != nil {
					if !isShutdownError(err) {
						log.Printf("[CommitContention-%d] Error committing: %v", workerID, err)
					}
					break
				}

				commitCount++
				stats.IncrementCommitContentions()

				// Very short delay between commits
				time.Sleep(10 * time.Millisecond)
			}

			conn.Close()
			log.Printf("[CommitContention-%d] Completed %d rapid commits", workerID, commitCount)

			// Wait before next burst
			time.Sleep(time.Duration(3+rand.Intn(5)) * time.Second)
		}
	}
}

// bufferBusyWorker creates buffer busy waits
func bufferBusyWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[BufferBusy-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[BufferBusy-%d] Stopped", workerID)
			return
		default:
			// Multiple sessions updating consecutive rows in same block creates buffer busy waits
			var innerWg sync.WaitGroup
			baseEmpID := 100 + rand.Intn(10)

			for i := 0; i < 3; i++ {
				innerWg.Add(1)
				go func(offset int) {
					defer innerWg.Done()

					conn, err := db.Conn(ctx)
					if err != nil {
						return
					}
					defer conn.Close()

					tx, err := conn.BeginTx(ctx, nil)
					if err != nil {
						return
					}
					defer tx.Rollback()

					// Update consecutive employee IDs (likely in same data block)
					empID := baseEmpID + offset
					_, err = tx.ExecContext(ctx, "UPDATE employees SET salary = salary + 1 WHERE employee_id = :1", empID)
					if err != nil {
						return
					}

					// Hold briefly to create contention
					time.Sleep(time.Duration(500+rand.Intn(500)) * time.Millisecond)

					tx.Commit()
					stats.IncrementBufferBusy()
				}(i)
			}

			innerWg.Wait()
			log.Printf("[BufferBusy-%d] Created buffer contention on block containing employees %d-%d", workerID, baseEmpID, baseEmpID+2)

			time.Sleep(time.Duration(2+rand.Intn(4)) * time.Second)
		}
	}
}

// sequenceWorker creates sequence contention (enq: SQ)
func sequenceWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[Sequence-%d] Started", workerID)

	// Try to create sequence if it doesn't exist
	_, err := db.ExecContext(ctx, "CREATE SEQUENCE employee_seq START WITH 1000 INCREMENT BY 1 CACHE 20")
	if err != nil {
		// Sequence might already exist, that's okay
		log.Printf("[Sequence-%d] Note: Sequence may already exist (error: %v)", workerID, err)
	}

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Sequence-%d] Stopped", workerID)
			return
		default:
			// Rapid NEXTVAL calls create sequence contention
			successCount := 0
			for i := 0; i < 20; i++ {
				var nextVal int64
				err := db.QueryRowContext(ctx, "SELECT employee_seq.NEXTVAL FROM DUAL").Scan(&nextVal)
				if err != nil {
					log.Printf("[Sequence-%d] Error getting NEXTVAL: %v", workerID, err)
					stats.IncrementErrors()
					break
				}
				successCount++
				stats.IncrementSequenceContentions()

				// Very short delay to create contention
				time.Sleep(5 * time.Millisecond)
			}

			log.Printf("[Sequence-%d] Retrieved %d sequence values", workerID, successCount)
			time.Sleep(time.Duration(1+rand.Intn(3)) * time.Second)
		}
	}
}

// indexContentionWorker creates index range lock contention
func indexContentionWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[IndexContention-%d] Started", workerID)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[IndexContention-%d] Stopped", workerID)
			return
		default:
			if err := createIndexContentionScenario(ctx, db, workerID, stats); err != nil {
				if !isShutdownError(err) {
					log.Printf("[IndexContention-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
				}
			}

			time.Sleep(time.Duration(8+rand.Intn(8)) * time.Second)
		}
	}
}

// createIndexContentionScenario creates overlapping index range locks
func createIndexContentionScenario(ctx context.Context, db *sql.DB, workerID int, stats *WorkloadStats) error {
	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	baseEmpID := 100 + rand.Intn(20)

	// Session 1: Lock range 100-115
	wg.Add(1)
	go func() {
		defer wg.Done()

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- err
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- err
			return
		}
		defer tx.Rollback()

		rows, err := tx.QueryContext(ctx,
			"SELECT employee_id, salary FROM employees WHERE employee_id BETWEEN :1 AND :2 FOR UPDATE",
			baseEmpID, baseEmpID+15)
		if err != nil {
			errChan <- err
			return
		}

		count := 0
		for rows.Next() {
			count++
		}
		rows.Close()

		log.Printf("[IndexContention-%d] 🔒 Session 1 locked range [%d-%d] (%d rows)",
			workerID, baseEmpID, baseEmpID+15, count)

		// Hold range lock
		time.Sleep(time.Duration(6+rand.Intn(4)) * time.Second)

		log.Printf("[IndexContention-%d] 🔓 Session 1 releasing range lock", workerID)
	}()

	// Session 2: Try to lock overlapping range 110-125 (will block)
	wg.Add(1)
	go func() {
		defer wg.Done()

		time.Sleep(1 * time.Second)

		conn, err := db.Conn(ctx)
		if err != nil {
			errChan <- err
			return
		}
		defer conn.Close()

		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			errChan <- err
			return
		}
		defer tx.Rollback()

		log.Printf("[IndexContention-%d] ⏳ Session 2 attempting overlapping range [%d-%d] (will block)...",
			workerID, baseEmpID+10, baseEmpID+25)

		start := time.Now()
		rows, err := tx.QueryContext(ctx,
			"SELECT employee_id, salary FROM employees WHERE employee_id BETWEEN :1 AND :2 FOR UPDATE",
			baseEmpID+10, baseEmpID+25)
		waitTime := time.Since(start)

		if err != nil {
			errChan <- err
			return
		}

		count := 0
		for rows.Next() {
			count++
		}
		rows.Close()

		log.Printf("[IndexContention-%d] ✅ Session 2 acquired overlapping range lock after %v (%d rows)",
			workerID, waitTime, count)
		stats.IncrementIndexContentions()
	}()

	wg.Wait()
	close(errChan)

	for err := range errChan {
		if err != nil {
			return err
		}
	}

	return nil
}

// tempSegmentWorker creates temporary segment I/O waits
func tempSegmentWorker(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, workerID int, stats *WorkloadStats) {
	defer wg.Done()
	log.Printf("[TempSegment-%d] Started", workerID)

	queries := []string{
		// Large Cartesian product requiring temp space
		`SELECT /*+ USE_HASH(e1 e2) NO_INDEX(e1) NO_INDEX(e2) */ 
		 e1.employee_id, e1.first_name, e2.employee_id, e2.last_name
		 FROM employees e1, employees e2
		 WHERE e1.salary < e2.salary
		 ORDER BY e1.salary DESC, e2.salary DESC`,

		// Large sort requiring temp space
		`SELECT /*+ FULL(e) NO_INDEX(e) */ 
		 e.*, 
		 DENSE_RANK() OVER (ORDER BY salary DESC) as rank1,
		 DENSE_RANK() OVER (ORDER BY hire_date) as rank2,
		 DENSE_RANK() OVER (ORDER BY last_name) as rank3
		 FROM employees e
		 ORDER BY salary DESC, hire_date, last_name`,

		// Hash join requiring temp space
		`SELECT /*+ USE_HASH(e1 e2 e3) FULL(e1) FULL(e2) FULL(e3) */
		 e1.employee_id, e1.first_name,
		 e2.first_name as manager_name,
		 e3.first_name as director_name
		 FROM employees e1
		 LEFT JOIN employees e2 ON e1.manager_id = e2.employee_id
		 LEFT JOIN employees e3 ON e2.manager_id = e3.employee_id
		 ORDER BY e1.salary DESC, e2.salary DESC, e3.salary DESC`,
	}

	for {
		select {
		case <-ctx.Done():
			log.Printf("[TempSegment-%d] Stopped", workerID)
			return
		default:
			query := queries[rand.Intn(len(queries))]

			start := time.Now()
			rows, err := db.QueryContext(ctx, query)
			if err != nil {
				if !isShutdownError(err) {
					log.Printf("[TempSegment-%d] Error: %v", workerID, err)
					stats.IncrementErrors()
				}
				time.Sleep(2 * time.Second)
				continue
			}

			rowCount := 0
			for rows.Next() {
				rowCount++
			}
			rows.Close()

			elapsed := time.Since(start)
			log.Printf("[TempSegment-%d] Temp I/O query executed in %v (%d rows)", workerID, elapsed, rowCount)
			stats.IncrementTempSegmentWaits()

			// Longer delay between temp-intensive queries
			time.Sleep(time.Duration(5+rand.Intn(10)) * time.Second)
		}
	}
}

// scheduledMetricsGenerator runs burst of comprehensive metrics at regular intervals
func scheduledMetricsGenerator(ctx context.Context, wg *sync.WaitGroup, db *sql.DB, stats *WorkloadStats, interval time.Duration) {
	defer wg.Done()
	log.Printf("[ScheduledMetrics] Started with interval %v", interval)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("[ScheduledMetrics] Stopped")
			return
		case <-ticker.C:
			fmt.Println("\n=== Scheduled Metrics Burst ===")

			// Launch all scenarios concurrently
			var metricWg sync.WaitGroup

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateTablespacePressure(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateUndoSegmentContention(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateLibraryCacheContention(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateRowCacheContention(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateCheckpointActivity(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateArchiveLogActivity(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateParseActivity(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateSQLNetActivity(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateControlFileWaits(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateLibraryCachePinWaits(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateRowCacheLockWaits(ctx, db, stats)
			}()

			metricWg.Add(1)
			go func() {
				defer metricWg.Done()
				generateDBFileSyncWaits(ctx, db, stats)
			}()

			metricWg.Wait()
			fmt.Println("=== Metrics burst completed ===")
		}
	}
}

// generateTablespacePressure creates heavy insert load to simulate tablespace pressure
func generateTablespacePressure(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	query := `INSERT INTO EMPLOYEES (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, HIRE_DATE, JOB_ID)
			  SELECT EMPLOYEES_SEQ.NEXTVAL,
			         'BULK' || LEVEL,
			         'LOAD' || LEVEL,
			         'bulk' || LEVEL || '@example.com',
			         SYSDATE,
			         'IT_PROG'
			  FROM DUAL CONNECT BY LEVEL <= 1000`

	conn, err := db.Conn(ctx)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Tablespace] Error getting connection: %v", err)
		}
		return
	}
	defer conn.Close()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Tablespace] Error beginning transaction: %v", err)
		}
		return
	}
	defer tx.Rollback() // Rollback to avoid permanent data growth

	_, err = tx.ExecContext(ctx, query)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Tablespace] Error inserting: %v", err)
		}
		return
	}

	log.Printf("  [Scheduled] Generated tablespace pressure (1000 inserts)")
	stats.IncrementTablespacePressure()
}

// generateUndoSegmentContention creates large update then rollback
func generateUndoSegmentContention(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	conn, err := db.Conn(ctx)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Undo] Error getting connection: %v", err)
		}
		return
	}
	defer conn.Close()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Undo] Error beginning transaction: %v", err)
		}
		return
	}
	defer tx.Rollback() // Always rollback to create undo activity

	_, err = tx.ExecContext(ctx, "UPDATE EMPLOYEES SET SALARY = SALARY + 100 WHERE DEPARTMENT_ID IN (10, 20, 30, 40, 50)")
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Undo] Error updating: %v", err)
		}
		return
	}

	// Hold transaction for a bit
	time.Sleep(2 * time.Second)

	log.Printf("  [Scheduled] Generated undo segment contention")
	stats.IncrementUndoSegmentContentions()
}

// generateLibraryCacheContention runs same SQL multiple times
func generateLibraryCacheContention(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	query := "SELECT COUNT(*) FROM EMPLOYEES WHERE DEPARTMENT_ID = 50 AND SALARY > 5000"

	for i := 0; i < 50; i++ {
		var count int
		err := db.QueryRowContext(ctx, query).Scan(&count)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-LibCache] Error: %v", err)
			}
			return
		}
	}

	log.Printf("  [Scheduled] Generated library cache contention (50 identical SQLs)")
	stats.IncrementLibraryCacheContentions()
}

// generateRowCacheContention queries data dictionary repeatedly
func generateRowCacheContention(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	queries := []string{
		"SELECT table_name FROM user_tables WHERE ROWNUM <= 10",
		"SELECT sequence_name FROM user_sequences WHERE ROWNUM <= 10",
		"SELECT index_name FROM user_indexes WHERE ROWNUM <= 10",
	}

	for i := 0; i < 30; i++ {
		query := queries[i%len(queries)]
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-RowCache] Error: %v", err)
			}
			return
		}
		for rows.Next() {
			// Consume rows
		}
		rows.Close()
	}

	log.Printf("  [Scheduled] Generated row cache (dictionary cache) contention")
	stats.IncrementRowCacheContentions()
}

// generateCheckpointActivity generates heavy DML to trigger checkpoints
func generateCheckpointActivity(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	conn, err := db.Conn(ctx)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Checkpoint] Error getting connection: %v", err)
		}
		return
	}
	defer conn.Close()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Checkpoint] Error beginning transaction: %v", err)
		}
		return
	}
	defer tx.Rollback()

	// Large bulk insert
	_, err = tx.ExecContext(ctx, `INSERT INTO EMPLOYEES (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, HIRE_DATE, JOB_ID)
									SELECT EMPLOYEES_SEQ.NEXTVAL, 'CHK'||LEVEL, 'POINT'||LEVEL, 'chk'||LEVEL||'@ex.com', SYSDATE, 'IT_PROG'
									FROM DUAL CONNECT BY LEVEL <= 2000`)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Checkpoint] Error inserting: %v", err)
		}
		return
	}

	// Update many rows
	_, err = tx.ExecContext(ctx, "UPDATE EMPLOYEES SET SALARY = SALARY + 50 WHERE DEPARTMENT_ID IN (10,20,30,40,50,60,70,80,90)")
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-Checkpoint] Error updating: %v", err)
		}
		return
	}

	log.Printf("  [Scheduled] Generated checkpoint activity")
	stats.IncrementCheckpointActivities()
}

// generateArchiveLogActivity generates heavy redo by batch DML with commits
func generateArchiveLogActivity(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	conn, err := db.Conn(ctx)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-ArchiveLog] Error getting connection: %v", err)
		}
		return
	}
	defer conn.Close()

	for batch := 0; batch < 10; batch++ {
		tx, err := conn.BeginTx(ctx, nil)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-ArchiveLog] Error beginning transaction: %v", err)
			}
			return
		}

		_, err = tx.ExecContext(ctx, `INSERT INTO EMPLOYEES (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, HIRE_DATE, JOB_ID)
										SELECT EMPLOYEES_SEQ.NEXTVAL, 'ARCH'||LEVEL, 'LOG'||LEVEL, 'arch'||LEVEL||'@ex.com', SYSDATE, 'IT_PROG'
										FROM DUAL CONNECT BY LEVEL <= 500`)
		if err != nil {
			tx.Rollback()
			if !isShutdownError(err) {
				log.Printf("[Metrics-ArchiveLog] Error inserting: %v", err)
			}
			return
		}

		tx.Rollback() // Rollback to avoid permanent data growth
	}

	log.Printf("  [Scheduled] Generated archive log activity (heavy redo)")
	stats.IncrementArchiveLogActivities()
}

// generateParseActivity creates hard parses with unique SQL
func generateParseActivity(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	for i := 0; i < 100; i++ {
		// Each SQL is unique, forcing hard parse
		uniqueSQL := fmt.Sprintf("SELECT /* PARSE_TEST_%d_%d */ SALARY FROM EMPLOYEES WHERE EMPLOYEE_ID = 100", time.Now().UnixNano(), i)

		var salary sql.NullFloat64
		err := db.QueryRowContext(ctx, uniqueSQL).Scan(&salary)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-Parse] Error: %v", err)
			}
			return
		}
	}

	log.Printf("  [Scheduled] Generated parse activity (100 hard parses)")
	stats.IncrementParseActivities()
}

// generateSQLNetActivity creates many round-trips
func generateSQLNetActivity(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	query := "SELECT EMPLOYEE_ID, FIRST_NAME, LAST_NAME, SALARY FROM EMPLOYEES WHERE EMPLOYEE_ID = :1"

	for i := 0; i < 1000; i++ {
		var empID int
		var firstName, lastName string
		var salary sql.NullFloat64

		err := db.QueryRowContext(ctx, query, 100).Scan(&empID, &firstName, &lastName, &salary)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-SQLNet] Error: %v", err)
			}
			return
		}
	}

	log.Printf("  [Scheduled] Generated SQL*Net activity (1000 round-trips)")
	stats.IncrementSQLNetActivities()
}

// generateControlFileWaits queries v$ views to access control file
func generateControlFileWaits(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	queries := []string{
		"SELECT name, value FROM v$parameter WHERE name LIKE '%control%' AND ROWNUM <= 5",
		"SELECT status FROM v$instance",
		"SELECT name FROM v$database",
	}

	for i := 0; i < 20; i++ {
		query := queries[i%len(queries)]
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-ControlFile] Error: %v", err)
			}
			return
		}
		for rows.Next() {
			// Consume rows
		}
		rows.Close()
	}

	log.Printf("  [Scheduled] Generated control file access waits")
	stats.IncrementControlFileWaits()
}

// generateLibraryCachePinWaits creates and drops procedures to generate library cache pins
func generateLibraryCachePinWaits(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	for i := 0; i < 15; i++ {
		procName := fmt.Sprintf("TEMP_PROC_%d_%d", time.Now().UnixNano(), i)

		// Create procedure
		createSQL := fmt.Sprintf(`CREATE OR REPLACE PROCEDURE %s AS
								  BEGIN
								    FOR i IN 1..10 LOOP
								      NULL;
								    END LOOP;
								  END;`, procName)

		_, err := db.ExecContext(ctx, createSQL)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-LibCachePin] Error creating procedure: %v", err)
			}
			return
		}

		// Drop procedure
		dropSQL := fmt.Sprintf("DROP PROCEDURE %s", procName)
		_, err = db.ExecContext(ctx, dropSQL)
		if err != nil {
			// Ignore drop errors
		}
	}

	log.Printf("  [Scheduled] Generated library cache pin waits (15 compilations)")
	stats.IncrementLibraryCachePinWaits()
}

// generateRowCacheLockWaits queries metadata extensively
func generateRowCacheLockWaits(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	queries := []string{
		"SELECT table_name, tablespace_name FROM user_tables WHERE ROWNUM <= 10",
		"SELECT sequence_name, min_value, max_value FROM user_sequences WHERE ROWNUM <= 10",
		"SELECT index_name, uniqueness FROM user_indexes WHERE ROWNUM <= 10",
	}

	for i := 0; i < 50; i++ {
		query := queries[i%len(queries)]
		rows, err := db.QueryContext(ctx, query)
		if err != nil {
			if !isShutdownError(err) {
				log.Printf("[Metrics-RowCacheLock] Error: %v", err)
			}
			return
		}
		for rows.Next() {
			// Consume rows
		}
		rows.Close()
	}

	log.Printf("  [Scheduled] Generated row cache lock waits (150 metadata queries)")
	stats.IncrementRowCacheLockWaits()
}

// generateDBFileSyncWaits creates large data modifications requiring sync
func generateDBFileSyncWaits(ctx context.Context, db *sql.DB, stats *WorkloadStats) {
	conn, err := db.Conn(ctx)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-DBFileSync] Error getting connection: %v", err)
		}
		return
	}
	defer conn.Close()

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-DBFileSync] Error beginning transaction: %v", err)
		}
		return
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `INSERT INTO EMPLOYEES (EMPLOYEE_ID, FIRST_NAME, LAST_NAME, EMAIL, HIRE_DATE, JOB_ID)
									SELECT EMPLOYEES_SEQ.NEXTVAL, 'SYNC'||LEVEL, 'TEST'||LEVEL, 'sync'||LEVEL||'@ex.com', SYSDATE, 'IT_PROG'
									FROM DUAL CONNECT BY LEVEL <= 5000`)
	if err != nil {
		if !isShutdownError(err) {
			log.Printf("[Metrics-DBFileSync] Error inserting: %v", err)
		}
		return
	}

	log.Printf("  [Scheduled] Generated DB file sync waits")
	stats.IncrementDBFileSyncWaits()
}

// getEnv retrieves environment variable or returns default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
