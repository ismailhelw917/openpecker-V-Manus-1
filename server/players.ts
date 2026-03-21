import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Player management helpers for the new unified players table
 */

export async function getOrCreatePlayer(userId: number | null, deviceId: string | null, name: string | null, email?: string | null, isPremium: number = 0) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Determine player type
  const type = userId ? 'registered' : 'anonymous';

  // Check if player already exists
  let player;
  if (userId) {
    const result = await db.execute(sql`SELECT * FROM players WHERE userId = ${userId} LIMIT 1`);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    player = rows[0];
  } else if (deviceId) {
    const result = await db.execute(sql`SELECT * FROM players WHERE deviceId = ${deviceId} AND type = 'anonymous' LIMIT 1`);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    player = rows[0];
  }

  // Create player if doesn't exist
  if (!player) {
    const playerName = name || (userId ? `Player-${userId}` : `Guest-${deviceId?.slice(0, 8) || 'unknown'}`);
    await db.execute(sql`
      INSERT INTO players (userId, deviceId, name, email, type, isPremium, lastActivityAt) VALUES (${userId || null}, ${deviceId || null}, ${playerName}, ${email || null}, ${type}, ${isPremium}, NOW())
    `);

    // Fetch the newly created player
    if (userId) {
      const result = await db.execute(sql`SELECT * FROM players WHERE userId = ${userId} LIMIT 1`);
      const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
      player = rows[0];
    } else if (deviceId) {
      const result = await db.execute(sql`SELECT * FROM players WHERE deviceId = ${deviceId} AND type = 'anonymous' LIMIT 1`);
      const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
      player = rows[0];
    }
  }

  return player;
}

export async function updatePlayerStats(playerId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Get player info
  const playerResult = await db.execute(sql`SELECT userId, deviceId FROM players WHERE id = ${playerId} LIMIT 1`);
  const playerRows = Array.isArray(playerResult) ? (Array.isArray(playerResult[0]) ? playerResult[0] : playerResult) : [];
  const player = playerRows[0];

  if (!player) return;

  const userId = player.userId;
  const deviceId = player.deviceId;

  // First try to get stats from puzzle_attempts (most accurate, individual puzzle level)
  // This captures all activity including partial cycles
  const attemptResult = await db.execute(sql`
    SELECT 
      COUNT(*) as totalPuzzles,
      SUM(isCorrect) as totalCorrect,
      SUM(timeMs) as totalTimeMs
    FROM puzzle_attempts pa
    JOIN training_sets ts ON pa.trainingSetId = ts.id
    WHERE (ts.userId = ${userId} OR ts.deviceId = ${deviceId})
      AND (ts.userId IS NOT NULL OR ts.deviceId IS NOT NULL)
  `);
  const ar = Array.isArray(attemptResult) ? (Array.isArray(attemptResult[0]) ? attemptResult[0] : attemptResult) : [];
  const attemptPuzzles = Number(ar[0]?.totalPuzzles || 0);
  const attemptCorrect = Number(ar[0]?.totalCorrect || 0);
  const attemptTimeMs = Number(ar[0]?.totalTimeMs || 0);

  // Get cycle count from cycle_history
  const cycleResult = await db.execute(sql`
    SELECT COUNT(*) as cnt FROM cycle_history 
    WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
  `);
  const cr = Array.isArray(cycleResult) ? (Array.isArray(cycleResult[0]) ? cycleResult[0] : cycleResult) : [];
  const completedCycles = Number(cr[0]?.cnt || 0);

  // Also get cycle-level totals as fallback
  const cycleTotals = await db.execute(sql`
    SELECT 
      COALESCE(SUM(totalPuzzles), 0) as totalPuzzles,
      COALESCE(SUM(correctCount), 0) as totalCorrect,
      COALESCE(SUM(totalTimeMs), 0) as totalTimeMs
    FROM cycle_history 
    WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
  `);
  const ct = Array.isArray(cycleTotals) ? (Array.isArray(cycleTotals[0]) ? cycleTotals[0] : cycleTotals) : [];
  const cyclePuzzles = Number(ct[0]?.totalPuzzles || 0);
  const cycleCorrect = Number(ct[0]?.totalCorrect || 0);
  const cycleTimeMs = Number(ct[0]?.totalTimeMs || 0);

  // Use the higher values (puzzle_attempts captures partial cycles, cycle_history captures completed ones)
  const totalPuzzles = Math.max(attemptPuzzles, cyclePuzzles);
  const totalCorrect = Math.max(attemptCorrect, cycleCorrect);
  const totalTimeMs = Math.max(attemptTimeMs, cycleTimeMs);
  const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;

  // Calculate ELO rating based on performance
  // Base rating 1200, gain/lose based on accuracy and volume
  // Each puzzle solved adjusts rating: correct = +K, incorrect = -K
  // K factor decreases as more puzzles are solved (more stable rating)
  const kFactor = Math.max(4, 32 - Math.floor(totalPuzzles / 50)); // K decreases from 32 to 4
  const expectedScore = 0.5; // Assume puzzles are matched to player level
  const actualScore = totalPuzzles > 0 ? totalCorrect / totalPuzzles : 0.5;
  // Rating change based on recent performance vs expected
  const ratingChange = Math.round(kFactor * (actualScore - expectedScore) * Math.min(totalPuzzles, 100));
  const newRating = Math.max(100, Math.min(3000, 1200 + ratingChange));

  // Get current peak rating
  const peakResult = await db.execute(sql`SELECT rating FROM players WHERE id = ${playerId} LIMIT 1`);
  const pr = Array.isArray(peakResult) ? (Array.isArray(peakResult[0]) ? peakResult[0] : peakResult) : [];
  const currentStoredRating = Number(pr[0]?.rating || 1200);
  // Only update peak if new rating is higher
  const peakRating = Math.max(currentStoredRating, newRating);

  await db.execute(sql`
    UPDATE players SET
      totalPuzzles = ${totalPuzzles},
      totalCorrect = ${totalCorrect},
      totalTimeMs = ${totalTimeMs},
      completedCycles = ${completedCycles},
      accuracy = ${accuracy},
      rating = ${newRating},
      lastActivityAt = NOW()
    WHERE id = ${playerId}
  `);
}

export async function getOnlineCount() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Count unique players with page activity
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT playerId) as cnt FROM online_sessions 
    WHERE lastHeartbeat >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    AND status IN ('active', 'paused')
  `);
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getTotalPlayerCount() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const result = await db.execute(sql`SELECT COUNT(*) as cnt FROM players`);
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getOnlineCountByPageActivity(minutesWindow: number = 5) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Count unique players with page activity in the last N minutes
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT playerId) as cnt FROM online_sessions 
     WHERE lastHeartbeat >= DATE_SUB(NOW(), INTERVAL ${minutesWindow} MINUTE)
     AND status IN ('active', 'paused')
  `);
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getLeaderboardPlayers(limit: number = 500, sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Build ORDER BY clause based on sort preference
  // Default: weighted average (40% accuracy, 30% speed, 20% rating, 10% puzzles)
  let orderBy = 'CASE WHEN totalPuzzles = 0 THEN 0 ELSE ((0.4 * ROUND((totalCorrect / totalPuzzles) * 100)) + (0.3 * (100 - LEAST(100, ROUND((totalTimeMs / totalPuzzles / 1000) * 5)))) + (0.2 * LEAST(100, (COALESCE(rating, 1200) - 1200) / 10)) + (0.1 * LEAST(100, totalPuzzles / 100))) END DESC, totalPuzzles DESC';
  if (sortBy === 'speed') {
    orderBy = 'CASE WHEN totalPuzzles = 0 THEN 999999 ELSE ROUND(totalTimeMs / totalPuzzles / 1000) END ASC, totalPuzzles DESC';
  } else if (sortBy === 'rating') {
    orderBy = 'CASE WHEN rating IS NULL THEN 1200 ELSE rating END DESC, totalPuzzles DESC';
  }

  // Get all players ranked by performance (show all players, not just those with activity)
  const result = await db.execute(sql`
    SELECT 
      id, userId, deviceId, name, email, type, isPremium,
      COALESCE(totalPuzzles, 0) as totalPuzzles, 
      COALESCE(totalCorrect, 0) as totalCorrect, 
      COALESCE(totalTimeMs, 0) as totalTimeMs, 
      COALESCE(completedCycles, 0) as completedCycles, 
      COALESCE(accuracy, 0) as accuracy, 
      COALESCE(rating, 1200) as rating,
      lastActivityAt, createdAt
    FROM players
    ORDER BY ${sql.raw(orderBy)}
    LIMIT ${limit}
  `);

  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return rows;
}
