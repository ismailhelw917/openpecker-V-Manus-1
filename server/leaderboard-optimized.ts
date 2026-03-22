import { sql } from 'drizzle-orm';
import { getDb } from './db';

/**
 * Optimized Leaderboard System with Redis-like performance
 * Uses efficient SQL queries with caching for fast ranking
 */

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  puzzlesSolved: number;
  accuracy: number;
  rating: number;
  totalMinutes: number;
}

interface LeaderboardCache {
  data: LeaderboardEntry[];
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

// In-memory cache for leaderboard
const leaderboardCache: Map<string, LeaderboardCache> = new Map();
const CACHE_TTL = 60000; // 1 minute cache

/**
 * Get top players with efficient single query
 * Uses window functions for ranking (MySQL 8.0+)
 */
export async function getTopPlayersByMetricOptimized(
  limit: number = 100,
  sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy'
): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  const cacheKey = `leaderboard_${sortBy}_${limit}`;
  
  // Check cache
  const cached = leaderboardCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < cached.ttl) {
    return cached.data;
  }

  try {
    // Single optimized query using window functions
    const query = `
      SELECT 
        ROW_NUMBER() OVER (ORDER BY totalPuzzles DESC, joinDate ASC) as rank,
        playerName,
        totalPuzzles as puzzlesSolved,
        accuracy,
        rating,
        totalMinutes
      FROM (
        -- Registered users with training data
        SELECT 
          u.name as playerName,
          COALESCE(SUM(ch.totalPuzzles), 0) as totalPuzzles,
          CASE 
            WHEN COALESCE(SUM(ch.totalPuzzles), 0) = 0 THEN 0
            ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
          END as accuracy,
          1200 as rating,
          COALESCE(ROUND(SUM(ch.totalTimeMs) / 60000), 0) as totalMinutes,
          u.createdAt as joinDate
        FROM users u
        LEFT JOIN cycle_history ch ON u.id = ch.userId
        WHERE u.id IS NOT NULL
        GROUP BY u.id, u.name, u.createdAt
        HAVING COALESCE(SUM(ch.totalPuzzles), 0) > 0
        
        UNION ALL
        
        -- Guest players from cycle_history
        SELECT 
          CONCAT('Guest-', SUBSTRING(ch.deviceId, 1, 8)) as playerName,
          SUM(ch.totalPuzzles) as totalPuzzles,
          CASE 
            WHEN SUM(ch.totalPuzzles) = 0 THEN 0
            ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
          END as accuracy,
          1200 as rating,
          COALESCE(ROUND(SUM(ch.totalTimeMs) / 60000), 0) as totalMinutes,
          MIN(ch.createdAt) as joinDate
        FROM cycle_history ch
        WHERE ch.deviceId IS NOT NULL AND ch.userId IS NULL
        GROUP BY ch.deviceId
        HAVING SUM(ch.totalPuzzles) > 0
      ) ranked_players
      ORDER BY totalPuzzles DESC, joinDate ASC
      LIMIT ${limit}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    const leaderboard: LeaderboardEntry[] = rows.map((row: any, index: number) => ({
      rank: index + 1,
      playerName: row.playerName || 'Anonymous',
      puzzlesSolved: Number(row.puzzlesSolved || 0),
      accuracy: Number(row.accuracy || 0),
      rating: Number(row.rating || 1200),
      totalMinutes: Number(row.totalMinutes || 0),
    }));

    // Cache the result
    leaderboardCache.set(cacheKey, {
      data: leaderboard,
      timestamp: Date.now(),
      ttl: CACHE_TTL,
    });

    return leaderboard;
  } catch (error) {
    console.error('[getTopPlayersByMetricOptimized] Error:', error);
    throw error;
  }
}

/**
 * Get player rank by userId
 */
export async function getPlayerRank(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const query = `
      SELECT rank FROM (
        SELECT 
          u.id,
          ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(ch.totalPuzzles), 0) DESC, u.createdAt ASC) as rank
        FROM users u
        LEFT JOIN cycle_history ch ON u.id = ch.userId
        WHERE u.id IS NOT NULL
        GROUP BY u.id, u.createdAt
        HAVING COALESCE(SUM(ch.totalPuzzles), 0) > 0
      ) ranked
      WHERE id = ${userId}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    
    return rows.length > 0 ? Number(rows[0].rank) : null;
  } catch (error) {
    console.error('[getPlayerRank] Error:', error);
    return null;
  }
}

/**
 * Invalidate cache (call after user updates stats)
 */
export function invalidateLeaderboardCache(): void {
  leaderboardCache.clear();
}

/**
 * Get leaderboard summary statistics
 */
export async function getLeaderboardSummary() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const query = `
      SELECT 
        COUNT(DISTINCT CASE WHEN totalPuzzles > 0 THEN playerId END) as activePlayers,
        COUNT(DISTINCT playerId) as totalPlayers,
        MAX(accuracy) as topAccuracy,
        MAX(rating) as topRating,
        ROUND(AVG(accuracy), 2) as averageAccuracy,
        ROUND(AVG(rating), 2) as averageRating,
        SUM(totalPuzzles) as totalPuzzlesSolvedGlobally
      FROM (
        -- Registered users
        SELECT 
          u.id as playerId,
          COALESCE(SUM(ch.totalPuzzles), 0) as totalPuzzles,
          CASE 
            WHEN COALESCE(SUM(ch.totalPuzzles), 0) = 0 THEN 0
            ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
          END as accuracy,
          1200 as rating
        FROM users u
        LEFT JOIN cycle_history ch ON u.id = ch.userId
        WHERE u.id IS NOT NULL
        GROUP BY u.id
        
        UNION ALL
        
        -- Guest players
        SELECT 
          CONCAT('guest_', ch.deviceId) as playerId,
          SUM(ch.totalPuzzles) as totalPuzzles,
          CASE 
            WHEN SUM(ch.totalPuzzles) = 0 THEN 0
            ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
          END as accuracy,
          1200 as rating
        FROM cycle_history ch
        WHERE ch.deviceId IS NOT NULL AND ch.userId IS NULL
        GROUP BY ch.deviceId
      ) all_players
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    return {
      activePlayers: Number(rows[0]?.activePlayers || 0),
      totalPlayers: Number(rows[0]?.totalPlayers || 0),
      topAccuracy: Number(rows[0]?.topAccuracy || 0),
      topRating: Number(rows[0]?.topRating || 1200),
      averageAccuracy: Number(rows[0]?.averageAccuracy || 0),
      averageRating: Number(rows[0]?.averageRating || 1200),
      totalPuzzlesSolvedGlobally: Number(rows[0]?.totalPuzzlesSolvedGlobally || 0),
    };
  } catch (error) {
    console.error('[getLeaderboardSummary] Error:', error);
    throw error;
  }
}
