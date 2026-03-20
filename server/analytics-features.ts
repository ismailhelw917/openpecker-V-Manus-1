import { getDb } from "./db";
import { sql } from "drizzle-orm";

export class AdvancedAnalytics {
  async getPlayerInsights(playerId: number) {
    const db = await getDb();
    if (!db) return null;
    const [stats] = await db.execute(sql`SELECT * FROM player_stats WHERE player_id = ${playerId}`);
    return { stats };
  }

  async getOpeningLeaderboard(openingName: string, limit: number = 20) {
    const db = await getDb();
    if (!db) return [];
    return db.execute(sql`SELECT op.player_id, u.name, op.puzzles_solved, op.avg_time_ms FROM opening_performance op LEFT JOIN users u ON u.id = op.player_id WHERE op.opening_name = ${openingName} ORDER BY op.puzzles_solved DESC LIMIT ${limit}`);
  }

  async getActivityHeatmap(playerId: number, days: number = 30) {
    const db = await getDb();
    if (!db) return [];
    return db.execute(sql`SELECT DATE(created_at) as day, COUNT(*) as count FROM player_events WHERE player_id = ${playerId} AND created_at >= DATE_SUB(NOW(), INTERVAL ${days} DAY) GROUP BY DATE(created_at) ORDER BY day`);
  }

  async getTrendingPlayers(limit: number = 10) {
    const db = await getDb();
    if (!db) return [];
    return db.execute(sql`SELECT ps.player_id, u.name, ps.total_score, ps.current_streak FROM player_stats ps LEFT JOIN users u ON u.id = ps.player_id WHERE ps.last_active >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY ps.current_streak DESC LIMIT ${limit}`);
  }

  async recordOpeningPerformance(playerId: number, openingName: string, solved: boolean, timeMs: number) {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO opening_performance (player_id, opening_name, puzzles_attempted, puzzles_solved, total_time_ms, avg_time_ms)
      VALUES (${playerId}, ${openingName}, 1, ${solved ? 1 : 0}, ${timeMs}, ${timeMs})
      ON DUPLICATE KEY UPDATE puzzles_attempted = puzzles_attempted + 1, puzzles_solved = puzzles_solved + ${solved ? 1 : 0}, total_time_ms = total_time_ms + ${timeMs}, avg_time_ms = (total_time_ms + ${timeMs}) / (puzzles_attempted + 1)
    `);
  }

  async recordDifficultyPerformance(playerId: number, difficulty: number, solved: boolean, timeMs: number) {
    const db = await getDb();
    if (!db) return;
    const rangeMin = Math.floor(difficulty / 500) * 500;
    const rangeMax = rangeMin + 499;
    await db.execute(sql`
      INSERT INTO difficulty_performance (player_id, difficulty_range_min, difficulty_range_max, puzzles_attempted, puzzles_solved, total_time_ms, avg_time_ms)
      VALUES (${playerId}, ${rangeMin}, ${rangeMax}, 1, ${solved ? 1 : 0}, ${timeMs}, ${timeMs})
      ON DUPLICATE KEY UPDATE puzzles_attempted = puzzles_attempted + 1, puzzles_solved = puzzles_solved + ${solved ? 1 : 0}, total_time_ms = total_time_ms + ${timeMs}, avg_time_ms = (total_time_ms + ${timeMs}) / (puzzles_attempted + 1)
    `);
  }
}

export const advancedAnalytics = new AdvancedAnalytics();
