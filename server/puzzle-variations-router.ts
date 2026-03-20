import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { getDb } from "./db";
import { puzzles } from "../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export const puzzleVariationsRouter = router({
  getWithVariations: protectedProcedure
    .input(z.object({ puzzleId: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
      if (!puzzle) return null;
      let parsedVariations = null;
      if (puzzle.variations) {
        try { parsedVariations = JSON.parse(puzzle.variations as string); } catch { parsedVariations = null; }
      }
      return { ...puzzle, parsedVariations };
    }),

  getByDifficulty: publicProcedure
    .input(z.object({
      minDifficulty: z.number(), maxDifficulty: z.number(),
      limit: z.number().default(20), offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await requireDb();
      return db.select().from(puzzles)
        .where(and(gte(puzzles.difficulty, input.minDifficulty), lte(puzzles.difficulty, input.maxDifficulty)))
        .orderBy(desc(puzzles.rating)).limit(input.limit).offset(input.offset);
    }),

  getAnalysis: protectedProcedure
    .input(z.object({ puzzleId: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
      if (!puzzle) return null;
      const moves = (puzzle.moves as string).split(" ");
      const themes = (puzzle.themes as string).split(" ").filter(Boolean);
      return {
        puzzleId: puzzle.id, fen: puzzle.fen, moves: puzzle.moves, rating: puzzle.rating,
        difficulty: puzzle.difficulty, solutionLength: moves.length, themes,
        opening: puzzle.openingName, variation: puzzle.openingVariation,
        numAttempts: puzzle.numAttempts, numSolved: puzzle.numSolved,
        successRate: puzzle.numAttempts && puzzle.numAttempts > 0
          ? ((puzzle.numSolved || 0) / puzzle.numAttempts) * 100 : null,
      };
    }),

  getBestMove: protectedProcedure
    .input(z.object({ puzzleId: z.string(), moveIndex: z.number() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
      if (!puzzle) return null;
      const moves = (puzzle.moves as string).split(" ");
      if (input.moveIndex >= moves.length) return { hint: null, isLastMove: true };
      const m = moves[input.moveIndex];
      return {
        hint: { from: m.substring(0, 2), to: m.substring(2, 4), fullMove: m },
        isLastMove: input.moveIndex === moves.length - 1, totalMoves: moves.length,
      };
    }),

  getVariationStats: publicProcedure
    .input(z.object({ puzzleId: z.string() }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const [puzzle] = await db.select().from(puzzles).where(eq(puzzles.id, input.puzzleId)).limit(1);
      if (!puzzle) return null;
      let variationCount = 0;
      if (puzzle.variations) {
        try { const p = JSON.parse(puzzle.variations as string); if (Array.isArray(p)) variationCount = p.length; } catch {}
      }
      return { puzzleId: puzzle.id, variationCount, hasVariations: variationCount > 0, solutionLength: (puzzle.moves as string).split(" ").length };
    }),
});
