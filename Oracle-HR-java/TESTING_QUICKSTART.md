# Quick Start: Testing New Relic SQL Comment Prepending with Oracle

## 🎯 Goal
Test the New Relic Java agent's PoC feature that prepends SQL comments with trace context:
```sql
/* nr_trace_id=1234,nr_span_id=6789,nr_service=myapp */ SELECT * FROM employees
```

## 📁 What You Have
- ✅ Oracle Java Spring Boot application (this directory)
- ✅ Oracle Database running on VM (10.0.1.36:1521/pdb1)
- ✅ Docker setup ready to deploy
- ✅ Test scripts and verification SQL

## 🚀 Quick Steps (5 Minutes)

### 1️⃣ Get the New Relic Snapshot JAR

Ask the New Relic team for the snapshot JAR with SQL comment instrumentation, then:

```bash
# Copy it to this directory
cp /path/to/newrelic-snapshot.jar ./newrelic-agent-custom.jar
```

### 2️⃣ Modify Dockerfile

Edit `Dockerfile`, find lines 27-33 and replace with:

```dockerfile
# Use custom New Relic Java agent snapshot
RUN mkdir -p /app/newrelic
COPY newrelic-agent-custom.jar /app/newrelic/newrelic.jar
RUN chmod 644 /app/newrelic/newrelic.jar
```

See `CUSTOM_NEWRELIC_JAR_SETUP.md` for details.

### 3️⃣ Configure Agent

Edit `.env` and set:

```bash
USE_OTEL=false
USE_NEW_RELIC=true
NEW_RELIC_LICENSE_KEY=your-key-here
NEW_RELIC_APP_NAME=Oracle-HR-SQL-Test
NEW_RELIC_LOG_LEVEL=finest
```

### 4️⃣ Deploy to Oracle VM

```bash
# From your Mac - transfer files
cd /Users/spathlavath/otel/db-perfromance-testing
rsync -avz --progress oracle-java/ <user>@<vm-ip>:~/oracle-java/

# SSH to VM
ssh <user>@<vm-ip>

# Deploy
cd ~/oracle-java
./deploy.sh up
```

### 5️⃣ Run Tests and Verify

On the VM:

```bash
# Generate test traffic and check logs
./test-sql-comments.sh

# Check Oracle for SQL comments
./check_sql_comments.sh
# OR manually: sqlplus hr@//10.0.1.36:1521/pdb1 @check_sql_comments.sql
```

## ✅ What to Look For

### In Application Logs
```bash
docker logs oracle-test-app 2>&1 | grep -i "New Relic"
```
Should show: "New Relic Agent has started"

### In Oracle v$sql
Run the check script and look for SQL like:
```sql
/* nr_trace_id=abc123,nr_span_id=xyz789,nr_service=Oracle-HR-SQL-Test */ 
SELECT e.EMPLOYEE_ID, e.FIRST_NAME, e.LAST_NAME, e.EMAIL ...
```

### Success Indicators
- ✅ Comments appear in ALL SQL statements from the app
- ✅ Comments contain: `nr_trace_id`, `nr_span_id`, `nr_service`
- ✅ Both PreparedStatements and CallableStatements have comments
- ✅ No SQL errors or performance issues

## 📚 Detailed Documentation

| Document | Purpose |
|----------|---------|
| `NEWRELIC_SQL_COMMENT_TEST_GUIDE.md` | Comprehensive testing guide |
| `CUSTOM_NEWRELIC_JAR_SETUP.md` | How to use snapshot JAR |
| `AGENT_CONFIGURATION.md` | Agent configuration options |
| `test-sql-comments.sh` | Automated test script |
| `check_sql_comments.sql` | Oracle verification queries |

## 🐛 Troubleshooting

### Agent Not Loading
```bash
# Check if JAR exists in container
docker exec oracle-test-app ls -lh /app/newrelic/

# Check agent version
docker exec oracle-test-app java -jar /app/newrelic/newrelic.jar version

# View startup logs
docker logs oracle-test-app 2>&1 | head -100
```

### No Comments in SQL
1. Verify agent is loaded (check logs)
2. Ensure `USE_NEW_RELIC=true` in `.env`
3. Check `NEW_RELIC_LICENSE_KEY` is set
4. Rebuild container: `./deploy.sh rebuild`

### Can't Connect to Oracle
```bash
# Test connection from VM
docker exec oracle-test-app nc -zv 10.0.1.36 1521

# Check Oracle is listening
sqlplus hr/password@//10.0.1.36:1521/pdb1
```

## 📊 Test Coverage

The application tests these SQL patterns:

| Endpoint | SQL Type | Test Coverage |
|----------|----------|---------------|
| `GET /employees` | SELECT with JOIN | ✅ PreparedStatement |
| `GET /employees/{id}` | SELECT with WHERE | ✅ PreparedStatement with params |
| `GET /departments` | SELECT with aggregates | ✅ Complex queries |
| `POST /employees` | INSERT | ✅ DML operations |
| `PUT /employees/{id}` | UPDATE | ✅ DML with WHERE |
| `GET /reports/salary-by-department` | Complex SELECT | ✅ JOINs, GROUP BY, aggregates |

To test CallableStatements, see the stored procedure example in `NEWRELIC_SQL_COMMENT_TEST_GUIDE.md`.

## 📝 Reporting Results

After testing, provide to New Relic team:

1. **SQL Examples**: Export from Oracle showing comments
   ```sql
   SELECT sql_fulltext FROM v$sql WHERE sql_fulltext LIKE '%nr_trace_id%';
   ```

2. **Agent Logs**: 
   ```bash
   docker logs oracle-test-app > agent-logs.txt 2>&1
   ```

3. **Environment**:
   - Oracle Version: 23ai FREE
   - JDBC Driver: ojdbc8 21.9.0.0
   - Java Version: 17
   - Spring Boot: 3.2.0

4. **Any Issues**: Errors, unexpected behavior, performance impact

## 🔗 Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   k6 Load Test  │─────▶│   Java App       │─────▶│  Oracle 23ai    │
│   (Optional)    │      │   + NR Agent     │      │   (v$sql)       │
└─────────────────┘      │   Port 3000      │      │   10.0.1.36     │
                         └──────────────────┘      └─────────────────┘
                                 │
                                 ▼
                         ┌──────────────────┐
                         │  New Relic       │
                         │  Staging         │
                         └──────────────────┘
```

## 💡 Key Points

1. **Spring JdbcTemplate** → Uses PreparedStatement internally
2. **All SQL queries** → Should get comments prepended
3. **Oracle v$sql** → Best place to verify comments
4. **No code changes** → Agent handles everything via instrumentation
5. **Testing environment** → Uses Oracle 23ai FREE in PDB

## 🆘 Need Help?

- Review logs: `docker logs oracle-test-app`
- Check deploy script: `./deploy.sh --help`
- See full guides in the documentation files
- Verify Oracle connectivity: Run `check_sql_comments.sh`

---

**Ready to test?** Follow the 5 steps above! 🚀
