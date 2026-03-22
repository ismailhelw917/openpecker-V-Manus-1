import { sql } from 'drizzle-orm';
import { getDb } from './db';

/**
 * Optimized Leaderboard System for TiDB
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
const CACHE_TTL = 10000; // 10 second cache for frequent updates

/**
 * Get top players with efficient queries
 * TiDB-compatible version
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
    // Query for guest players from cycle_history
    const guestPlayersQuery = sql`
      SELECT 
        CONCAT('guest_', ch.deviceId) as playerId,
        CONCAT('Guest-', SUBSTRING(ch.deviceId, 1, 8)) as playerName,
        SUM(ch.totalPuzzles) as totalPuzzles,
        CASE 
          WHEN SUM(ch.totalPuzzles) = 0 THEN 0
          ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
        END as accuracy,
        1200 as rating,
        COALESCE(ROUND(SUM(ch.totalTimeMs) / 60000), 0) as totalMinutes,
        MIN(ch.completedAt) as joinDate,
        'guest' as playerType
      FROM cycle_history ch
      WHERE ch.deviceId IS NOT NULL AND ch.userId IS NULL
      GROUP BY ch.deviceId
      HAVING SUM(ch.totalPuzzles) > 0
    `;

    const guestResult = await db.execute(guestPlayersQuery);
    const guestRows = Array.isArray(guestResult) ? (Array.isArray(guestResult[0]) ? guestResult[0] : guestResult) : [];

    // Query for registered users - simplified
    let registeredRows: any[] = [];
    try {
      const registeredUsersQuery = sql`
        SELECT 
          u.id as playerId,
          u.name as playerName,
          COALESCE(SUM(ch.totalPuzzles), 0) as totalPuzzles,
          CASE 
            WHEN COALESCE(SUM(ch.totalPuzzles), 0) = 0 THEN 0
            ELSE ROUND(SUM(ch.correctCount) * 100.0 / SUM(ch.totalPuzzles), 2)
          END as accuracy,
          1200 as rating,
          COALESCE(ROUND(SUM(ch.totalTimeMs) / 60000), 0) as totalMinutes,
          u.createdAt as joinDate,
          'registered' as playerType
        FROM users u
        LEFT JOIN cycle_history ch ON u.id = ch.userId
        WHERE u.hasRegistered = 1
        GROUP BY u.id, u.name, u.createdAt
      `;

      const registeredResult = await db.execute(registeredUsersQuery);
      registeredRows = Array.isArray(registeredResult) ? (Array.isArray(registeredResult[0]) ? registeredResult[0] : registeredResult) : [];
    } catch (err) {
      console.warn('[getTopPlayersByMetricOptimized] Registered users query failed, continuing with guest players only:', err);
    }

    // Combine and sort all players
    const allPlayers = [...registeredRows, ...guestRows];
    allPlayers.sort((a: any, b: any) => {
      const puzzlesA = Number(a.totalPuzzles || 0);
      const puzzlesB = Number(b.totalPuzzles || 0);
      if (puzzlesA !== puzzlesB) return puzzlesB - puzzlesA;
      
      const dateA = new Date(a.joinDate).getTime();
      const dateB = new Date(b.joinDate).getTime();
      return dateA - dateB;
    });

    // Take top N and assign ranks
    const leaderboard: LeaderboardEntry[] = allPlayers.slice(0, limit).map((row: any, index: number) => ({
      rank: index + 1,
      playerName: row.playerName || 'Anonymous',
      puzzlesSolved: Number(row.totalPuzzles || 0),
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
    // Get all players sorted by puzzles solved
    const query = sql`
      SELECT 
        u.id as playerId,
        COALESCE(SUM(ch.totalPuzzles), 0) as totalPuzzles,
        u.createdAt as joinDate
      FROM users u
      LEFT JOIN cycle_history ch ON u.id = ch.userId
      GROUP BY u.id, u.createdAt
      HAVING COALESCE(SUM(ch.totalPuzzles), 0) > 0
    `;

    const result = await db.execute(query);
    const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
    
    // Sort and find the user's rank
    rows.sort((a: any, b: any) => {
      const puzzlesA = Number(a.totalPuzzles || 0);
      const puzzlesB = Number(b.totalPuzzles || 0);
      if (puzzlesA !== puzzlesB) return puzzlesB - puzzlesA;
      
      const dateA = new Date(a.joinDate).getTime();
      const dateB = new Date(b.joinDate).getTime();
      return dateA - dateB;
    });

    const userRank = rows.findIndex((row: any) => Number(row.playerId) === userId);
    return userRank >= 0 ? userRank + 1 : null;
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
 * Get cache status for debugging
 */
export function getLeaderboardCacheStatus() {
  return {
    cacheSize: leaderboardCache.size,
    entries: Array.from(leaderboardCache.entries()).map(([key, value]) => ({
      key,
      timestamp: new Date(value.timestamp).toISOString(),
      ttl: value.ttl,
      dataCount: value.data.length,
    })),
  };
}

/**
 * Get leaderboard summary statistics
 */
export async function getLeaderboardSummary() {
  const db = await getDb();
  if (!db) throw new Error('Database connection failed');

  try {
    // Get count of total players
    const countQuery = sql`
      SELECT COUNT(DISTINCT id) as totalPlayers FROM users
    `;

    const countResult = await db.execute(countQuery);
    const countRows = Array.isArray(countResult) ? (Array.isArray(countResult[0]) ? countResult[0] : countResult) : [];
    const totalPlayers = Number(countRows[0]?.totalPlayers || 0);

    // Get active players (those with training data)
    const activeQuery = sql`
      SELECT COUNT(DISTINCT userId) as activePlayers FROM cycle_history WHERE userId IS NOT NULL
    `;

    const activeResult = await db.execute(activeQuery);
    const activeRows = Array.isArray(activeResult) ? (Array.isArray(activeResult[0]) ? activeResult[0] : activeResult) : [];
    const activePlayers = Number(activeRows[0]?.activePlayers || 0);

    // Get total puzzles solved
    const puzzlesQuery = sql`
      SELECT SUM(totalPuzzles) as totalPuzzles FROM cycle_history
    `;

    const puzzlesResult = await db.execute(puzzlesQuery);
    const puzzlesRows = Array.isArray(puzzlesResult) ? (Array.isArray(puzzlesResult[0]) ? puzzlesResult[0] : puzzlesResult) : [];
    const totalPuzzlesSolvedGlobally = Number(puzzlesRows[0]?.totalPuzzles || 0);

    // Count previous subscribers (users with premiumCancelledAt set)
    const previousSubsQuery = sql`
      SELECT COUNT(DISTINCT id) as previousSubscribers FROM users WHERE premiumCancelledAt IS NOT NULL
    `;

    const previousSubsResult = await db.execute(previousSubsQuery);
    const previousSubsRows = Array.isArray(previousSubsResult) ? (Array.isArray(previousSubsResult[0]) ? previousSubsResult[0] : previousSubsResult) : [];
    const previousSubscribersCount = Number(previousSubsRows[0]?.previousSubscribers || 0);

    return {
      activePlayers,
      totalPlayers,
      topAccuracy: 100,
      topRating: 1200,
      averageAccuracy: 75,
      averageRating: 1200,
      totalPuzzlesSolvedGlobally,
      previousSubscribersCount,
    };
  } catch (error) {
    console.error('[getLeaderboardSummary] Error:', error);
    // Return default values on error
    return {
      activePlayers: 0,
      totalPlayers: 0,
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
    // Get current premium subscribers
    const currentSubsQuery = sql`
      SELECT COUNT(DISTINCT id) as currentSubscribers FROM users WHERE isPremium = 1
    `;

    const currentSubsResult = await db.execute(currentSubsQuery);
    const currentSubsRows = Array.isArray(currentSubsResult) ? (Array.isArray(currentSubsResult[0]) ? currentSubsResult[0] : currentSubsResult) : [];
    const currentSubscribers = Number(currentSubsRows[0]?.currentSubscribers || 0);

    // Get previous subscribers (cancelled)
    const previousSubsQuery = sql`
      SELECT COUNT(DISTINCT id) as previousSubscribers FROM users WHERE premiumCancelledAt IS NOT NULL
    `;

    const previousSubsResult = await db.execute(previousSubsQuery);
    const previousSubsRows = Array.isArray(previousSubsResult) ? (Array.isArray(previousSubsResult[0]) ? previousSubsResult[0] : previousSubsResult) : [];
    const previousSubscribers = Number(previousSubsRows[0]?.previousSubscribers || 0);

    // Get expired subscriptions (not renewed)
    const expiredSubsQuery = sql`
      SELECT COUNT(DISTINCT id) as expiredSubscribers FROM users WHERE premiumExpiredAt IS NOT NULL AND premiumExpiredAt < NOW() AND isPremium = 0
    `;

    const expiredSubsResult = await db.execute(expiredSubsQuery);
    const expiredSubsRows = Array.isArray(expiredSubsResult) ? (Array.isArray(expiredSubsResult[0]) ? expiredSubsResult[0] : expiredSubsResult) : [];
    const expiredSubscribers = Number(expiredSubsRows[0]?.expiredSubscribers || 0);

    // Get total who have ever been premium
    const totalEverPremiumQuery = sql`
      SELECT COUNT(DISTINCT id) as totalEverPremium FROM users WHERE isPremium = 1 OR premiumExpiredAt IS NOT NULL OR premiumCancelledAt IS NOT NULL
    `;

    const totalEverPremiumResult = await db.execute(totalEverPremiumQuery);
    const totalEverPremiumRows = Array.isArray(totalEverPremiumResult) ? (Array.isArray(totalEverPremiumResult[0]) ? totalEverPremiumResult[0] : totalEverPremiumResult) : [];
    const totalEverPremium = Number(totalEverPremiumRows[0]?.totalEverPremium || 0);

    // Calculate churn rate
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
