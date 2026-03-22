import { publicProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

export const leaderboardRouter = {
  /**
   * Get top 100 players from database and active sessions
   * Combines registered users with training data and active session players
   */
  getLeaderboard: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return { players: [], activeSessions: [] };
    }

    try {
      // Get registered and guest players with training data
      const dbPlayers = await db.execute(sql`
        SELECT 
          COALESCE(u.id, p.id) as id,
          COALESCE(u.name, p.playerName) as name,
          COALESCE(u.email, '') as email,
          COUNT(ch.id) as puzzlesSolved,
          ROUND(AVG(ch.accuracy), 2) as accuracy,
          SUM(ch.totalTimeMs) as totalTimeMs,
          COALESCE(u.createdAt, p.createdAt) as joinDate,
          CASE WHEN u.id IS NOT NULL THEN 0 ELSE 1 END as isGuest
        FROM (
          SELECT DISTINCT userId FROM cycle_history
          UNION
          SELECT id FROM players WHERE id IS NOT NULL
        ) as player_ids
        LEFT JOIN users u ON u.id = player_ids.userId
        LEFT JOIN players p ON p.id = player_ids.userId
        LEFT JOIN cycle_history ch ON (u.id = ch.userId OR p.id = ch.userId)
        GROUP BY COALESCE(u.id, p.id), COALESCE(u.name, p.playerName)
        ORDER BY puzzlesSolved DESC, accuracy DESC
        LIMIT 100
      `);

      // Get active sessions (currently online players)
      const activeSessions = await db.execute(sql`
        SELECT 
          id as sessionId,
          name,
          email,
          isGuest,
          currentPath,
          lastActive
        FROM active_sessions
        WHERE lastActive > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        ORDER BY lastActive DESC
      `);

      return {
        players: dbPlayers || [],
        activeSessions: activeSessions || [],
      };
    } catch (error) {
      console.error("[Leaderboard] Query failed", error);
      return { players: [], activeSessions: [] };
    }
  }),

  /**
   * Get active sessions only (for real-time updates)
   */
  getActiveSessions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) {
      return [];
    }

    try {
      const sessions = await db.execute(sql`
        SELECT 
          id as sessionId,
          name,
          email,
          isGuest,
          currentPath,
          lastActive
        FROM active_sessions
        WHERE lastActive > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        ORDER BY lastActive DESC
        LIMIT 100
      `);

      return sessions || [];
    } catch (error) {
      console.error("[Active Sessions] Query failed", error);
      return [];
    }
  }),
};
