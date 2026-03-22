import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Fresh leaderboard system - completely rebuilt from scratch
 * No hardcoded data, no test players
 * Fetches only real player data from database
 */

export interface LeaderboardEntry {
  rank: number;
  playerName: string;
  puzzlesSolved: number;
  accuracy: number;
  rating: number;
  totalMinutes: number;
}

/**
 * Get top players by selected metric
 * Only includes players with actual puzzle attempts (puzzlesSolved > 0)
 */
export async function getTopPlayersByMetric(
  limit: number = 50,
  sortBy: 'accuracy' | 'speed' | 'rating' = 'accuracy'
): Promise<LeaderboardEntry[]> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    // Build ORDER BY clause based on sort preference
    let orderClause = '';
    if (sortBy === 'speed') {
      orderClause = 'ORDER BY CASE WHEN totalPuzzles = 0 THEN 999999 ELSE ROUND(totalTimeMs / totalPuzzles / 1000) END ASC, totalPuzzles DESC';
    } else if (sortBy === 'rating') {
      orderClause = 'ORDER BY COALESCE(rating, 1200) DESC, totalPuzzles DESC';
    } else {
      orderClause = 'ORDER BY COALESCE(accuracy, 0) DESC, totalPuzzles DESC';
    }

    const query = `
      SELECT 
        name,
        COALESCE(totalPuzzles, 0) as totalPuzzles,
        COALESCE(accuracy, 0) as accuracy,
        COALESCE(rating, 1200) as rating,
        COALESCE(ROUND(totalTimeMs / 60000), 0) as totalMinutes
      FROM players
      WHERE totalPuzzles > 0
      ${orderClause}
      LIMIT ${limit}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    return rows.map((row: any, index: number) => ({
      rank: index + 1,
      playerName: row.name || 'Anonymous',
      puzzlesSolved: Number(row.totalPuzzles || 0),
      accuracy: Number(row.accuracy || 0),
      rating: Number(row.rating || 1200),
      totalMinutes: Number(row.totalMinutes || 0),
    }));
  } catch (error) {
    console.error('[getTopPlayersByMetric] Error:', error);
    throw error;
  }
}

/**
 * Get count of active players (those with puzzle attempts)
 */
export async function countActivePlayers(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM players WHERE totalPuzzles > 0
    `));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    return Number(rows[0]?.cnt || 0);
  } catch (error) {
    console.error('[countActivePlayers] Error:', error);
    return 0;
  }
}

/**
 * Get count of all registered players
 */
export async function countAllPlayers(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM players
    `));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    return Number(rows[0]?.cnt || 0);
  } catch (error) {
    console.error('[countAllPlayers] Error:', error);
    return 0;
  }
}

/**
 * Get leaderboard summary statistics
 */
export async function getLeaderboardSummary() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const activeCount = await countActivePlayers();
    const totalCount = await countAllPlayers();

    const statsQuery = `
      SELECT 
        MAX(accuracy) as maxAccuracy,
        MAX(rating) as maxRating,
        AVG(accuracy) as avgAccuracy,
        AVG(rating) as avgRating,
        SUM(totalPuzzles) as totalPuzzlesSolved
      FROM players
      WHERE totalPuzzles > 0
    `;

    const result = await db.execute(sql.raw(statsQuery));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    const stats = rows[0];

    return {
      activePlayers: activeCount,
      totalPlayers: totalCount,
      topAccuracy: Number(stats?.maxAccuracy || 0),
      topRating: Number(stats?.maxRating || 1200),
      averageAccuracy: Number(stats?.avgAccuracy || 0),
      averageRating: Number(stats?.avgRating || 1200),
      totalPuzzlesSolvedGlobally: Number(stats?.totalPuzzlesSolved || 0),
    };
  } catch (error) {
    console.error('[getLeaderboardSummary] Error:', error);
    throw error;
  }
}
