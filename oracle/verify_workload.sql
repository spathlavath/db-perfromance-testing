-- HR Workload Verification Script
-- Run this while the simulator is running to verify it's generating the expected conditions
-- Usage: sqlplus hr/password@connect_string @verify_workload.sql

SET LINESIZE 200
SET PAGESIZE 100
COLUMN query_text FORMAT A60 TRUNCATE
COLUMN wait_event FORMAT A30
COLUMN username FORMAT A15

PROMPT ================================================================
PROMPT 1. SLOW QUERIES - Check v$sqlarea for HR queries
PROMPT ================================================================
PROMPT Should see queries with high avg_elapsed_time_ms
PROMPT

SELECT 
    sql_id,
    executions,
    ROUND(elapsed_time / DECODE(executions, 0, 1, executions) / 1000, 2) as avg_elapsed_ms,
    ROUND(cpu_time / DECODE(executions, 0, 1, executions) / 1000, 2) as avg_cpu_ms,
    disk_reads,
    SUBSTR(sql_text, 1, 60) as query_text,
    last_active_time
FROM v$sqlarea
WHERE parsing_schema_name = 'HR'
AND last_active_time >= SYSDATE - INTERVAL '10' MINUTE
AND sql_text NOT LIKE '%v$%'
AND sql_text NOT LIKE '%V$%'
ORDER BY avg_elapsed_ms DESC
FETCH FIRST 15 ROWS ONLY;

PROMPT
PROMPT ================================================================
PROMPT 2. ACTIVE SESSIONS WITH WAITS - Check v$session
PROMPT ================================================================
PROMPT Should see ACTIVE sessions in WAITING state with wait_time_micro > 0
PROMPT

SELECT 
    s.sid,
    s.serial#,
    s.username,
    s.status,
    s.state,
    s.sql_id,
    s.SQL_CHILD_NUMBER,
    s.wait_class,
    s.event as wait_event,
    ROUND(s.WAIT_TIME_MICRO / 1000, 2) as wait_ms,
    s.BLOCKING_SESSION
FROM v$session s
WHERE s.username = 'HR'
AND s.status = 'ACTIVE'
ORDER BY s.WAIT_TIME_MICRO DESC;

PROMPT
PROMPT ================================================================
PROMPT 3. BLOCKING SESSIONS - Check for blocker-blocked relationships
PROMPT ================================================================
PROMPT Should see blocking chains where one session blocks another
PROMPT

SELECT 
    s.sid as blocked_sid,
    s.serial# as blocked_serial,
    s.sql_id as blocked_query,
    SUBSTR(blocked_sql.sql_text, 1, 40) as blocked_query_text,
    s.BLOCKING_SESSION as blocker_sid,
    s.FINAL_BLOCKING_SESSION as final_blocker_sid,
    ROUND(s.WAIT_TIME_MICRO / 1000, 2) as blocked_ms,
    s.event as wait_event,
    blocker.sql_id as blocker_query,
    SUBSTR(blocker_sql.sql_text, 1, 40) as blocker_query_text
FROM v$session s
LEFT JOIN v$sqlarea blocked_sql ON s.sql_id = blocked_sql.sql_id
LEFT JOIN v$session blocker ON s.BLOCKING_SESSION = blocker.sid
LEFT JOIN v$sqlarea blocker_sql ON blocker.sql_id = blocker_sql.sql_id
WHERE s.username = 'HR'
AND s.BLOCKING_SESSION IS NOT NULL
ORDER BY blocked_ms DESC;

PROMPT
PROMPT ================================================================
PROMPT 4. CHILD CURSORS - Check for multiple child_numbers per SQL_ID
PROMPT ================================================================
PROMPT Should see same SQL_ID with different child_numbers and plan_hash_values
PROMPT

SELECT 
    sql_id,
    child_number,
    plan_hash_value,
    executions,
    ROUND(elapsed_time / DECODE(executions, 0, 1, executions) / 1000, 2) as avg_elapsed_ms,
    first_load_time,
    last_load_time
FROM v$sql
WHERE parsing_schema_name = 'HR'
AND sql_text LIKE '%department_id = :1%'
ORDER BY sql_id, child_number;

PROMPT
PROMPT ================================================================
PROMPT 5. WAIT EVENT SUMMARY - Breakdown by wait class
PROMPT ================================================================
PROMPT Should see various wait classes (User I/O, Concurrency, Application)
PROMPT

SELECT 
    wait_class,
    COUNT(*) as session_count,
    ROUND(AVG(WAIT_TIME_MICRO) / 1000, 2) as avg_wait_ms,
    ROUND(MAX(WAIT_TIME_MICRO) / 1000, 2) as max_wait_ms
FROM v$session
WHERE username = 'HR'
AND status = 'ACTIVE'
AND wait_class <> 'Idle'
AND WAIT_TIME_MICRO > 0
GROUP BY wait_class
ORDER BY avg_wait_ms DESC;

PROMPT
PROMPT ================================================================
PROMPT 6. TOP WAIT EVENTS - Most common wait events
PROMPT ================================================================

SELECT 
    event,
    COUNT(*) as occurrences,
    ROUND(AVG(WAIT_TIME_MICRO) / 1000, 2) as avg_wait_ms,
    ROUND(SUM(WAIT_TIME_MICRO) / 1000, 2) as total_wait_ms
FROM v$session
WHERE username = 'HR'
AND status = 'ACTIVE'
AND wait_class <> 'Idle'
AND WAIT_TIME_MICRO > 0
GROUP BY event
ORDER BY total_wait_ms DESC
FETCH FIRST 10 ROWS ONLY;

PROMPT
PROMPT ================================================================
PROMPT 7. SQL EXECUTION SUMMARY - Query statistics
PROMPT ================================================================

SELECT 
    parsing_schema_name,
    COUNT(DISTINCT sql_id) as unique_queries,
    SUM(executions) as total_executions,
    ROUND(AVG(elapsed_time / DECODE(executions, 0, 1, executions) / 1000), 2) as avg_elapsed_ms,
    ROUND(SUM(disk_reads), 0) as total_disk_reads,
    ROUND(SUM(buffer_gets), 0) as total_buffer_gets
FROM v$sqlarea
WHERE parsing_schema_name = 'HR'
AND last_active_time >= SYSDATE - INTERVAL '10' MINUTE
GROUP BY parsing_schema_name;

PROMPT
PROMPT ================================================================
PROMPT 8. RECENT HR ACTIVITY - Timeline of recent queries
PROMPT ================================================================

SELECT 
    TO_CHAR(last_active_time, 'HH24:MI:SS') as last_active,
    sql_id,
    executions,
    ROUND(elapsed_time / DECODE(executions, 0, 1, executions) / 1000, 2) as avg_elapsed_ms,
    SUBSTR(sql_text, 1, 50) as query_text
FROM v$sqlarea
WHERE parsing_schema_name = 'HR'
AND last_active_time >= SYSDATE - INTERVAL '5' MINUTE
AND sql_text NOT LIKE '%v$%'
ORDER BY last_active_time DESC
FETCH FIRST 20 ROWS ONLY;

PROMPT
PROMPT ================================================================
PROMPT 9. LOCK INFORMATION - Detailed lock analysis
PROMPT ================================================================

SELECT 
    l.sid,
    s.serial#,
    s.username,
    l.type as lock_type,
    DECODE(l.lmode,
        0, 'None',
        1, 'Null',
        2, 'Row Share',
        3, 'Row Exclusive',
        4, 'Share',
        5, 'Share Row Exclusive',
        6, 'Exclusive',
        l.lmode) as lock_mode,
    DECODE(l.request,
        0, 'None',
        1, 'Null',
        2, 'Row Share',
        3, 'Row Exclusive',
        4, 'Share',
        5, 'Share Row Exclusive',
        6, 'Exclusive',
        l.request) as lock_request,
    o.owner || '.' || o.object_name as locked_object
FROM v$lock l
JOIN v$session s ON l.sid = s.sid
LEFT JOIN dba_objects o ON l.id1 = o.object_id
WHERE s.username = 'HR'
ORDER BY l.sid;

PROMPT
PROMPT ================================================================
PROMPT 10. EXECUTION PLAN VARIETY - Check plan diversity
PROMPT ================================================================

SELECT 
    sql_id,
    COUNT(DISTINCT child_number) as child_count,
    COUNT(DISTINCT plan_hash_value) as plan_count,
    LISTAGG(DISTINCT TO_CHAR(plan_hash_value), ', ') 
        WITHIN GROUP (ORDER BY plan_hash_value) as plan_hashes
FROM v$sql
WHERE parsing_schema_name = 'HR'
GROUP BY sql_id
HAVING COUNT(DISTINCT child_number) > 1
ORDER BY child_count DESC;

PROMPT
PROMPT ================================================================
PROMPT VERIFICATION COMPLETE
PROMPT ================================================================
PROMPT
PROMPT Expected Results:
PROMPT - Section 1: Should show slow HR queries with high avg_elapsed_ms
PROMPT - Section 2: Should show ACTIVE sessions in WAITING state
PROMPT - Section 3: Should show blocking chains (blocker -> blocked)
PROMPT - Section 4: Should show multiple child_numbers for same SQL_ID
PROMPT - Section 5: Should show various wait classes
PROMPT - Section 6: Should show common wait events
PROMPT
PROMPT If you see data in all sections, the simulator is working correctly!
PROMPT
