import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Clean leaderboard implementation
 * Fetches top players with their training statistics
 */

export interface LeaderboardEntry {
  rank: number;
  name: string;
  totalPuzzles: number;
  totalCorrect: number;
  accuracy: number;
  rating: number;
  completedCycles: number;
  totalTimeMin: number;
  lastActivityAt: string | null;
}

export async function getLeaderboard(limit: number = 100, sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy'): Promise<LeaderboardEntry[]> {
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
      orderByClause = 'ORDER BY rating DESC, totalPuzzles DESC';
    } else {
      // Default: accuracy (highest first)
      orderByClause = 'ORDER BY accuracy DESC, totalPuzzles DESC';
    }

    // Query: Get players with at least 1 puzzle solved
    const query = `
      SELECT 
        id,
        name,
        COALESCE(totalPuzzles, 0) as totalPuzzles,
        COALESCE(totalCorrect, 0) as totalCorrect,
        COALESCE(accuracy, 0) as accuracy,
        COALESCE(rating, 1200) as rating,
        COALESCE(completedCycles, 0) as completedCycles,
        COALESCE(ROUND(totalTimeMs / 60000), 0) as totalTimeMin,
        lastActivityAt
      FROM players
      WHERE totalPuzzles > 0
      ${orderByClause}
      LIMIT ${limit}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    // Add rank numbers
    return rows.map((row: any, index: number) => ({
      rank: index + 1,
      name: row.name || 'Anonymous',
      totalPuzzles: Number(row.totalPuzzles || 0),
      totalCorrect: Number(row.totalCorrect || 0),
      accuracy: Number(row.accuracy || 0),
      rating: Number(row.rating || 1200),
      completedCycles: Number(row.completedCycles || 0),
      totalTimeMin: Number(row.totalTimeMin || 0),
      lastActivityAt: row.lastActivityAt,
    }));
  } catch (error) {
    console.error('[getLeaderboard] Error:', error);
    throw error;
  }
}

/**
 * Get total count of players with activity
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
export async function getTotalRegisteredPlayerCount(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM players
    `));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    return Number(rows[0]?.cnt || 0);
  } catch (error) {
    console.error('[getTotalRegisteredPlayerCount] Error:', error);
    return 0;
  }
}
