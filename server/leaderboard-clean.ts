import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Clean leaderboard system - rebuilt from scratch
 * Fetches real player data from database without any hardcoded values
 */

export interface LeaderboardPlayer {
  rank: number;
  name: string;
  puzzlesSolved: number;
  accuracy: number;
  rating: number;
  totalTimeMinutes: number;
  lastActive: string | null;
}

/**
 * Get top players ranked by selected metric
 * Only includes players with actual training data (puzzlesSolved > 0)
 */
export async function getTopPlayers(
  limit: number = 50,
  sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy'
): Promise<LeaderboardPlayer[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    // Build ORDER BY clause based on sort preference
    let orderByClause = '';
    if (sortBy === 'speed') {
      // Sort by average time per puzzle (fastest first)
      orderByClause = 'ORDER BY CASE WHEN totalPuzzles = 0 THEN 999999 ELSE ROUND(totalTimeMs / totalPuzzles / 1000) END ASC, totalPuzzles DESC';
    } else if (sortBy === 'rating') {
      // Sort by rating (highest first)
      orderByClause = 'ORDER BY COALESCE(rating, 1200) DESC, totalPuzzles DESC';
    } else {
      // Default: accuracy (highest first)
      orderByClause = 'ORDER BY COALESCE(accuracy, 0) DESC, totalPuzzles DESC';
    }

    // Query: Get players with at least 1 puzzle solved
    const query = `
      SELECT 
        id,
        name,
        COALESCE(totalPuzzles, 0) as totalPuzzles,
        COALESCE(accuracy, 0) as accuracy,
        COALESCE(rating, 1200) as rating,
        COALESCE(ROUND(totalTimeMs / 60000), 0) as totalTimeMinutes,
        lastActivityAt
      FROM players
      WHERE totalPuzzles > 0
      ${orderByClause}
      LIMIT ${limit}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    // Add rank numbers and format response
    return rows.map((row: any, index: number) => ({
      rank: index + 1,
      name: row.name || 'Anonymous Player',
      puzzlesSolved: Number(row.totalPuzzles || 0),
      accuracy: Number(row.accuracy || 0),
      rating: Number(row.rating || 1200),
      totalTimeMinutes: Number(row.totalTimeMinutes || 0),
      lastActive: row.lastActivityAt,
    }));
  } catch (error) {
    console.error('[getTopPlayers] Error:', error);
    throw error;
  }
}

/**
 * Get count of players with training activity
 */
export async function getActivePlayerCount(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM players WHERE totalPuzzles > 0
    `));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    return Number(rows[0]?.cnt || 0);
  } catch (error) {
    console.error('[getActivePlayerCount] Error:', error);
    return 0;
  }
}

/**
 * Get total count of all registered players
 */
export async function getTotalPlayerCount(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM players
    `));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    return Number(rows[0]?.cnt || 0);
  } catch (error) {
    console.error('[getTotalPlayerCount] Error:', error);
    return 0;
  }
}

/**
 * Get leaderboard statistics
 */
export async function getLeaderboardStats() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const activeCount = await getActivePlayerCount();
    const totalCount = await getTotalPlayerCount();
    
    // Get top player stats
    const topPlayersResult = await db.execute(sql.raw(`
      SELECT 
        MAX(accuracy) as maxAccuracy,
        MAX(rating) as maxRating,
        AVG(accuracy) as avgAccuracy,
        AVG(rating) as avgRating
      FROM players
      WHERE totalPuzzles > 0
    `));
    
    const rows = Array.isArray(topPlayersResult) ? (Array.isArray(topPlayersResult[0]) ? topPlayersResult[0] : topPlayersResult) : [];
    const stats = rows[0];

    return {
      activePlayerCount: activeCount,
      totalPlayerCount: totalCount,
      topAccuracy: Number(stats?.maxAccuracy || 0),
      topRating: Number(stats?.maxRating || 1200),
      averageAccuracy: Number(stats?.avgAccuracy || 0),
      averageRating: Number(stats?.avgRating || 1200),
    };
  } catch (error) {
    console.error('[getLeaderboardStats] Error:', error);
    throw error;
  }
}
