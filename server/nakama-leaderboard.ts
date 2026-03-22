/**
 * Nakama-compatible leaderboard system
 * Provides production-ready leaderboard functionality
 * Compatible with Nakama API specification
 */

import { getDb } from "./db";
import { users, cycleHistory } from "../drizzle/schema";
import { sql, desc, count, avg } from "drizzle-orm";

export interface LeaderboardRecord {
  leaderboard_id: string;
  owner_id: string;
  username: string;
  score: number;
  subscore: number;
  num_score: number;
  metadata: string;
  create_time: number;
  update_time: number;
  rank: number;
  max_num_score: number;
  next_rank: number;
  prev_rank: number;
}

// Leaderboard cache for performance
const leaderboardCache = new Map<string, { data: LeaderboardRecord[]; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

/**
 * Get leaderboard records
 * Nakama-compatible endpoint
 */
export async function getLeaderboardRecords(
  leaderboardId: string,
  limit: number = 100,
  cursor?: string
): Promise<{ records: LeaderboardRecord[]; next_cursor?: string }> {
  try {
    // Check cache
    const cached = leaderboardCache.get(leaderboardId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const records = cached.data.slice(0, limit);
      return {
        records,
        next_cursor: limit < cached.data.length ? limit.toString() : undefined,
      };
    }

    const db = await getDb();
    if (!db) return { records: [] };

    // Query database with proper ranking using raw SQL
    const query = sql`
      SELECT 
        u.id as owner_id,
        u.player_name as username,
        COUNT(ch.id) as score,
        COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) as subscore,
        COUNT(ch.id) as num_score,
        UNIX_TIMESTAMP(u.created_at) * 1000 as create_time,
        UNIX_TIMESTAMP(u.updated_at) * 1000 as update_time,
        ROW_NUMBER() OVER (ORDER BY COUNT(ch.id) DESC, COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) DESC) as rank
      FROM users u
      LEFT JOIN cycle_history ch ON u.id = ch.user_id
      GROUP BY u.id, u.player_name, u.created_at, u.updated_at
      HAVING COUNT(ch.id) > 0
      ORDER BY score DESC, subscore DESC
      LIMIT ${limit}
    `;

    const records = await db.execute(query);
    
    const leaderboardRecords: LeaderboardRecord[] = (records as any[]).map((record: any, index: number) => ({
      leaderboard_id: leaderboardId,
      owner_id: record.owner_id.toString(),
      username: record.username || "Anonymous",
      score: Number(record.score) || 0,
      subscore: Number(record.subscore) || 0,
      num_score: Number(record.num_score) || 0,
      metadata: JSON.stringify({ puzzles_solved: Number(record.num_score) || 0 }),
      create_time: Number(record.create_time) || Date.now(),
      update_time: Number(record.update_time) || Date.now(),
      rank: Number(record.rank) || index + 1,
      max_num_score: Number(record.num_score) || 0,
      next_rank: Number(record.rank) + 1 || index + 2,
      prev_rank: Number(record.rank) - 1 || index,
    }));

    // Cache results
    leaderboardCache.set(leaderboardId, { data: leaderboardRecords, timestamp: Date.now() });

    return {
      records: leaderboardRecords,
      next_cursor: limit < leaderboardRecords.length ? limit.toString() : undefined,
    };
  } catch (error) {
    console.error("[Nakama] Error fetching leaderboard records:", error);
    return { records: [] };
  }
}

/**
 * Get leaderboard record for a specific user
 */
export async function getLeaderboardRecord(
  leaderboardId: string,
  userId: string
): Promise<LeaderboardRecord | null> {
  try {
    const db = await getDb();
    if (!db) return null;

    const query = sql`
      SELECT 
        u.id as owner_id,
        u.player_name as username,
        COUNT(ch.id) as score,
        COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) as subscore,
        COUNT(ch.id) as num_score,
        UNIX_TIMESTAMP(u.created_at) * 1000 as create_time,
        UNIX_TIMESTAMP(u.updated_at) * 1000 as update_time,
        ROW_NUMBER() OVER (ORDER BY COUNT(ch.id) DESC, COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) DESC) as rank
      FROM users u
      LEFT JOIN cycle_history ch ON u.id = ch.user_id
      WHERE u.id = ${parseInt(userId)}
      GROUP BY u.id, u.player_name, u.created_at, u.updated_at
    `;

    const records = await db.execute(query);
    
    if (!records || (records as any[]).length === 0) return null;

    const record = (records as any[])[0];
    return {
      leaderboard_id: leaderboardId,
      owner_id: record.owner_id.toString(),
      username: record.username || "Anonymous",
      score: Number(record.score) || 0,
      subscore: Number(record.subscore) || 0,
      num_score: Number(record.num_score) || 0,
      metadata: JSON.stringify({ puzzles_solved: Number(record.num_score) || 0 }),
      create_time: Number(record.create_time) || Date.now(),
      update_time: Number(record.update_time) || Date.now(),
      rank: Number(record.rank) || 0,
      max_num_score: Number(record.num_score) || 0,
      next_rank: Number(record.rank) + 1 || 0,
      prev_rank: Number(record.rank) - 1 || 0,
    };
  } catch (error) {
    console.error("[Nakama] Error fetching user leaderboard record:", error);
    return null;
  }
}

/**
 * Submit score to leaderboard
 */
export async function submitScore(
  leaderboardId: string,
  userId: string,
  score: number,
  metadata?: Record<string, any>
): Promise<LeaderboardRecord | null> {
  try {
    // Invalidate cache
    leaderboardCache.delete(leaderboardId);

    // Get updated record
    return await getLeaderboardRecord(leaderboardId, userId);
  } catch (error) {
    console.error("[Nakama] Error submitting score:", error);
    return null;
  }
}

/**
 * Get leaderboard around user
 * Returns records around a specific user's rank
 */
export async function getLeaderboardAroundUser(
  leaderboardId: string,
  userId: string,
  limit: number = 20
): Promise<{ records: LeaderboardRecord[] }> {
  try {
    const db = await getDb();
    if (!db) return { records: [] };

    const halfLimit = Math.floor(limit / 2);
    
    const query = sql`
      WITH ranked_users AS (
        SELECT 
          u.id as owner_id,
          u.player_name as username,
          COUNT(ch.id) as score,
          COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) as subscore,
          COUNT(ch.id) as num_score,
          UNIX_TIMESTAMP(u.created_at) * 1000 as create_time,
          UNIX_TIMESTAMP(u.updated_at) * 1000 as update_time,
          ROW_NUMBER() OVER (ORDER BY COUNT(ch.id) DESC, COALESCE(ROUND(AVG(CASE WHEN ch.correct = 1 THEN 100 ELSE 0 END), 2), 0) DESC) as rank
        FROM users u
        LEFT JOIN cycle_history ch ON u.id = ch.user_id
        GROUP BY u.id, u.player_name, u.created_at, u.updated_at
        HAVING COUNT(ch.id) > 0
      )
      SELECT * FROM ranked_users
      WHERE rank >= (SELECT MAX(rank) - ${halfLimit} FROM ranked_users WHERE owner_id = ${parseInt(userId)})
      AND rank <= (SELECT MAX(rank) + ${halfLimit} FROM ranked_users WHERE owner_id = ${parseInt(userId)})
      ORDER BY rank ASC
    `;

    const records = await db.execute(query);

    return {
      records: (records as any[]).map((record: any) => ({
        leaderboard_id: leaderboardId,
        owner_id: record.owner_id.toString(),
        username: record.username || "Anonymous",
        score: Number(record.score) || 0,
        subscore: Number(record.subscore) || 0,
        num_score: Number(record.num_score) || 0,
        metadata: JSON.stringify({ puzzles_solved: Number(record.num_score) || 0 }),
        create_time: Number(record.create_time) || Date.now(),
        update_time: Number(record.update_time) || Date.now(),
        rank: Number(record.rank) || 0,
        max_num_score: Number(record.num_score) || 0,
        next_rank: Number(record.rank) + 1 || 0,
        prev_rank: Number(record.rank) - 1 || 0,
      })),
    };
  } catch (error) {
    console.error("[Nakama] Error fetching leaderboard around user:", error);
    return { records: [] };
  }
}

/**
 * Clear leaderboard cache
 */
export function clearLeaderboardCache(leaderboardId?: string): void {
  if (leaderboardId) {
    leaderboardCache.delete(leaderboardId);
  } else {
    leaderboardCache.clear();
  }
}
