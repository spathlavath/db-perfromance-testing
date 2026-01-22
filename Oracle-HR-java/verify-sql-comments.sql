-- Verify SQL Comments in Oracle Database
-- Run this script to check if New Relic trace comments are present in v$sql

-- 1. Check for SQL with New Relic comments in v$sql
SELECT
    sql_id,
    SUBSTR(sql_fulltext, 1, 150) as sql_preview,
    executions,
    elapsed_time/1000000 as elapsed_sec,
    TO_CHAR(last_active_time, 'YYYY-MM-DD HH24:MI:SS') as last_active
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext NOT LIKE '%v$sql%'
  AND sql_fulltext NOT LIKE '%SQLMetadata%'
ORDER BY last_active_time DESC
FETCH FIRST 10 ROWS ONLY;

-- 2. Check specific employee query with trace ID
SELECT
    sql_id,
    sql_fulltext
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext LIKE '%EMPLOYEES%'
  AND sql_fulltext NOT LIKE '%v$sql%'
FETCH FIRST 3 ROWS ONLY;

-- 3. Count SQL statements with New Relic comments
SELECT
    'Queries with NR comments' as metric,
    COUNT(*) as count
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext NOT LIKE '%v$sql%';

-- 4. Extract trace IDs from recent queries
SELECT
    REGEXP_SUBSTR(sql_fulltext, 'nr_trace_id=([^,]+)', 1, 1, 'i', 1) as trace_id,
    REGEXP_SUBSTR(sql_fulltext, 'nr_span_id=([^,]+)', 1, 1, 'i', 1) as span_id,
    SUBSTR(sql_fulltext, INSTR(sql_fulltext, 'SELECT'), 50) as query_start
FROM v$sql
WHERE sql_fulltext LIKE '%nr_trace_id%'
  AND sql_fulltext LIKE '%EMPLOYEES%'
  AND sql_fulltext NOT LIKE '%v$sql%'
FETCH FIRST 5 ROWS ONLY;
