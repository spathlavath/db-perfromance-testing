# Wait Events Testing Guide

## Overview

Both applications now generate comprehensive wait events for OTel monitoring.

## Test Scenarios

### oracle-java (4 workers)
1. **Read-Only** - Fast queries
2. **Slow Queries** - Heavy aggregations
3. **Blocking** - Row/table locks
4. **Wait Events** - Explicit TX locks, buffer waits ✨ NEW

### Oracle-HR-java (3 workers)
1. **Read-Only** - Fast queries
2. **Slow Queries** - Heavy aggregations
3. **Wait Events** - Concurrent access patterns ✨ NEW

## Wait Events Generated

### oracle-java (Port 3001)
| Wait Event | How Generated | Scenario |
|-----------|---------------|----------|
| `enq: TX - row lock contention` | Lock row → SELECT locked row | Wait Events |
| `enq: TM - contention` | Table-level locks | Blocking |
| `buffer busy waits` | Concurrent access | Wait Events |
| `latch: cache buffers chains` | High concurrency | Wait Events |
| `direct path read` | Full table scans | Slow Queries |

### Oracle-HR-java (Port 3002)
| Wait Event | How Generated | Scenario |
|-----------|---------------|----------|
| `buffer busy waits` | 5 concurrent queries to same rows | Wait Events |
| `latch: cache buffers chains` | Concurrent dept queries | Wait Events |
| `CPU time` | Parallel aggregations | Wait Events |
| `db file sequential read` | Index scans | Read-Only |

## Installation

```bash
# Already installed if you ran setup-loadtest.sh
# Just restart services to pick up new scenario

sudo systemctl restart oracle-loadtest
sudo systemctl restart oracle-hr-loadtest

# Verify 4 workers for oracle-java
sudo journalctl -u oracle-loadtest -f | grep Worker

# Verify 3 workers for Oracle-HR-java
sudo journalctl -u oracle-hr-loadtest -f | grep Worker
```

## Validation

### Check Wait Events in OTel
```sql
SELECT count(*), average(current_wait_time_ms)
FROM newrelicoracledb.wait_events
FACET wait_event_name
WHERE wait_event_name != 'SQL*Net message from client'
SINCE 10 minutes ago
```

### Expected Results
```
Wait Event Name                    | Count | Avg Wait (ms)
-----------------------------------|-------|---------------
enq: TX - row lock contention      | 50+   | 2000-5000
buffer busy waits                  | 100+  | 10-50
latch: cache buffers chains        | 80+   | 5-20
db file sequential read            | 200+  | 2-5
```

## Differences from Previous Version

| Feature | Before | After |
|---------|--------|-------|
| oracle-java workers | 3 | **4** (+Wait Events) |
| Oracle-HR-java workers | 2 | **3** (+Wait Events) |
| TX lock testing | Blocking only | **Dedicated scenario** |
| Buffer wait testing | Incidental | **Explicit generation** |
| Latch testing | None | **Concurrent patterns** |

## Files Added

- `oracle-java/scenario-wait-events.sh`
- `Oracle-HR-java/scenario-wait-events.sh`

## What Changed

### oracle-java/run-parallel.sh
```bash
# Before: 3 workers
# After:  4 workers (added Wait Events)
```

### Oracle-HR-java/run-parallel.sh
```bash
# Before: 2 workers
# After:  3 workers (added Wait Events)
```

Ready to commit! 🚀
