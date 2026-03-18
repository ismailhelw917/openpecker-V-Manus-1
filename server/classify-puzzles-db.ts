import { getDb } from "./db";
import { puzzles } from "../drizzle/schema";
import { eq, isNull, sql } from "drizzle-orm";
import { Chess } from "chess.js";

/**
 * Classify a puzzle FEN into an opening category based on move count
 */
export function classifyOpeningByFen(fen: string): string {
  try {
    const game = new Chess(fen);
    
    // Count the number of pieces on the board vs starting position
    const fenParts = fen.split(" ");
    const boardState = fenParts[0];
    
    // Count pieces by counting non-digit characters
    const pieces = boardState.split("/").join("").replace(/\d/g, "");
    const startingPieces = 32;
    const currentPieces = pieces.length;
    const capturedPieces = startingPieces - currentPieces;
    
    // Estimate move number (rough approximation)
    const moveNumber = capturedPieces + 5; // Rough estimate
    
    // Classify based on move depth
    if (moveNumber < 6) {
      return "Beginner Openings";
    } else if (moveNumber < 12) {
      return "Intermediate Openings";
    } else if (moveNumber < 20) {
      return "Advanced Openings";
    } else {
      return "Expert Openings";
    }
  } catch (error) {
    console.error("Error classifying opening:", error);
    return "Unclassified";
  }
}

/**
 * Batch classify puzzles with NULL opening names
 * Returns number of puzzles classified
 */
export async function classifyNullPuzzles(batchSize: number = 1000): Promise<number> {
  const db = await getDb();
  if (!db) {
    console.error("[Classify] Database not available");
    return 0;
  }

  try {
    console.log(`[Classify] Starting batch classification (batch size: ${batchSize})`);

    // Get puzzles with NULL opening names
    const nullPuzzles = await db
      .select()
      .from(puzzles)
      .where(isNull(puzzles.openingName))
      .limit(batchSize);

    console.log(`[Classify] Found ${nullPuzzles.length} puzzles to classify`);

    if (nullPuzzles.length === 0) {
      console.log("[Classify] No puzzles to classify");
      return 0;
    }

    let classified = 0;
    let failed = 0;

    // Process each puzzle
    for (const puzzle of nullPuzzles) {
      try {
        const opening = classifyOpeningByFen(puzzle.fen);

        // Update the puzzle with the classified opening
        await db
          .update(puzzles)
          .set({ openingName: opening })
          .where(eq(puzzles.id, puzzle.id));

        classified++;

        if (classified % 100 === 0) {
          console.log(`[Classify] Classified ${classified}/${nullPuzzles.length} puzzles...`);
        }
      } catch (error) {
        failed++;
        console.error(`[Classify] Failed to classify puzzle ${puzzle.id}:`, error);
      }
    }

    console.log(`[Classify] Batch complete: ${classified} classified, ${failed} failed`);
    return classified;
  } catch (error) {
    console.error("[Classify] Error during classification:", error);
    return 0;
  }
}

/**
 * Get puzzle classification statistics
 */
export async function getPuzzleClassificationStats(): Promise<{
  total: number;
  nullCount: number;
  namedCount: number;
  uniqueOpenings: number;
  averageRating: string;
  openingDistribution: Array<{ opening: string; count: number }>;
}> {
  const db = await getDb();
  if (!db) {
    console.error("[Classify] Database not available");
    return {
      total: 0,
      nullCount: 0,
      namedCount: 0,
      uniqueOpenings: 0,
      averageRating: "1500",
      openingDistribution: [],
    };
  }

  try {
    // Get total count
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(puzzles);
    const total = totalResult[0]?.count || 0;

    // Get null count
    const nullResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(puzzles)
      .where(isNull(puzzles.openingName));
    const nullCount = nullResult[0]?.count || 0;

    // Get named count
    const namedCount = total - nullCount;

    // Get unique openings
    const uniqueResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT openingName)` })
      .from(puzzles);
    const uniqueOpenings = uniqueResult[0]?.count || 0;

    // Get average rating
    const ratingResult = await db
      .select({ avg: sql<number>`AVG(rating)` })
      .from(puzzles);
    const averageRating = (ratingResult[0]?.avg || 1500).toFixed(0);

    // Get distribution
    const distribution = await db
      .select({
        opening: puzzles.openingName,
        count: sql<number>`COUNT(*)`,
      })
      .from(puzzles)
      .groupBy(puzzles.openingName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    return {
      total,
      nullCount,
      namedCount,
      uniqueOpenings,
      averageRating,
      openingDistribution: distribution.map((d) => ({
        opening: d.opening || "NULL",
        count: d.count,
      })),
    };
  } catch (error) {
    console.error("[Classify] Error getting stats:", error);
    return {
      total: 0,
      nullCount: 0,
      namedCount: 0,
      uniqueOpenings: 0,
      averageRating: "1500",
      openingDistribution: [],
    };
  }
}
