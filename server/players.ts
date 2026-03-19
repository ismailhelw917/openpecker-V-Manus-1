import { getDb } from './db';

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
    const result = await db.execute(`SELECT * FROM players WHERE userId = ? LIMIT 1`, [userId]);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    player = rows[0];
  } else if (deviceId) {
    const result = await db.execute(`SELECT * FROM players WHERE deviceId = ? AND type = 'anonymous' LIMIT 1`, [deviceId]);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    player = rows[0];
  }

  // Create player if doesn't exist
  if (!player) {
    await db.execute(
      `INSERT INTO players (userId, deviceId, name, email, type, isPremium, lastActivityAt) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId || null, deviceId || null, name, email || null, type, isPremium]
    );

    // Fetch the newly created player
    if (userId) {
      const result = await db.execute(`SELECT * FROM players WHERE userId = ? LIMIT 1`, [userId]);
      const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
      player = rows[0];
    } else if (deviceId) {
      const result = await db.execute(`SELECT * FROM players WHERE deviceId = ? AND type = 'anonymous' LIMIT 1`, [deviceId]);
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
  const playerResult = await db.execute(`SELECT userId, deviceId FROM players WHERE id = ? LIMIT 1`, [playerId]);
  const playerRows = Array.isArray(playerResult) ? (Array.isArray(playerResult[0]) ? playerResult[0] : playerResult) : [];
  const player = playerRows[0];

  if (!player) return;

  const userId = player.userId;
  const deviceId = player.deviceId;

  // Update stats from cycle_history and puzzle_attempts
  await db.execute(
    `UPDATE players SET
      totalPuzzles = COALESCE((
        SELECT SUM(totalPuzzles) FROM cycle_history 
        WHERE (userId = ? OR deviceId = ?) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      totalCorrect = COALESCE((
        SELECT SUM(correctCount) FROM cycle_history 
        WHERE (userId = ? OR deviceId = ?) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      totalTimeMs = COALESCE((
        SELECT SUM(totalTimeMs) FROM cycle_history 
        WHERE (userId = ? OR deviceId = ?) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      completedCycles = COALESCE((
        SELECT COUNT(*) FROM cycle_history 
        WHERE (userId = ? OR deviceId = ?) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), 0),
      accuracy = ROUND(
        COALESCE(SUM(correctCount), 0) / NULLIF(COALESCE(SUM(totalPuzzles), 0), 0) * 100, 2
      ),
      lastActivityAt = COALESCE((
        SELECT MAX(completedAt) FROM cycle_history 
        WHERE (userId = ? OR deviceId = ?) AND (userId IS NOT NULL OR deviceId IS NOT NULL)
      ), NOW())
    WHERE id = ?`,
    [userId, deviceId, userId, deviceId, userId, deviceId, userId, deviceId, userId, deviceId, playerId]
  );
}

export async function createOnlineSession(playerId: number, userId: number | null, deviceId: string | null, sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const sessionUuid = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  await db.execute(
    `INSERT INTO online_sessions (id, playerId, userId, deviceId, sessionId, status, lastHeartbeat, startedAt)
     VALUES (?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
    [sessionUuid, playerId, userId || null, deviceId || null, sessionId]
  );

  return sessionUuid;
}

export async function updateOnlineSessionHeartbeat(sessionId: string, status: 'active' | 'paused' | 'idle' = 'active') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.execute(
    `UPDATE online_sessions SET lastHeartbeat = NOW(), status = ? WHERE id = ?`,
    [status, sessionId]
  );
}

export async function endOnlineSession(sessionId: string) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.execute(`DELETE FROM online_sessions WHERE id = ?`, [sessionId]);
}

export async function getOnlineCount() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Count unique players with active sessions right now
  const result = await db.execute(
    `SELECT COUNT(DISTINCT playerId) as cnt FROM online_sessions WHERE status IN ('active', 'paused')`
  );
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getTotalPlayerCount() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Count only players with puzzle activity (not just created)
  const result = await db.execute(
    `SELECT COUNT(*) as cnt FROM players WHERE totalPuzzles > 0`
  );
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getOnlineCountByPageActivity(minutesWindow: number = 5) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  // Count unique players with page activity in the last N minutes
  const result = await db.execute(
    `SELECT COUNT(DISTINCT playerId) as cnt FROM online_sessions 
     WHERE lastHeartbeat >= DATE_SUB(NOW(), INTERVAL ${minutesWindow} MINUTE)
     AND status IN ('active', 'paused')`
  );
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return Number(rows[0]?.cnt || 0);
}

export async function getLeaderboardPlayers(limit: number = 500, sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  let orderBy = 'accuracy DESC, totalPuzzles DESC';
  if (sortBy === 'speed') {
    orderBy = 'CASE WHEN totalPuzzles = 0 THEN 999999 ELSE ROUND(totalTimeMs / totalPuzzles / 1000) END ASC, totalPuzzles DESC';
  } else if (sortBy === 'rating') {
    orderBy = 'rating DESC, totalPuzzles DESC';
  }

  const result = await db.execute(
    `SELECT 
      id, userId, deviceId, name, email, type, isPremium,
      totalPuzzles, totalCorrect, totalTimeMs, completedCycles, accuracy, rating,
      lastActivityAt, createdAt
    FROM players
    WHERE totalPuzzles > 0
    ORDER BY ${orderBy}
    LIMIT ${limit}`
  );

  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return rows;
}
