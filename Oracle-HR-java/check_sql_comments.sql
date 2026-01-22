-- SQL Script to Check for New Relic SQL Comments in Oracle
-- Run this as HR user or SYSTEM user with appropriate privileges

-- Show Oracle version
PROMPT ================================================
PROMPT Oracle Database Version
PROMPT ================================================
SELECT * FROM v$version;

PROMPT
PROMPT ================================================
PROMPT Checking for SQL with New Relic Comments
PROMPT ================================================
PROMPT Looking for SQL statements with nr_trace_id, nr_span_id, or nr_service...
PROMPT

-- Check for SQL with New Relic comments
SELECT 
    sql_id,
    SUBSTR(sql_fulltext, 1, 500) as sql_text_sample,
    executions,
    last_active_time,
    module,
    action
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '30' MINUTE
  AND (
      sql_fulltext LIKE '%nr_trace_id%' OR 
      sql_fulltext LIKE '%nr_span_id%' OR 
      sql_fulltext LIKE '%nr_service%'
  )
ORDER BY last_active_time DESC
FETCH FIRST 10 ROWS ONLY;

PROMPT
PROMPT ================================================
PROMPT Recent SQL from HR Application (Last 30 minutes)
PROMPT ================================================
PROMPT Looking for SQL statements querying EMPLOYEES, DEPARTMENTS, JOBS tables...
PROMPT

-- Check recent SQL from the HR application
SELECT 
    sql_id,
    CASE 
        WHEN sql_fulltext LIKE '%nr_%' THEN '✓ HAS COMMENT'
        ELSE '✗ NO COMMENT'
    END as has_nr_comment,
    SUBSTR(sql_fulltext, 1, 200) as sql_text_sample,
    executions,
    last_active_time
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '30' MINUTE
  AND (
      (UPPER(sql_fulltext) LIKE '%FROM EMPLOYEES%' OR 
       UPPER(sql_fulltext) LIKE '%FROM DEPARTMENTS%' OR
       UPPER(sql_fulltext) LIKE '%FROM JOBS%' OR
       UPPER(sql_fulltext) LIKE '%FROM JOB_HISTORY%')
      AND sql_fulltext NOT LIKE '%v$sql%'  -- Exclude this query itself
  )
ORDER BY last_active_time DESC
FETCH FIRST 20 ROWS ONLY;

PROMPT
PROMPT ================================================
PROMPT SQL Statistics Summary
PROMPT ================================================

SELECT 
    COUNT(*) as total_hr_queries,
    SUM(CASE WHEN sql_fulltext LIKE '%nr_%' THEN 1 ELSE 0 END) as with_nr_comments,
    SUM(CASE WHEN sql_fulltext NOT LIKE '%nr_%' THEN 1 ELSE 0 END) as without_nr_comments
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '30' MINUTE
  AND (
      UPPER(sql_fulltext) LIKE '%FROM EMPLOYEES%' OR 
      UPPER(sql_fulltext) LIKE '%FROM DEPARTMENTS%' OR
      UPPER(sql_fulltext) LIKE '%FROM JOBS%'
  )
  AND sql_fulltext NOT LIKE '%v$sql%';

PROMPT
PROMPT ================================================
PROMPT Sample SQL with Full Text (if comments found)
PROMPT ================================================

SELECT sql_fulltext
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '30' MINUTE
  AND sql_fulltext LIKE '%nr_trace_id%'
  AND ROWNUM <= 3;

PROMPT
PROMPT ================================================
PROMPT Module and Action Information
PROMPT ================================================

SELECT DISTINCT 
    module,
    action,
    COUNT(*) as query_count
FROM v$sql
WHERE last_active_time > SYSDATE - INTERVAL '30' MINUTE
  AND (
      UPPER(sql_fulltext) LIKE '%FROM EMPLOYEES%' OR 
      UPPER(sql_fulltext) LIKE '%FROM DEPARTMENTS%'
  )
GROUP BY module, action
ORDER BY query_count DESC;

PROMPT
PROMPT ================================================
PROMPT Done! 
PROMPT ================================================
PROMPT
PROMPT Expected Results:
PROMPT   - If working: SQL should have comments like /* nr_trace_id=...,nr_span_id=...,nr_service=... */
PROMPT   - Comments should appear at the beginning of SQL statements
PROMPT   - All application SQL should have these comments if agent is working
PROMPT
