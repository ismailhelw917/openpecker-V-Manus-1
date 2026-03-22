import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * Fresh leaderboard system - includes ALL players
 * - Registered users from users table with their training data
 * - Guest players from players table
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
 * Includes both registered users and guest players
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
      orderClause = 'ORDER BY CASE WHEN totalPuzzles = 0 THEN 999999 ELSE ROUND(totalMinutes * 60 / totalPuzzles) END ASC, totalPuzzles DESC';
    } else if (sortBy === 'rating') {
      orderClause = 'ORDER BY COALESCE(rating, 1200) DESC, totalPuzzles DESC';
    } else {
      orderClause = 'ORDER BY COALESCE(accuracy, 0) DESC, totalPuzzles DESC';
    }

    // Query that combines registered users and guest players
    const query = `
      SELECT 
        playerName,
        totalPuzzles,
        accuracy,
        rating,
        totalMinutes
      FROM (
        -- Registered users with their training data
        SELECT 
          u.name as playerName,
          COALESCE(COUNT(pa.id), 0) as totalPuzzles,
          CASE 
            WHEN COUNT(pa.id) = 0 THEN 0
            ELSE ROUND(SUM(CASE WHEN pa.isCorrect = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id), 2)
          END as accuracy,
          1200 as rating,
          COALESCE(ROUND(SUM(pa.timeMs) / 60000), 0) as totalMinutes
        FROM users u
        LEFT JOIN training_sets ts ON u.id = ts.userId
        LEFT JOIN puzzle_attempts pa ON ts.id = pa.trainingSetId
        WHERE u.id IS NOT NULL
        GROUP BY u.id, u.name
        
        UNION ALL
        
        -- Guest players from players table
        SELECT 
          p.name as playerName,
          COALESCE(p.totalPuzzles, 0) as totalPuzzles,
          COALESCE(p.accuracy, 0) as accuracy,
          COALESCE(p.rating, 1200) as rating,
          COALESCE(ROUND(p.totalTimeMs / 60000), 0) as totalMinutes
        FROM players p
        WHERE p.userId IS NULL AND p.totalPuzzles > 0
      ) combined_players
      WHERE totalPuzzles > 0
      ${orderClause}
      LIMIT ${limit}
    `;

    const result = await db.execute(sql.raw(query));
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    return rows.map((row: any, index: number) => ({
      rank: index + 1,
      playerName: row.playerName || 'Anonymous',
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
 * Includes both registered users and guest players
 */
export async function countActivePlayers(): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    const result = await db.execute(sql.raw(`
      SELECT COUNT(*) as cnt FROM (
        -- Registered users with puzzle attempts
        SELECT DISTINCT u.id
        FROM users u
        JOIN training_sets ts ON u.id = ts.userId
        JOIN puzzle_attempts pa ON ts.id = pa.trainingSetId
        
        UNION
        
        -- Guest players with puzzle attempts
        SELECT DISTINCT p.id
        FROM players p
        WHERE p.userId IS NULL AND p.totalPuzzles > 0
      ) active_players
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
      SELECT COUNT(*) as cnt FROM (
        -- All registered users
        SELECT DISTINCT u.id FROM users u
        
        UNION
        
        -- All guest players
        SELECT DISTINCT p.id FROM players p WHERE p.userId IS NULL
      ) all_players
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
 * Includes both registered users and guest players
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
      FROM (
        -- Registered users stats
        SELECT 
          CASE 
            WHEN COUNT(pa.id) = 0 THEN 0
            ELSE ROUND(SUM(CASE WHEN pa.isCorrect = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(pa.id), 2)
          END as accuracy,
          1200 as rating,
          COALESCE(COUNT(pa.id), 0) as totalPuzzles
        FROM users u
        LEFT JOIN training_sets ts ON u.id = ts.userId
        LEFT JOIN puzzle_attempts pa ON ts.id = pa.trainingSetId
        WHERE u.id IS NOT NULL
        GROUP BY u.id
        HAVING COUNT(pa.id) > 0
        
        UNION ALL
        
        -- Guest players stats
        SELECT 
          COALESCE(p.accuracy, 0) as accuracy,
          COALESCE(p.rating, 1200) as rating,
          COALESCE(p.totalPuzzles, 0) as totalPuzzles
        FROM players p
        WHERE p.userId IS NULL AND p.totalPuzzles > 0
      ) combined_stats
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
