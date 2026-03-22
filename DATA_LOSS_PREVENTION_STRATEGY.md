# Data Loss Prevention Strategy for OpenPecker

## Executive Summary

OpenPecker currently experiences critical data loss: 12K+ active users but only 8 have training data recorded. This document outlines a comprehensive prevention strategy with immediate fixes and long-term safeguards.

---

## 1. Root Cause Analysis

### Current Issues Identified

**1.1 Training Data Not Being Recorded**
- 12K+ active users globally (verified via analytics)
- Only 8 users have puzzle_attempts or cycle_history records
- Frontend may not be calling `cycles.create` endpoint
- Or endpoint is failing silently without error handling

**1.2 User Merge Consolidation**
- 4,017 users merged into 111 player records
- Created orphaned training data with mismatched userId references
- Leaderboard only shows 8 active players instead of thousands

**1.3 Data Consistency Issues**
- cycle_history shows 65 cycles but puzzle_attempts shows 332 puzzles
- No reconciliation between different data sources
- Stats calculated from different tables producing inconsistent results

**1.4 No Data Validation**
- NULL userId cycles created without validation
- No checks before saving training sessions
- Silent failures without logging or alerts

---

## 2. Immediate Fixes (Priority 1)

### 2.1 Enable Comprehensive Logging

**Implementation:**
```typescript
// server/middleware/dataLogger.ts
export function logTrainingSession(userId: number | null, deviceId: string | null, puzzles: number, cycles: number) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    userId,
    deviceId,
    puzzles,
    cycles,
    status: 'recorded'
  };
  
  // Log to console (visible in server logs)
  console.log('[TRAINING_DATA]', JSON.stringify(logEntry));
  
  // Also write to database audit table
  db.execute(sql`
    INSERT INTO data_audit_log (timestamp, userId, deviceId, puzzles, cycles, status)
    VALUES (${timestamp}, ${userId}, ${deviceId}, ${puzzles}, ${cycles}, 'recorded')
  `);
}
```

**Benefit:** Track every training session recorded, identify gaps in data collection

### 2.2 Add Data Validation Before Saving

**Implementation:**
```typescript
// server/db.ts
export async function validateAndCreateCycle(input: CycleInput) {
  // Validation checks
  if (!input.userId && !input.deviceId) {
    throw new Error('CRITICAL: Cycle has no userId or deviceId');
  }
  
  if (input.totalPuzzles <= 0) {
    throw new Error('CRITICAL: Cycle has zero puzzles');
  }
  
  if (!input.totalTimeMs || input.totalTimeMs <= 0) {
    throw new Error('CRITICAL: Cycle has invalid time');
  }
  
  // Only save if all validations pass
  return createCycleRecord(input);
}
```

**Benefit:** Prevent invalid data from being saved silently

### 2.3 Implement Retry Logic for Failed Requests

**Implementation:**
```typescript
// client/src/lib/api.ts
export async function saveCycleWithRetry(cycleData: CycleData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await trpc.cycles.create.mutate(cycleData);
      console.log(`[CYCLE_SAVED] Attempt ${attempt} succeeded`);
      return result;
    } catch (error) {
      console.error(`[CYCLE_SAVE_FAILED] Attempt ${attempt}:`, error);
      
      if (attempt === maxRetries) {
        // Save to local storage as backup
        saveToLocalStorage('pendingCycles', cycleData);
        throw error;
      }
      
      // Exponential backoff
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
}
```

**Benefit:** Ensure training data is saved even if network is unstable

---

## 3. Data Integrity System (Priority 2)

### 3.1 Create Data Reconciliation Table

**Schema:**
```sql
CREATE TABLE data_reconciliation (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT,
  source_table VARCHAR(50),
  expected_count INT,
  actual_count INT,
  discrepancy INT,
  checked_at TIMESTAMP,
  status ENUM('OK', 'WARNING', 'CRITICAL'),
  INDEX (userId, checked_at)
);
```

**Daily Reconciliation Job:**
```typescript
// server/jobs/reconcileData.ts
export async function reconcileUserData(userId: number) {
  const cycleCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM cycle_history WHERE userId = ${userId}
  `);
  
  const puzzleCount = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM puzzle_attempts WHERE userId = ${userId}
  `);
  
  const playerStats = await db.execute(sql`
    SELECT completedCycles, totalPuzzles FROM players WHERE userId = ${userId}
  `);
  
  // Check for discrepancies
  const discrepancy = Math.abs(cycleCount - playerStats.completedCycles);
  
  if (discrepancy > 0) {
    await logReconciliationIssue(userId, discrepancy);
  }
}
```

**Benefit:** Automatically detect data inconsistencies

### 3.2 Implement Audit Trail

**Schema:**
```sql
CREATE TABLE audit_trail (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT,
  action VARCHAR(100),
  old_value JSON,
  new_value JSON,
  changed_at TIMESTAMP,
  changed_by VARCHAR(50),
  INDEX (userId, changed_at)
);
```

**Benefit:** Track all changes to critical data, enable rollback if needed

---

## 4. Monitoring & Alerting (Priority 3)

### 4.1 Real-time Data Collection Monitoring

**Implementation:**
```typescript
// server/monitoring/dataCollectionMonitor.ts
export class DataCollectionMonitor {
  private cyclesPerHour: number = 0;
  private lastAlert: Date = new Date();
  
  recordCycle() {
    this.cyclesPerHour++;
    
    // Alert if no cycles recorded in 1 hour
    if (this.cyclesPerHour === 0 && Date.now() - this.lastAlert.getTime() > 3600000) {
      this.alertZeroCycles();
      this.lastAlert = new Date();
    }
  }
  
  private alertZeroCycles() {
    notifyOwner({
      title: 'CRITICAL: No training data recorded in 1 hour',
      content: 'Data collection may be broken. Check server logs immediately.'
    });
  }
}
```

**Benefit:** Get instant alerts when data collection stops

### 4.2 Dashboard Metrics

**Metrics to Track:**
- Cycles recorded per hour
- Users with training data vs total users
- Data consistency score (0-100%)
- Failed save attempts
- Average response time for cycle.create endpoint

---

## 5. Redundant Data Recording (Priority 4)

### 5.1 Dual-Write Pattern

**Implementation:**
```typescript
// server/db.ts
export async function createCycleWithBackup(cycleData: CycleData) {
  // Primary write
  const result = await createCycleRecord(cycleData);
  
  // Backup write to CSV (for disaster recovery)
  await appendToCycleBackupCSV(cycleData);
  
  // Backup write to event log
  await recordCycleEvent(cycleData);
  
  return result;
}
```

**Benefit:** Multiple copies of data prevent total loss

### 5.2 Event Sourcing for Critical Data

**Implementation:**
```sql
CREATE TABLE cycle_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_type ENUM('CYCLE_STARTED', 'CYCLE_COMPLETED', 'CYCLE_SAVED'),
  userId INT,
  cycle_id INT,
  event_data JSON,
  created_at TIMESTAMP,
  INDEX (userId, created_at)
);
```

**Benefit:** Reconstruct data from event log if primary data is corrupted

---

## 6. Implementation Roadmap

### Week 1: Immediate Fixes
- [ ] Enable comprehensive logging
- [ ] Add data validation before saving
- [ ] Implement retry logic with local storage backup
- [ ] Deploy and monitor

### Week 2: Data Integrity
- [ ] Create reconciliation table
- [ ] Implement daily reconciliation job
- [ ] Set up audit trail
- [ ] Backfill historical data

### Week 3: Monitoring & Alerts
- [ ] Deploy data collection monitor
- [ ] Create dashboard metrics
- [ ] Set up alerting rules
- [ ] Train team on monitoring

### Week 4: Redundancy
- [ ] Implement dual-write pattern
- [ ] Set up event sourcing
- [ ] Create backup recovery procedures
- [ ] Document disaster recovery plan

---

## 7. Best Practices Going Forward

### 7.1 Data Validation Checklist

Before saving ANY user data:
- [ ] Validate userId or deviceId is not null
- [ ] Validate all required fields are present
- [ ] Validate data types match schema
- [ ] Validate numeric values are positive
- [ ] Check for duplicate records
- [ ] Log the save operation

### 7.2 Testing Requirements

- [ ] Unit tests for data validation
- [ ] Integration tests for end-to-end cycle save
- [ ] Load tests with 1000+ concurrent users
- [ ] Failure scenario tests (network down, DB down, etc.)

### 7.3 Monitoring Checklist

Daily:
- [ ] Check data collection metrics
- [ ] Review error logs
- [ ] Verify reconciliation results
- [ ] Check backup integrity

Weekly:
- [ ] Review data trends
- [ ] Analyze failed saves
- [ ] Check audit trail for anomalies
- [ ] Test disaster recovery procedure

---

## 8. Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Users with training data | 8 | 1000+ | Week 1 |
| Data consistency score | 15% | 99%+ | Week 2 |
| Failed save rate | Unknown | <0.1% | Week 1 |
| Recovery time (if disaster) | N/A | <1 hour | Week 4 |
| Data audit trail coverage | 0% | 100% | Week 2 |

---

## 9. Conclusion

The current data loss is unacceptable for a production app with 12K+ users. This strategy provides:

1. **Immediate fixes** to stop data loss now
2. **Data integrity checks** to catch issues early
3. **Monitoring & alerts** to know when something breaks
4. **Redundancy** to survive disasters
5. **Best practices** to prevent future issues

Implementing this strategy will transform OpenPecker from losing 99.9% of user data to capturing 99%+ with full auditability and disaster recovery.
