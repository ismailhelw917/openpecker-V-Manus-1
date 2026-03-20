import { getDb } from "../db";
import { puzzleAttempts, puzzles } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * CSV Exporter - Generates Lichess-like stats CSV for users
 * Format: user_id, opening, variation, total_puzzles, correct_puzzles, accuracy, avg_time_ms, date
 */

export interface StatsRecord {
  userId?: number;
  deviceId?: string;
  opening: string;
  variation?: string;
  totalPuzzles: number;
  correctPuzzles: number;
  accuracy: number;
  avgTimeMs: number;
  exportDate: string;
}

/**
 * Aggregate puzzle attempt stats by opening/variation for a user
 */
export async function aggregateUserStats(
  userId?: number,
  deviceId?: string
): Promise<StatsRecord[]> {
  if (!userId && !deviceId) {
    throw new Error("Either userId or deviceId must be provided");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Query puzzle attempts for this user
  const attempts = await db
    .select({
      puzzleId: puzzleAttempts.puzzleId,
      isCorrect: puzzleAttempts.isCorrect,
      timeMs: puzzleAttempts.timeMs,
    })
    .from(puzzleAttempts)
    .where(
      userId
        ? eq(puzzleAttempts.userId, userId)
        : eq(puzzleAttempts.deviceId, deviceId!)
    );

  if (attempts.length === 0) {
    return [];
  }

  // Get puzzle metadata for these attempts
  const puzzleIdSet = new Set(attempts.map((a: any) => a.puzzleId));
  const puzzleIds = Array.from(puzzleIdSet);
  const puzzleMetadata = await db
    .select({
      id: puzzles.id,
      openingName: puzzles.openingName,
      openingVariation: puzzles.openingVariation,
    })
    .from(puzzles)
    .where(eq(puzzles.id, puzzleIds[0])); // TODO: Use IN clause for all puzzle IDs

  // Aggregate by opening/variation
  const stats: Map<string, StatsRecord> = new Map();

  for (const attempt of attempts) {
    const puzzle = puzzleMetadata.find((p: any) => p.id === attempt.puzzleId);
    if (!puzzle) continue;

    const key = `${puzzle.openingName}|${puzzle.openingVariation}`;
    const existing = stats.get(key) || {
      userId,
      deviceId,
      opening: puzzle.openingName || "Unknown",
      variation: puzzle.openingVariation || "Unknown",
      totalPuzzles: 0,
      correctPuzzles: 0,
      accuracy: 0,
      avgTimeMs: 0,
      exportDate: new Date().toISOString().split("T")[0],
    };

    existing.totalPuzzles += 1;
    if (attempt.isCorrect) {
      existing.correctPuzzles += 1;
    }
    existing.accuracy =
      (existing.correctPuzzles / existing.totalPuzzles) * 100;
    existing.avgTimeMs = Math.round(
      (existing.avgTimeMs * (existing.totalPuzzles - 1) +
        (attempt.timeMs || 0)) /
        existing.totalPuzzles
    );

    stats.set(key, existing);
  }

  return Array.from(stats.values());
}

/**
 * Generate CSV content from stats records
 */
export function generateCSV(records: StatsRecord[]): string {
  const headers = [
    "opening",
    "variation",
    "total_puzzles",
    "correct_puzzles",
    "accuracy_%",
    "avg_time_ms",
    "export_date",
  ];

  const rows = records.map((r) => [
    `"${r.opening}"`,
    `"${r.variation || ""}"`,
    r.totalPuzzles,
    r.correctPuzzles,
    r.accuracy.toFixed(2),
    r.avgTimeMs,
    r.exportDate,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Export stats as CSV string
 */
export async function exportUserStatsAsCSV(
  userId?: number,
  deviceId?: string
): Promise<string> {
  const records = await aggregateUserStats(userId, deviceId);
  return generateCSV(records);
}
