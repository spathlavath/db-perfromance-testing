# 📚 New Relic SQL Comment Testing - Documentation Index

## 🎯 What This Testing Is About

Testing the New Relic Java agent's PoC feature that prepends SQL comments with trace context to Oracle database queries.

**Expected Result:**
```sql
/* nr_trace_id=1234,nr_span_id=6789,nr_service=myapp */ SELECT * FROM employees
```

---

## 📖 Start Here

### 1. **README_SQL_COMMENT_TESTING.md** ⭐ START HERE
   - **What**: Overview and summary
   - **When**: First document to read
   - **Time**: 5 minutes
   - **For**: Understanding the overall testing goal

### 2. **TESTING_QUICKSTART.md** 🚀 QUICK START
   - **What**: Step-by-step quick start guide
   - **When**: When you're ready to begin testing
   - **Time**: 5 minutes to read, 30 minutes to execute
   - **For**: Quick deployment and testing

---

## 📋 Detailed Guides

### 3. **TESTING_CHECKLIST.md** ✅ TRACKING
   - **What**: Complete testing checklist with checkboxes
   - **When**: Use throughout the testing process
   - **Time**: N/A (reference document)
   - **For**: Tracking progress and collecting results

### 4. **NEWRELIC_SQL_COMMENT_TEST_GUIDE.md** 📚 DETAILED
   - **What**: Comprehensive testing procedures and troubleshooting
   - **When**: When you need detailed instructions
   - **Time**: 15 minutes to read
   - **For**: In-depth testing guidance and verification

### 5. **CUSTOM_NEWRELIC_JAR_SETUP.md** ⚙️ SETUP
   - **What**: How to use a custom/snapshot New Relic JAR
   - **When**: Before deployment
   - **Time**: 10 minutes
   - **For**: Modifying Dockerfile to use snapshot JAR

---

## 🛠️ Test Scripts

### 6. **test-sql-comments.sh** 🧪 AUTOMATED TEST
   ```bash
   ./test-sql-comments.sh
   ```
   - **What**: Automated test script
   - **Does**: Generates traffic and checks agent status
   - **Time**: 2-3 minutes to run
   - **For**: Quick verification

### 7. **check_sql_comments.sql** 🔍 ORACLE VERIFICATION
   ```bash
   sqlplus hr@oracle @check_sql_comments.sql
   ```
   - **What**: Oracle SQL queries to verify comments
   - **Does**: Checks v$sql for prepended comments
   - **Time**: 1 minute to run
   - **For**: Verifying SQL comments in Oracle

### 8. **check_sql_comments.sh** 🤖 AUTOMATED ORACLE CHECK
   ```bash
   ./check_sql_comments.sh
   ```
   - **What**: Automated wrapper for SQL verification
   - **Does**: Runs check_sql_comments.sql automatically
   - **Time**: 1 minute
   - **For**: Quick Oracle verification

---

## 📚 Reference Documents

### 9. **AGENT_CONFIGURATION.md** (existing)
   - **What**: APM agent configuration guide
   - **For**: Understanding agent options

### 10. **README.md** (existing)
   - **What**: Application overview
   - **For**: Understanding the Java application

### 11. **DEPLOYMENT_GUIDE.md** (existing)
   - **What**: General deployment instructions
   - **For**: VM deployment details

---

## 🗺️ Testing Workflow

```
1. Read Overview
   └─> README_SQL_COMMENT_TESTING.md

2. Get Snapshot JAR
   └─> Contact New Relic team

3. Setup Custom JAR
   └─> CUSTOM_NEWRELIC_JAR_SETUP.md

4. Quick Deploy
   └─> TESTING_QUICKSTART.md
   
5. Run Tests
   ├─> test-sql-comments.sh
   └─> check_sql_comments.sh

6. Track Progress
   └─> TESTING_CHECKLIST.md

7. Detailed Verification (if needed)
   └─> NEWRELIC_SQL_COMMENT_TEST_GUIDE.md

8. Report Results
   └─> TESTING_CHECKLIST.md (deliverables section)
```

---

## 📊 Document Quick Reference

| Priority | Document | Size | Purpose |
|----------|----------|------|---------|
| ⭐⭐⭐ | README_SQL_COMMENT_TESTING.md | 6.6K | Overview & summary |
| ⭐⭐⭐ | TESTING_QUICKSTART.md | 6.1K | Quick start guide |
| ⭐⭐ | TESTING_CHECKLIST.md | 8.1K | Progress tracking |
| ⭐⭐ | CUSTOM_NEWRELIC_JAR_SETUP.md | 6.2K | JAR setup guide |
| ⭐ | NEWRELIC_SQL_COMMENT_TEST_GUIDE.md | 11K | Detailed procedures |
| 🛠️ | test-sql-comments.sh | 3.2K | Test automation |
| 🛠️ | check_sql_comments.sql | 3.7K | Oracle verification |
| 🛠️ | check_sql_comments.sh | 889B | SQL wrapper script |

---

## 🎯 For Different Scenarios

### "I'm New - Where Do I Start?"
1. README_SQL_COMMENT_TESTING.md
2. TESTING_QUICKSTART.md
3. CUSTOM_NEWRELIC_JAR_SETUP.md

### "I Need Step-by-Step Instructions"
1. TESTING_QUICKSTART.md
2. TESTING_CHECKLIST.md
3. NEWRELIC_SQL_COMMENT_TEST_GUIDE.md

### "I Just Want to Run Tests"
1. test-sql-comments.sh
2. check_sql_comments.sh
3. TESTING_CHECKLIST.md (results section)

### "I Need Troubleshooting Help"
1. NEWRELIC_SQL_COMMENT_TEST_GUIDE.md (troubleshooting section)
2. AGENT_CONFIGURATION.md
3. TESTING_CHECKLIST.md (issues section)

### "I Need to Report Results"
1. TESTING_CHECKLIST.md (deliverables section)
2. check_sql_comments.sql (run and save output)
3. Collect logs via test-sql-comments.sh

---

## 📁 File Organization

```
oracle-java/
├── README_SQL_COMMENT_TESTING.md      ⭐ Start here
├── TESTING_QUICKSTART.md              🚀 Quick guide
├── TESTING_CHECKLIST.md               ✅ Track progress
├── NEWRELIC_SQL_COMMENT_TEST_GUIDE.md 📚 Detailed guide
├── CUSTOM_NEWRELIC_JAR_SETUP.md       ⚙️ JAR setup
├── test-sql-comments.sh               🧪 Test script
├── check_sql_comments.sql             🔍 Oracle SQL
├── check_sql_comments.sh              🤖 SQL wrapper
├── README.md                          📖 App overview
├── AGENT_CONFIGURATION.md             ⚙️ Agent config
└── DEPLOYMENT_GUIDE.md                🚀 VM deployment
```

---

## 🚀 Quick Commands

```bash
# Make scripts executable
chmod +x test-sql-comments.sh check_sql_comments.sh

# Deploy to VM
rsync -avz oracle-java/ user@vm:~/oracle-java/

# Run automated test
./test-sql-comments.sh

# Check Oracle for SQL comments
./check_sql_comments.sh

# View application logs
docker logs oracle-test-app

# Full test cycle
./deploy.sh up && ./test-sql-comments.sh && ./check_sql_comments.sh
```

---

## 💡 Tips

1. **First Time**: Read docs in order 1-5
2. **Subsequent Tests**: Go straight to scripts (6-8)
3. **Troubleshooting**: Check guide #4 (NEWRELIC_SQL_COMMENT_TEST_GUIDE.md)
4. **Reporting**: Use checklist #3 (TESTING_CHECKLIST.md)

---

## ✅ Success Criteria

- [ ] Read README_SQL_COMMENT_TESTING.md
- [ ] Obtained New Relic snapshot JAR
- [ ] Completed CUSTOM_NEWRELIC_JAR_SETUP.md
- [ ] Deployed using TESTING_QUICKSTART.md
- [ ] Ran test-sql-comments.sh
- [ ] Verified with check_sql_comments.sh
- [ ] Found SQL comments in Oracle v$sql
- [ ] Completed TESTING_CHECKLIST.md
- [ ] Reported results to New Relic team

---

**Questions?** Check the appropriate document above or review NEWRELIC_SQL_COMMENT_TEST_GUIDE.md for comprehensive guidance.
