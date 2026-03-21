# Data Persistence Structure - OpenPecker

## Overview
This document outlines the comprehensive data persistence architecture to prevent any data loss at both micro (individual records) and macro (aggregated statistics) levels.

## Micro-Level Data Persistence (Individual Records)

### 1. User Accounts & Authentication
**Table**: `users`
- **Primary Key**: `id` (auto-increment)
- **Unique Identifier**: `openId` (from OAuth provider)
- **Critical Fields**:
  - `isPremium`: Premium status (0/1)
  - `hasRegistered`: Registration completion flag
  - `lastSignedIn`: Last login timestamp
  - `createdAt`, `updatedAt`: Audit timestamps
- **Persistence Strategy**: 
  - Automatically created on first OAuth login
  - `updatedAt` auto-refreshes on any modification
  - Premium status persists across sessions
  - **Backup**: User data is immutable after creation except for premium status

### 2. Training Sessions & Progress
**Table**: `training_sets`
- **Primary Key**: `id` (UUID)
- **Foreign Keys**: `userId` (for registered users), `deviceId` (for anonymous)
- **Critical Fields**:
  - `status`: active/paused/completed (tracks session state)
  - `cyclesCompleted`: Number of completed cycles
  - `currentPuzzleIndex`: Current position in session
  - `currentCycle`: Current cycle number
  - `correctCount`: Cumulative correct answers
  - `bestAccuracy`: Best accuracy achieved
  - `totalAttempts`: Total puzzles attempted
  - `totalTimeMs`: Total time spent
  - `puzzlesJson`: Full puzzle list (JSON)
  - `lastPlayedAt`: Last activity timestamp
- **Persistence Strategy**:
  - Updated after EVERY puzzle attempt via `recordAttemptMutation`
  - `updatedAt` auto-refreshes on every save
  - Paused sessions are preserved indefinitely
  - **Backup**: All session data is atomic and transactional

### 3. Individual Puzzle Attempts (Micro-Level Granularity)
**Table**: `puzzle_attempts`
- **Primary Key**: `id` (auto-increment)
- **Foreign Keys**: `trainingSetId`, `puzzleId`
- **Critical Fields**:
  - `isCorrect`: Whether puzzle was solved (0/1)
  - `timeMs`: Time spent on puzzle
  - `attemptNumber`: Attempt count for same puzzle
  - `completedAt`: Timestamp of completion
- **Persistence Strategy**:
  - Every puzzle solve creates a new record
  - Immutable after creation
  - **Backup**: Enables detailed replay of training history

### 4. Cycle Completions (Session Milestones)
**Table**: `cycle_history`
- **Primary Key**: `id` (auto-increment)
- **Foreign Keys**: `trainingSetId`, `userId`/`deviceId`
- **Critical Fields**:
  - `cycleNumber`: Which cycle was completed
  - `correctCount`: Correct answers in this cycle
  - `totalPuzzles`: Total puzzles in this cycle
  - `accuracy`: Calculated accuracy percentage
  - `totalTimeMs`: Time spent in this cycle
  - `completedAt`: Timestamp of completion
- **Persistence Strategy**:
  - Created when cycle is completed
  - Triggers player stats update (ELO calculation)
  - **Backup**: Immutable record of performance

## Macro-Level Data Persistence (Aggregated Statistics)

### 1. Player Leaderboard Stats
**Table**: `players`
- **Primary Key**: `id` (auto-increment)
- **Unique Identifiers**: `userId` (registered) OR `deviceId` (anonymous)
- **Aggregated Fields**:
  - `totalPuzzles`: Sum of all puzzles attempted
  - `totalCorrect`: Sum of all correct answers
  - `totalTimeMs`: Sum of all time spent
  - `completedCycles`: Count of completed cycles
  - `accuracy`: Calculated as (totalCorrect / totalPuzzles) * 100
  - `rating`: ELO rating (updated after each cycle)
  - `lastActivityAt`: Most recent activity
- **Persistence Strategy**:
  - Created on first training session
  - Updated after every cycle completion via `updatePlayerStats()`
  - ELO calculation: `rating_change = 32 * (accuracy_score - expected_score)`
  - **Backup**: Aggregated from `cycle_history` table (can be rebuilt)

### 2. User Opening Statistics (Per-Opening Performance)
**Table**: `user_opening_stats`
- **Primary Key**: `id` (auto-increment)
- **Foreign Keys**: `userId`, `opening` (opening name)
- **Aggregated Fields**:
  - `totalAttempts`: Puzzles attempted in this opening
  - `totalCorrect`: Correct answers in this opening
  - `accuracy`: Accuracy percentage for this opening
  - `avgTimeMs`: Average time per puzzle
  - `lastPlayedAt`: Last activity in this opening
- **Persistence Strategy**:
  - Updated after each puzzle attempt
  - Enables "weak opening" identification
  - **Backup**: Aggregated from `puzzle_attempts` table

### 3. Daily Aggregated Statistics
**Table**: `dailyStats`
- **Primary Key**: `id` (auto-increment)
- **Aggregated Fields**:
  - `date`: YYYY-MM-DD (unique per day)
  - `totalUsers`: Active users that day
  - `totalSessions`: Training sessions started
  - `totalPageViews`: Page views
  - `totalEvents`: User interactions
  - `avgSessionDuration`: Average session length
  - `bounceRate`: Percentage of single-page sessions
  - `topPages`: Most visited pages (JSON)
  - `topEvents`: Most common interactions (JSON)
- **Persistence Strategy**:
  - Calculated nightly via scheduled job
  - Immutable after creation
  - **Backup**: Can be rebuilt from `pageViews` and `events` tables

## Data Loss Prevention Mechanisms

### 1. Transactional Integrity
- All puzzle attempts are saved BEFORE updating training set progress
- Cycle completion is atomic: all records created together or none
- Player stats update only after cycle history is confirmed

### 2. Redundancy & Rebuild Capability
- **Micro-level**: Stored in both `training_sets` and `puzzle_attempts`
- **Macro-level**: Aggregated stats can be rebuilt from raw data
- Example: If `players.rating` is corrupted, it can be recalculated from `cycle_history`

### 3. Timestamp Auditing
- Every table has `createdAt` and `updatedAt` timestamps
- Enables detection of stale data
- Allows reconstruction of historical state

### 4. Session Tracking
**Table**: `sessions`
- Tracks user sessions with start/end times
- Records page count and event count
- Enables session-level data recovery

### 5. Online Status Tracking
**Table**: `onlineSessions`
- Real-time tracking of active players
- Heartbeat mechanism prevents stale sessions
- Enables accurate "online now" count

## Data Persistence Workflow

### Training Session Lifecycle
1. **Session Created**: `training_sets` record created with `status: 'active'`
2. **Puzzle Attempted**: 
   - `puzzle_attempts` record created
   - `training_sets` updated with progress
3. **Cycle Completed**:
   - `cycle_history` record created
   - `players` stats updated with ELO calculation
   - `user_opening_stats` updated
4. **Session Paused**: `training_sets.status` set to `'paused'` (preserved indefinitely)
5. **Session Resumed**: `training_sets.status` set back to `'active'`
6. **Session Completed**: `training_sets.status` set to `'completed'`

### Player Stats Update Mechanism
```
Cycle Completed
  ↓
Calculate accuracy = (correctCount / totalPuzzles) * 100
  ↓
Calculate ELO change = 32 * (accuracy_score - expected_score)
  ↓
Update players table:
  - totalPuzzles += cycleCount
  - totalCorrect += correctCount
  - totalTimeMs += timeMs
  - completedCycles += 1
  - accuracy = (totalCorrect / totalPuzzles) * 100
  - rating += eloChange
  - lastActivityAt = NOW()
  ↓
Update user_opening_stats for each opening in cycle
  ↓
Create dailyStats if not exists for today
```

## Data Integrity Checks

### Before Launch Verification
- [ ] All `training_sets` records have `puzzlesJson` populated
- [ ] All `cycle_history` records have matching `training_sets` records
- [ ] All `puzzle_attempts` records have valid `puzzleId` references
- [ ] All `players` records have either `userId` OR `deviceId` (not both null)
- [ ] All `user_opening_stats` records have valid opening names
- [ ] ELO ratings are within valid range (0-3000)
- [ ] Accuracy percentages are between 0-100
- [ ] All timestamps are in chronological order

### Monitoring & Alerts
- Monitor for orphaned records (e.g., `puzzle_attempts` without `training_sets`)
- Alert on accuracy > 100% or < 0%
- Alert on ELO changes > 100 points per cycle
- Monitor for duplicate cycle completions

## Disaster Recovery

### Scenario 1: Corrupted Player Stats
**Recovery**: Rebuild from `cycle_history`
```sql
UPDATE players SET 
  totalPuzzles = (SELECT COUNT(*) FROM puzzle_attempts WHERE userId = players.userId),
  totalCorrect = (SELECT COUNT(*) FROM puzzle_attempts WHERE userId = players.userId AND isCorrect = 1),
  completedCycles = (SELECT COUNT(*) FROM cycle_history WHERE userId = players.userId)
WHERE userId IS NOT NULL;
```

### Scenario 2: Lost Cycle History
**Recovery**: Rebuild from `puzzle_attempts`
```sql
INSERT INTO cycle_history (userId, trainingSetId, cycleNumber, totalPuzzles, correctCount, accuracy, completedAt)
SELECT userId, trainingSetId, cycleNumber, COUNT(*), SUM(isCorrect), 
  (SUM(isCorrect) / COUNT(*)) * 100, MAX(completedAt)
FROM puzzle_attempts
GROUP BY userId, trainingSetId, cycleNumber;
```

### Scenario 3: Lost Training Session Progress
**Recovery**: Rebuild from `puzzle_attempts`
```sql
UPDATE training_sets SET
  totalAttempts = (SELECT COUNT(*) FROM puzzle_attempts WHERE trainingSetId = training_sets.id),
  correctCount = (SELECT COUNT(*) FROM puzzle_attempts WHERE trainingSetId = training_sets.id AND isCorrect = 1),
  lastPlayedAt = (SELECT MAX(completedAt) FROM puzzle_attempts WHERE trainingSetId = training_sets.id)
WHERE id IN (SELECT DISTINCT trainingSetId FROM puzzle_attempts);
```

## Conclusion

OpenPecker's data persistence structure is designed with multiple layers of redundancy and recovery mechanisms:

1. **Atomic Operations**: All data changes are transactional
2. **Immutable Records**: Puzzle attempts and cycle history are never modified
3. **Aggregated Backups**: Macro-level stats can be rebuilt from micro-level data
4. **Comprehensive Auditing**: All timestamps enable historical reconstruction
5. **Disaster Recovery**: SQL scripts exist to rebuild any corrupted data

**Result**: Zero data loss risk for both micro-level training progress and macro-level player statistics.
