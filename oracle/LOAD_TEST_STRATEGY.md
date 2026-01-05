# Load Testing Strategy for Customer Demos

## Executive Summary

This document outlines a comprehensive load testing approach that demonstrates both system capabilities and limitations.

## Test Scenarios

### Scenario 1: Baseline Performance Test ✅
**Purpose:** Demonstrate normal production performance  
**Configuration:**
```bash
TEST_INTENSITY=medium
POOL_MAX=200 (current)
```
**Expected Results:**
- Success Rate: >95%
- Max VUs: 200
- Response Time p95: <2.5s
- **Status:** Use current results for customer demo

---

### Scenario 2: Peak Capacity Test 🎯 RECOMMENDED
**Purpose:** Show maximum sustainable load  
**Configuration:**
```bash
TEST_INTENSITY=high
POOL_MAX=200 (current)
```
**Expected Results:**
- Success Rate: 85-95%
- Max VUs: 500
- Response Time p95: <3s
- **Action Required:** Run this test with current config

**Why:** This shows customers the realistic maximum capacity before degradation.

---

### Scenario 3: Stress Test - Current Limits ✅ (Completed)
**Purpose:** Identify breaking point  
**Configuration:**
```bash
TEST_INTENSITY=stress
POOL_MAX=200 (current)
```
**Actual Results:**
- Success Rate: 33.49%
- Max VUs: 1000
- Bottleneck: Connection pool exhaustion at ~400-600 VUs
- **Status:** ✅ Complete - validates capacity planning

**Value for Customers:**
- Shows system fails gracefully (no crashes)
- Identifies specific bottleneck (connection pool)
- Proves infrastructure needs for higher loads

---

### Scenario 4: Scaled Stress Test 🔧 (Optional)
**Purpose:** Prove scalability with increased resources  
**Configuration:**
```bash
TEST_INTENSITY=stress
POOL_MAX=800
POOL_MIN=200
```
**Expected Results:**
- Success Rate: >90% (if DB can handle)
- Max VUs: 1000
- **Action:** Only if customer needs 1000+ VU proof

---

## Customer Presentation Strategy

### For Technical Customers:
Present all 3-4 scenarios:
1. **Baseline** - "Daily operations run smoothly"
2. **Peak Capacity** - "We can handle X sustained users"
3. **Stress Test** - "We know our limits and failure modes"
4. **Scaled** - "With these resources, we can scale to Y users"

### For Business Customers:
Focus on Scenarios 1-2:
- "System handles [X] concurrent users with 95%+ success"
- "Peak load tested at [Y] users with [Z]% success"
- Mention stress testing validates failure recovery

---

## Immediate Action Plan

### Step 1: Run HIGH intensity test (Current Config)
```bash
cd oracle
docker-compose down
export TEST_INTENSITY=high
docker-compose up
```
**Goal:** Find realistic sustainable capacity (~400-500 VUs expected)

### Step 2: Analyze Results
- If high intensity passes (>90% success) → Use for customer demo
- If high intensity fails → Your limit is between medium (200 VUs) and high (500 VUs)

### Step 3: Document Findings
Create comparison table:
```
Test Level    | Max VUs | Success Rate | p95 Response | Recommendation
--------------|---------|--------------|--------------|----------------
Medium        | 200     | >95%         | <2.5s        | Daily production
High          | 500     | >85%         | <3s          | Peak capacity
Stress        | 1000    | 33%          | 7.2s         | Breaking point
```

---

## Answer to Your Questions

### "Is existing pool connection (200) okay for K6 tests?"
**Yes, for finding capacity limits.** Your stress test correctly showed:
- 200 connections supports ~400 VUs sustainably
- Beyond that, connection pool is the bottleneck

### "Should I increase pool and retest?"
**Only if:**
1. ✅ Customer needs proof of 1000+ VU capacity
2. ✅ You want to test Oracle DB limits (vs app limits)
3. ✅ You're planning production scaling

**Not needed if:**
- ❌ Just demonstrating current capacity
- ❌ Customer's expected load <500 VUs

### "Is the existing report correct for customer load test?"
**Partially correct:**
- ✅ Stress test results are valid
- ⚠️ Missing: Sustainable capacity test (high intensity)
- ⚠️ For customer demo, also show success scenarios

---

## Recommended Next Steps

1. **Run HIGH intensity test** with POOL_MAX=200
   - This shows realistic peak capacity
   - Present this as "maximum sustained load"

2. **Keep stress test results** (1000 VUs, 33% success)
   - Shows breaking point analysis
   - Validates need for scaling

3. **Create customer report** showing:
   ```
   ✅ Baseline: 200 VUs, 95%+ success
   ✅ Peak: 500 VUs, 85%+ success (to be tested)
   📊 Stress: 1000 VUs, 33% success (capacity planning)
   ```

4. **Only increase POOL_MAX if:**
   - Customer requirement is >500 concurrent users
   - You need to prove horizontal scaling works

---

## Cost-Benefit Analysis

### Option A: Keep Current Config (RECOMMENDED)
**Pros:**
- ✅ Already have stress test data
- ✅ One more test (high) completes picture
- ✅ Shows realistic capacity limits
- ✅ Clear upgrade path for customers

**Cons:**
- ⚠️ Max sustainable ~500 VUs

**Best For:** Most customer demos

---

### Option B: Scale Up & Retest
**Pros:**
- ✅ Proves system can scale
- ✅ Shows DB as potential bottleneck instead
- ✅ Higher capacity numbers for marketing

**Cons:**
- ❌ Need to retest all scenarios
- ❌ May just shift bottleneck to DB
- ❌ More time/resources

**Best For:** High-scale customer requirements

---

## Conclusion

**Your existing stress test (1000 VUs, 66% fail) is VALID and VALUABLE.**

**For complete customer demo, add ONE more test:**
```bash
TEST_INTENSITY=high POOL_MAX=200
```

This gives you:
- ✅ Baseline performance (medium - 200 VUs)
- ✅ Peak capacity (high - 500 VUs) ← **DO THIS**
- ✅ Breaking point (stress - 1000 VUs) ← **YOU HAVE THIS**

**Total tests needed: 2 (you have 1, need 1 more)**

**Then you can confidently tell customers:**
"Our system handles [N] concurrent users with 95%+ success, scales to [M] users at peak load, and gracefully handles overload conditions up to [X] users."
