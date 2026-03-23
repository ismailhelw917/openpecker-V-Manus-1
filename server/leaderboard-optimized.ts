import { sql } from 'drizzle-orm';
import { getDb } from './db';

/**
 * Leaderboard System v2 — Denormalized Architecture
 * 
 * Uses leaderboard_scores as a pre-computed flat table.
 * Scores are updated when a training session ends (via updateLeaderboardScore).
 * Reads are a single indexed SELECT — no JOINs, no GROUP BY.
 * 
 * Online users tracked via user_heartbeats table with 45s expiry window.
 */

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  puzzlesSolved: number;
  accuracy: number;
  rating: number;
  totalMinutes: number;
}

// Simple in-memory cache (10s TTL) to avoid hitting DB on every poll
let cachedLeaderboard: { data: LeaderboardEntry[]; ts: number } | null = null;
const CACHE_TTL = 10_000;

/**
 * Read top N players from the denormalized leaderboard_scores table.
 * Active players (totalPuzzles > 0) first, then inactive by join date.
 */
export async function getTopPlayersByMetricOptimized(
  limit: number = 100,
  _sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy'
): Promise<LeaderboardEntry[]> {
  // Check cache
  if (cachedLeaderboard && Date.now() - cachedLeaderboard.ts < CACHE_TTL) {
    return cachedLeaderboard.data;
  }

  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const result = await db.execute(sql`
      SELECT playerName, totalPuzzles, accuracy, rating, totalMinutes
      FROM leaderboard_scores
      ORDER BY totalPuzzles DESC, createdAt ASC
      LIMIT ${limit}
    `);

    const rows: any[] = Array.isArray(result)
      ? Array.isArray(result[0]) ? result[0] : result
      : [];

    const leaderboard: LeaderboardEntry[] = rows.map((row: any, i: number) => ({
      rank: i + 1,
      playerName: row.playerName || 'Anonymous',
      puzzlesSolved: Number(row.totalPuzzles || 0),
      accuracy: Number(row.accuracy || 0),
      rating: Number(row.rating || 1200),
      totalMinutes: Number(row.totalMinutes || 0),
    }));

    cachedLeaderboard = { data: leaderboard, ts: Date.now() };
    return leaderboard;
  } catch (error) {
    console.error('[getTopPlayers] Error:', error);
    throw error;
  }
}

/**
 * Update (or insert) a player's leaderboard score.
 * Called when a training session/cycle ends.
 */
export async function updateLeaderboardScore(params: {
  userId?: number | null;
  deviceId?: string | null;
  playerName: string;
  puzzlesSolved: number;
  correctPuzzles: number;
  totalTimeMs?: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { userId, deviceId, playerName, puzzlesSolved, correctPuzzles, totalTimeMs } = params;

  try {
    if (userId) {
      // Registered user — upsert by userId
      await db.execute(sql`
        INSERT INTO leaderboard_scores (userId, playerName, totalPuzzles, correctPuzzles, accuracy, totalMinutes, lastUpdated, createdAt)
        VALUES (
          ${userId},
          ${playerName},
          ${puzzlesSolved},
          ${correctPuzzles},
          ${puzzlesSolved > 0 ? Math.round(correctPuzzles * 10000 / puzzlesSolved) / 100 : 0},
          ${totalTimeMs ? Math.round(totalTimeMs / 600) / 100 : 0},
          ${Date.now()},
          ${Date.now()}
        )
        ON DUPLICATE KEY UPDATE
          playerName = VALUES(playerName),
          totalPuzzles = ${puzzlesSolved},
          correctPuzzles = ${correctPuzzles},
          accuracy = ${puzzlesSolved > 0 ? Math.round(correctPuzzles * 10000 / puzzlesSolved) / 100 : 0},
          totalMinutes = totalMinutes + ${totalTimeMs ? Math.round(totalTimeMs / 600) / 100 : 0},
          lastUpdated = ${Date.now()}
      `);
    } else if (deviceId) {
      // Guest user — upsert by deviceId
      await db.execute(sql`
        INSERT INTO leaderboard_scores (deviceId, playerName, totalPuzzles, correctPuzzles, accuracy, totalMinutes, lastUpdated, createdAt)
        VALUES (
          ${deviceId},
          ${playerName},
          ${puzzlesSolved},
          ${correctPuzzles},
          ${puzzlesSolved > 0 ? Math.round(correctPuzzles * 10000 / puzzlesSolved) / 100 : 0},
          ${totalTimeMs ? Math.round(totalTimeMs / 600) / 100 : 0},
          ${Date.now()},
          ${Date.now()}
        )
        ON DUPLICATE KEY UPDATE
          playerName = VALUES(playerName),
          totalPuzzles = ${puzzlesSolved},
          correctPuzzles = ${correctPuzzles},
          accuracy = ${puzzlesSolved > 0 ? Math.round(correctPuzzles * 10000 / puzzlesSolved) / 100 : 0},
          totalMinutes = totalMinutes + ${totalTimeMs ? Math.round(totalTimeMs / 600) / 100 : 0},
          lastUpdated = ${Date.now()}
      `);
    }

    // Invalidate cache so next read picks up the change
    invalidateLeaderboardCache();
  } catch (error) {
    console.error('[updateLeaderboardScore] Error:', error);
  }
}

/**
 * Record a heartbeat for an online user (called every 30s from frontend).
 */
export async function recordHeartbeat(params: {
  userId?: number | null;
  deviceId?: string | null;
  playerName?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const { userId, deviceId, playerName } = params;
  const now = Date.now();

  try {
    if (userId) {
      await db.execute(sql`
        INSERT INTO user_heartbeats (userId, playerName, lastPing)
        VALUES (${userId}, ${playerName || 'Anonymous'}, ${now})
        ON DUPLICATE KEY UPDATE lastPing = ${now}, playerName = ${playerName || 'Anonymous'}
      `);
    } else if (deviceId) {
      await db.execute(sql`
        INSERT INTO user_heartbeats (deviceId, playerName, lastPing)
        VALUES (${deviceId}, ${`Guest-${deviceId.substring(0, 8)}`}, ${now})
        ON DUPLICATE KEY UPDATE lastPing = ${now}
      `);
    }
  } catch (error) {
    console.error('[recordHeartbeat] Error:', error);
  }
}

/**
 * Get count of users online in the last 45 seconds.
 */
export async function getOnlineCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoff = Date.now() - 45_000; // 45 seconds ago
    const result = await db.execute(sql`
      SELECT COUNT(*) AS onlineCount FROM user_heartbeats WHERE lastPing > ${cutoff}
    `);
    const rows: any[] = Array.isArray(result)
      ? Array.isArray(result[0]) ? result[0] : result
      : [];
    return Number(rows[0]?.onlineCount || 0);
  } catch (error) {
    console.error('[getOnlineCount] Error:', error);
    return 0;
  }
}

/**
 * Invalidate the in-memory cache.
 */
export function invalidateLeaderboardCache(): void {
  cachedLeaderboard = null;
}

/**
 * Get player rank by userId.
 */
export async function getPlayerRank(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    // Get this user's puzzle count
    const userResult = await db.execute(sql`
      SELECT totalPuzzles, createdAt FROM leaderboard_scores WHERE userId = ${userId}
    `);
    const userRows: any[] = Array.isArray(userResult)
      ? Array.isArray(userResult[0]) ? userResult[0] : userResult
      : [];
    if (userRows.length === 0) return null;

    const userPuzzles = Number(userRows[0].totalPuzzles || 0);
    const userCreated = Number(userRows[0].createdAt || 0);

    // Count how many players are ahead
    const rankResult = await db.execute(sql`
      SELECT COUNT(*) AS ahead FROM leaderboard_scores
      WHERE totalPuzzles > ${userPuzzles}
        OR (totalPuzzles = ${userPuzzles} AND createdAt < ${userCreated})
    `);
    const rankRows: any[] = Array.isArray(rankResult)
      ? Array.isArray(rankResult[0]) ? rankResult[0] : rankResult
      : [];

    return Number(rankRows[0]?.ahead || 0) + 1;
  } catch (error) {
    console.error('[getPlayerRank] Error:', error);
    return null;
  }
}

/**
 * Get leaderboard summary statistics.
 */
export async function getLeaderboardSummary() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) AS totalPlayers,
        SUM(CASE WHEN totalPuzzles > 0 THEN 1 ELSE 0 END) AS activePlayers,
        SUM(totalPuzzles) AS totalPuzzlesSolvedGlobally
      FROM leaderboard_scores
    `);
    const rows: any[] = Array.isArray(result)
      ? Array.isArray(result[0]) ? result[0] : result
      : [];

    const onlineCount = await getOnlineCount();

    return {
      activePlayers: Number(rows[0]?.activePlayers || 0),
      totalPlayers: Number(rows[0]?.totalPlayers || 0),
      onlineNow: onlineCount,
      topAccuracy: 100,
      topRating: 1200,
      averageAccuracy: 75,
      averageRating: 1200,
      totalPuzzlesSolvedGlobally: Number(rows[0]?.totalPuzzlesSolvedGlobally || 0),
      previousSubscribersCount: 0,
    };
  } catch (error) {
    console.error('[getLeaderboardSummary] Error:', error);
    return {
      activePlayers: 0,
      totalPlayers: 0,
      onlineNow: 0,
      topAccuracy: 0,
      topRating: 1200,
      averageAccuracy: 0,
      averageRating: 1200,
      totalPuzzlesSolvedGlobally: 0,
      previousSubscribersCount: 0,
    };
  }
}

/**
 * Get subscription history for tracking churn and retention
 */
export async function getSubscriptionHistory() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const currentSubsResult = await db.execute(
      sql`SELECT COUNT(DISTINCT id) AS currentSubscribers FROM users WHERE isPremium = 1`
    );
    const currentRows: any[] = Array.isArray(currentSubsResult)
      ? Array.isArray(currentSubsResult[0]) ? currentSubsResult[0] : currentSubsResult
      : [];
    const currentSubscribers = Number(currentRows[0]?.currentSubscribers || 0);

    const previousSubsResult = await db.execute(
      sql`SELECT COUNT(DISTINCT id) AS previousSubscribers FROM users WHERE premiumCancelledAt IS NOT NULL`
    );
    const previousRows: any[] = Array.isArray(previousSubsResult)
      ? Array.isArray(previousSubsResult[0]) ? previousSubsResult[0] : previousSubsResult
      : [];
    const previousSubscribers = Number(previousRows[0]?.previousSubscribers || 0);

    const expiredSubsResult = await db.execute(
      sql`SELECT COUNT(DISTINCT id) AS expiredSubscribers FROM users WHERE premiumExpiredAt IS NOT NULL AND premiumExpiredAt < NOW() AND isPremium = 0`
    );
    const expiredRows: any[] = Array.isArray(expiredSubsResult)
      ? Array.isArray(expiredSubsResult[0]) ? expiredSubsResult[0] : expiredSubsResult
      : [];
    const expiredSubscribers = Number(expiredRows[0]?.expiredSubscribers || 0);

    const totalEverPremiumResult = await db.execute(
      sql`SELECT COUNT(DISTINCT id) AS totalEverPremium FROM users WHERE isPremium = 1 OR premiumExpiredAt IS NOT NULL OR premiumCancelledAt IS NOT NULL`
    );
    const totalEverRows: any[] = Array.isArray(totalEverPremiumResult)
      ? Array.isArray(totalEverPremiumResult[0]) ? totalEverPremiumResult[0] : totalEverPremiumResult
      : [];
    const totalEverPremium = Number(totalEverRows[0]?.totalEverPremium || 0);

    const totalChurned = previousSubscribers + expiredSubscribers;
    const churnRate = totalEverPremium > 0 ? Math.round((totalChurned / totalEverPremium) * 100) : 0;

    return {
      currentSubscribers,
      previousSubscribers,
      expiredSubscribers,
      totalEverPremium,
      totalChurned,
      churnRate,
      retentionRate: 100 - churnRate,
    };
  } catch (error) {
    console.error('[getSubscriptionHistory] Error:', error);
    return {
      currentSubscribers: 0,
      previousSubscribers: 0,
      expiredSubscribers: 0,
      totalEverPremium: 0,
      totalChurned: 0,
      churnRate: 0,
      retentionRate: 100,
    };
  }
}
