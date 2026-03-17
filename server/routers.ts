import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  getPuzzlesByThemeAndRating,
  getRandomPuzzlesByThemeAndRating,
  getPuzzleById,
  insertPuzzles,
  createTrainingSet,
  getTrainingSet,
  getTrainingSetsByUser,
  updateTrainingSet,
  deleteTrainingSet,
  createCycleRecord,
  getCycleHistoryByUser,
  getCycleHistoryByTrainingSet,
  getAllOpenings,
  insertOpenings,
  recordPuzzleAttempt,
  getPuzzleAttemptsByTrainingSet,
  getUserByOpenId,
} from "./db";

/**
 * Fetch puzzles from BigQuery or fallback to local database
 * Supports filtering by theme, rating range, and color
 */
async function fetchPuzzlesFromBigQuery(
  theme: string,
  minRating: number,
  maxRating: number,
  count: number,
  color?: string
) {
  // Try BigQuery first if configured
  const bigQueryUrl = process.env.BUILT_IN_FORGE_API_URL;
  const bigQueryKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (bigQueryUrl && bigQueryKey) {
    try {
      const params = new URLSearchParams({
        theme,
        minRating: String(minRating),
        maxRating: String(maxRating),
        count: String(count),
      });

      if (color && color !== "both") {
        params.append("color", color);
      }

      const response = await fetch(`${bigQueryUrl}/api/puzzles?${params}`, {
        headers: {
          Authorization: `Bearer ${bigQueryKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          // Cache puzzles in local database for fallback
          const puzzlesToInsert = data.data.map((p: any) => ({
            id: p.puzzle_id || p.id,
            fen: p.fen,
            moves: JSON.stringify(p.moves || []),
            rating: p.rating,
            themes: JSON.stringify(p.themes || [theme]),
            color: p.color,
            puzzleData: JSON.stringify(p),
          }));
          await insertPuzzles(puzzlesToInsert);
          return data.data;
        }
      }
    } catch (error) {
      console.error("[PUZZLE FETCH] BigQuery error:", error);
      // Fall through to local database
    }
  }

  // Fallback to local database
  console.log("[PUZZLE FETCH] Using local database fallback");
  return getPuzzlesByThemeAndRating(theme, minRating, maxRating, count, color);
}

/**
 * Fetch openings from BigQuery or fallback to local database
 */
async function fetchOpeningsData() {
  const bigQueryUrl = process.env.BUILT_IN_FORGE_API_URL;
  const bigQueryKey = process.env.BUILT_IN_FORGE_API_KEY;

  if (bigQueryUrl && bigQueryKey) {
    try {
      const response = await fetch(`${bigQueryUrl}/api/openings`, {
        headers: {
          Authorization: `Bearer ${bigQueryKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          // Cache openings in local database
          const openingsToInsert = data.data.map((o: any) => ({
            id: o.id || nanoid(),
            name: o.name,
            fen: o.fen,
            ecoCode: o.ecoCode,
          }));
          await insertOpenings(openingsToInsert);
          return data.data;
        }
      }
    } catch (error) {
      console.error("[OPENINGS FETCH] BigQuery error:", error);
    }
  }

  // Fallback to local database
  return getAllOpenings();
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Puzzle-related procedures
  puzzles: router({
    /**
     * Fetch puzzles by theme and rating range
     * Supports BigQuery with local database fallback
     */
    fetchByTheme: publicProcedure
      .input(
        z.object({
          theme: z.string(),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
          count: z.number().default(20),
          color: z.enum(["white", "black", "both"]).optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          const puzzles = await fetchPuzzlesFromBigQuery(
            input.theme,
            input.minRating,
            input.maxRating,
            input.count,
            input.color
          );

          if (!puzzles || puzzles.length === 0) {
            return {
              success: false,
              error: `No puzzles found for theme "${input.theme}"`,
              puzzles: [],
            };
          }

          return {
            success: true,
            puzzles: puzzles.map((p: any) => ({
              id: p.id || p.puzzle_id,
              fen: p.fen,
              moves: typeof p.moves === "string" ? JSON.parse(p.moves) : p.moves,
              rating: p.rating,
              themes: typeof p.themes === "string" ? JSON.parse(p.themes) : p.themes,
              color: p.color,
            })),
          };
        } catch (error) {
          console.error("[PUZZLE FETCH ERROR]", error);
          return {
            success: false,
            error: "Failed to fetch puzzles",
            puzzles: [],
          };
        }
      }),

    /**
     * Get a single puzzle by ID
     */
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const puzzle = await getPuzzleById(input.id);
        return puzzle || null;
      }),
  }),

  // Opening-related procedures
  openings: router({
    /**
     * Fetch all available openings
     */
    list: publicProcedure.query(async () => {
      try {
        const openings = await fetchOpeningsData();
        return {
          success: true,
          openings: openings.map((o: any) => ({
            id: o.id,
            name: o.name,
            fen: o.fen,
            ecoCode: o.ecoCode,
          })),
        };
      } catch (error) {
        console.error("[OPENINGS LIST ERROR]", error);
        return {
          success: false,
          openings: [],
        };
      }
    }),

    getNames: publicProcedure.query(async () => {
      try {
        const { getUniqueOpenings } = await import("./db");
        const openingNames = await getUniqueOpenings();
        return openingNames || [];
      } catch (error) {
        console.error("[GET OPENING NAMES ERROR]", error);
        return [];
      }
    }),
  }),

  // Training set management
  trainingSets: router({
    /**
     * Create a new training set with puzzles
     */
    create: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          openingName: z.string().optional(),
          openingFen: z.string().optional(),
          themes: z.array(z.string()),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
          puzzleCount: z.number().default(20),
          targetCycles: z.number().default(3),
          colorFilter: z.enum(["white", "black", "both"]).default("both"),
          puzzles: z.array(
            z.object({
              id: z.string(),
              fen: z.string(),
              moves: z.array(z.string()),
              rating: z.number(),
              themes: z.array(z.string()),
              color: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const setId = nanoid();
          const set = {
            id: setId,
            userId: input.userId,
            deviceId: input.deviceId,
            openingName: input.openingName,
            openingFen: input.openingFen,
            themes: JSON.stringify(input.themes),
            minRating: input.minRating,
            maxRating: input.maxRating,
            puzzleCount: input.puzzleCount,
            targetCycles: input.targetCycles,
            colorFilter: input.colorFilter,
            puzzlesJson: JSON.stringify(input.puzzles),
            status: "active" as const,
            cyclesCompleted: 0,
            totalAttempts: 0,
          };

          await createTrainingSet(set);

          return {
            success: true,
            setId,
          };
        } catch (error) {
          console.error("[CREATE TRAINING SET ERROR]", error);
          return {
            success: false,
            error: "Failed to create training set",
          };
        }
      }),

    /**
     * Fetch random puzzles by theme and rating
     */
    fetchPuzzles: publicProcedure
      .input(
        z.object({
          theme: z.string(),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
          count: z.number().default(20),
          colorFilter: z.enum(["white", "black", "both"]).default("both"),
        })
      )
      .query(async ({ input }) => {
        try {
          const puzzles = await getRandomPuzzlesByThemeAndRating(
            input.theme,
            input.minRating,
            input.maxRating,
            input.count,
            input.colorFilter === "both" ? undefined : input.colorFilter
          );

          return {
            success: true,
            puzzles: puzzles.map((p: any) => {
              // Parse moves - could be JSON array or space-separated string
              let moves = [];
              if (typeof p.moves === "string") {
                try {
                  moves = JSON.parse(p.moves);
                } catch (e) {
                  // If not JSON, treat as space-separated moves
                  moves = p.moves.split(" ").filter((m: string) => m.length > 0);
                }
              } else if (Array.isArray(p.moves)) {
                moves = p.moves;
              }

              // Parse themes - could be JSON array or string
              let themes = [];
              if (typeof p.themes === "string") {
                try {
                  themes = JSON.parse(p.themes);
                } catch (e) {
                  // If not JSON, treat as single theme
                  themes = [p.themes];
                }
              } else if (Array.isArray(p.themes)) {
                themes = p.themes;
              }

              return {
                id: p.id,
                fen: p.fen,
                moves,
                rating: p.rating,
                themes,
                color: p.color,
              };
            }),
          };
        } catch (error) {
          console.error("[FETCH PUZZLES ERROR]", error);
          return {
            success: false,
            puzzles: [],
            error: "Failed to fetch puzzles",
          };
        }
      }),

    /**
     * Fetch random puzzles by opening name and rating
     */
    fetchPuzzlesByOpening: publicProcedure
      .input(
        z.object({
          opening: z.string(),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
          count: z.number().default(20),
          colorFilter: z.enum(["white", "black", "both"]).default("both"),
        })
      )
      .query(async ({ input }) => {
        try {
          const { getRandomPuzzlesByOpeningAndRating } = await import("./db");
          const puzzles = await getRandomPuzzlesByOpeningAndRating(
            input.opening,
            input.minRating,
            input.maxRating,
            input.count,
            input.colorFilter === "both" ? undefined : input.colorFilter
          );

          return {
            success: true,
            puzzles: puzzles.map((p: any) => {
              // Parse moves - could be JSON array or space-separated string
              let moves = [];
              if (typeof p.moves === "string") {
                try {
                  moves = JSON.parse(p.moves);
                } catch (e) {
                  // If not JSON, treat as space-separated moves
                  moves = p.moves.split(" ").filter((m: string) => m.length > 0);
                }
              } else if (Array.isArray(p.moves)) {
                moves = p.moves;
              }

              // Parse themes - could be JSON array or string
              let themes = [];
              if (typeof p.themes === "string") {
                try {
                  themes = JSON.parse(p.themes);
                } catch (e) {
                  // If not JSON, treat as single theme
                  themes = [p.themes];
                }
              } else if (Array.isArray(p.themes)) {
                themes = p.themes;
              }

              return {
                id: p.id,
                fen: p.fen,
                moves,
                rating: p.rating,
                themes,
                color: p.color,
              };
            }),
          };
        } catch (error) {
          console.error("[FETCH PUZZLES BY OPENING ERROR]", error);
          return {
            success: false,
            puzzles: [],
            error: "Failed to fetch puzzles",
          };
        }
      }),

    /**
     * Get a training set by ID
     */
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const set = await getTrainingSet(input.id);
        if (!set) return null;

        return {
          ...set,
          themes: JSON.parse(set.themes),
          puzzlesJson: JSON.parse(set.puzzlesJson),
        };
      }),

    /**
     * Get all training sets for a user or device
     */
    list: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const sets = await getTrainingSetsByUser(input.userId || null, input.deviceId || null);
        return sets.map((set) => ({
          ...set,
          themes: JSON.parse(set.themes),
          puzzlesJson: JSON.parse(set.puzzlesJson),
        }));
      }),

    /**
     * Update a training set (status, progress, etc.)
     */
    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          status: z.enum(["active", "paused", "completed"]).optional(),
          cyclesCompleted: z.number().optional(),
          bestAccuracy: z.number().optional(),
          totalAttempts: z.number().optional(),
          lastPlayedAt: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const { id, ...updates } = input;
          await updateTrainingSet(id, updates);
          return { success: true };
        } catch (error) {
          console.error("[UPDATE TRAINING SET ERROR]", error);
          return { success: false, error: "Failed to update training set" };
        }
      }),

    /**
     * Delete a training set
     */
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        try {
          await deleteTrainingSet(input.id);
          return { success: true };
        } catch (error) {
          console.error("[DELETE TRAINING SET ERROR]", error);
          return { success: false, error: "Failed to delete training set" };
        }
      }),
  }),

  // Cycle history and progress tracking
  cycles: router({
    /**
     * Record completion of a cycle
     */
    complete: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          trainingSetId: z.string(),
          cycleNumber: z.number(),
          totalPuzzles: z.number(),
          correctCount: z.number(),
          totalTimeMs: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const accuracy = (input.correctCount / input.totalPuzzles) * 100;
          const recordData: any = {
            userId: input.userId,
            deviceId: input.deviceId,
            trainingSetId: input.trainingSetId,
            cycleNumber: input.cycleNumber,
            totalPuzzles: input.totalPuzzles,
            correctCount: input.correctCount,
            totalTimeMs: input.totalTimeMs,
            accuracy: accuracy,
          };
          const record = recordData;

          await createCycleRecord(record);

          // Update training set progress
          const set = await getTrainingSet(input.trainingSetId);
          if (set) {
            const currentBestAccuracy = set.bestAccuracy ? Number(set.bestAccuracy) : 0;
            const targetCycles = set.targetCycles || 3;
            const newBestAccuracy = Math.max(currentBestAccuracy, accuracy);
            const updates: any = {
              cyclesCompleted: input.cycleNumber,
              bestAccuracy: newBestAccuracy,
              totalAttempts: (set.totalAttempts || 0) + input.totalPuzzles,
              lastPlayedAt: new Date(),
              status:
                input.cycleNumber >= targetCycles ? ("completed" as const) : ("active" as const),
            };
            await updateTrainingSet(input.trainingSetId, updates);
          }

          return { success: true };
        } catch (error) {
          console.error("[COMPLETE CYCLE ERROR]", error);
          return { success: false, error: "Failed to record cycle" };
        }
      }),

    /**
     * Get cycle history for a user or device
     */
    list: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return getCycleHistoryByUser(input.userId || null, input.deviceId || null);
      }),

    /**
     * Get cycle history for a specific training set
     */
    getBySet: publicProcedure
      .input(z.object({ trainingSetId: z.string() }))
      .query(async ({ input }) => {
        return getCycleHistoryByTrainingSet(input.trainingSetId);
      }),
  }),

  // Stats and analytics
  stats: router({
    /**
     * Get comprehensive stats for a user or device
     */
    getSummary: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        try {
          const cycles = await getCycleHistoryByUser(input.userId || null, input.deviceId || null);

          const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
          const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
          const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
          const completedCycles = cycles.length;
          const totalTimeMs = cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);

          return {
            totalPuzzles,
            totalCorrect,
            accuracy,
            completedCycles,
            totalTimeMs,
            averageTimePerPuzzle: totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles) : 0,
          };
        } catch (error) {
          console.error("[GET STATS ERROR]", error);
          return {
            totalPuzzles: 0,
            totalCorrect: 0,
            accuracy: 0,
            completedCycles: 0,
            totalTimeMs: 0,
            averageTimePerPuzzle: 0,
          };
        }
      }),
  }),

  // Puzzle attempts tracking
  attempts: router({
    /**
     * Record a puzzle attempt
     */
    record: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          trainingSetId: z.string(),
          cycleNumber: z.number(),
          puzzleId: z.string(),
          isCorrect: z.boolean(),
          timeMs: z.number().optional(),
          attemptNumber: z.number().default(1),
        })
      )
      .mutation(async ({ input }) => {
        try {
          await recordPuzzleAttempt({
            userId: input.userId,
            deviceId: input.deviceId,
            trainingSetId: input.trainingSetId,
            cycleNumber: input.cycleNumber,
            puzzleId: input.puzzleId,
            isCorrect: input.isCorrect ? 1 : 0,
            timeMs: input.timeMs,
            attemptNumber: input.attemptNumber,
          });

          return { success: true };
        } catch (error) {
          console.error("[RECORD ATTEMPT ERROR]", error);
          return { success: false, error: "Failed to record attempt" };
        }
      }),

    /**
     * Get all attempts for a training set
     */
    getBySet: publicProcedure
      .input(z.object({ trainingSetId: z.string() }))
      .query(async ({ input }) => {
        return getPuzzleAttemptsByTrainingSet(input.trainingSetId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
