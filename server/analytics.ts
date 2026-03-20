import { getDb } from "./db";
import { sql } from "drizzle-orm";

export class AnalyticsManager {
  async recordPlayerEvent(playerId: number, eventType: string, value: number, metadata: Record<string, unknown> = {}) {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`
      INSERT INTO player_events (player_id, event_type, value, metadata, created_at)
      VALUES (${playerId}, ${eventType}, ${value}, ${JSON.stringify(metadata)}, NOW())
    `);
    await db.execute(sql`
      INSERT INTO player_stats (player_id, total_puzzles_attempted, total_puzzles_solved, total_score, last_active)
      VALUES (${playerId}, ${eventType === 'attempt' ? 1 : 0}, ${eventType === 'solve' ? 1 : 0}, ${eventType === 'score' ? value : 0}, NOW())
      ON DUPLICATE KEY UPDATE
        total_puzzles_attempted = total_puzzles_attempted + ${eventType === 'attempt' ? 1 : 0},
        total_puzzles_solved = total_puzzles_solved + ${eventType === 'solve' ? 1 : 0},
        total_score = total_score + ${eventType === 'score' ? value : 0},
        last_active = NOW()
    `);
  }

  async recordPuzzleCompletion(playerId: number, puzzleId: string, correct: boolean, timeMs: number) {
    await this.recordPlayerEvent(playerId, correct ? 'solve' : 'attempt', correct ? 1 : 0, { puzzleId, timeMs, correct });
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`UPDATE puzzles SET numAttempts = COALESCE(numAttempts, 0) + 1, numSolved = COALESCE(numSolved, 0) + ${correct ? 1 : 0} WHERE id = ${puzzleId}`);
  }

  async generateSiteSnapshot() {
    const db = await getDb();
    if (!db) return null;
    const [stats] = await db.execute(sql`SELECT COUNT(DISTINCT player_id) as total_players, SUM(total_puzzles_attempted) as total_attempts, SUM(total_puzzles_solved) as total_solved, AVG(total_score) as avg_score FROM player_stats`);
    return stats;
  }

  async getLeaderboard(limit: number = 20) {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.execute(sql`SELECT ps.player_id, u.name, ps.total_score, ps.total_puzzles_solved, ps.current_streak FROM player_stats ps LEFT JOIN users u ON u.id = ps.player_id ORDER BY ps.total_score DESC LIMIT ${limit}`);
    return rows;
  }
}

export const analytics = new AnalyticsManager();
