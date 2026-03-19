import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Player management helpers for the new unified players table
 */

export async function getOrCreatePlayer(userId: number | null, deviceId: string | null, name: string, email?: string, isPremium: number = 0) {
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
    await db.execute(sql`
      INSERT INTO players (userId, deviceId, name, email, type, isPremium, lastActivityAt) VALUES (${userId || null}, ${deviceId || null}, ${name}, ${email || null}, ${type}, ${isPremium}, NOW())
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

  // Update stats from cycle_history and puzzle_attempts
  await db.execute(sql`
    UPDATE players SET
      totalPuzzles = COALESCE((
        SELECT SUM(totalPuzzles) FROM cycle_history 
        WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      totalCorrect = COALESCE((
        SELECT SUM(correctCount) FROM cycle_history 
        WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      totalTimeMs = COALESCE((
        SELECT SUM(totalTimeMs) FROM cycle_history 
        WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      completedCycles = COALESCE((
        SELECT COUNT(*) FROM cycle_history 
        WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      accuracy = CASE 
        WHEN COALESCE((SELECT SUM(totalPuzzles) FROM cycle_history WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)), 0) = 0 THEN 0
        ELSE ROUND((COALESCE((SELECT SUM(correctCount) FROM cycle_history WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)), 0) / COALESCE((SELECT SUM(totalPuzzles) FROM cycle_history WHERE (userId = ${userId} OR deviceId = ${deviceId}) AND (userId IS NOT NULL OR deviceId IS NOT NULL)), 1)) * 100)
      END,
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
  let orderBy = 'CASE WHEN totalPuzzles = 0 THEN 0 ELSE ROUND((totalCorrect / totalPuzzles) * 100) END DESC, totalPuzzles DESC';
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
