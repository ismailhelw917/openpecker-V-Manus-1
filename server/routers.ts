import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { puzzleVariationsRouter } from "./puzzle-variations-router";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { sdk } from "./_core/sdk";
// Counter API removed - using database only
import { getMockOnlineCount } from "./mockOnlineCount";
import { getDb,
  getPuzzlesByThemeAndRating,
  getRandomPuzzlesByThemeAndRating,
  getRandomPuzzlesByOpeningAndRating,
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
  getPuzzleAttemptStatsForSets,
  getPuzzleAttemptStats,
  getPuzzleAttemptsByUser,
  getUserByOpenId,
  getUserByEmail,
  updateUserPasswordHash,
  upsertUser,
  countTotalUsers,
  getAllRegisteredUsers,
  getPromoCodeByCode,
  redeemPromoCode,
  getAllPromoCodes,
  getUserRedemptions,
  createOrUpdateOnlineSession,
  updateSessionHeartbeat,
  getOnlineSessionCount,
  endOnlineSession,
  cleanupStaleOnlineSessions,
  updatePlayerName,
  classifyAllPuzzlesByVariation,
  getOpeningHierarchy,
  getPuzzlesByOpeningHierarchy,
  getPuzzleCountByOpeningHierarchy,
} from "./db";
import {
  getOnlineCount,
  getOnlineCountByPageActivity,
  getTotalPlayerCount,
  getLeaderboardPlayers,
} from "./players";

export const appRouter = router({
  system: systemRouter,

  // ==================== AUTH ====================
  auth: router({
    /**
     * Get current user info from session
     */
    me: publicProcedure.query(async ({ ctx }) => {
      return ctx.user || null;
    }),

    /**
     * OAuth callback handler
     */
    oauthCallback: publicProcedure
      .input(
        z.object({
          code: z.string(),
          state: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const { code, state } = input;

          // Parse state to get redirect origin
          let redirectOrigin = "https://openpecker.com";
          try {
            const stateData = JSON.parse(Buffer.from(state, "base64").toString());
            redirectOrigin = stateData.origin || redirectOrigin;
          } catch (e) {
            console.error("Failed to parse state:", e);
          }

          // Exchange code for token
          let tokenResponse: any;
          try {
            tokenResponse = await sdk.exchangeCodeForToken(code, state || '');
          } catch (err) {
            console.error('OAuth token exchange failed:', err);
            return { success: false, error: 'Token exchange failed' };
          }

          if (!tokenResponse?.accessToken) {
            return { success: false, error: 'No access token received' };
          }

          // Get user info
          let userInfo: any;
          try {
            userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
          } catch (err) {
            console.error('Failed to get user info:', err);
            return { success: false, error: 'Failed to get user info' };
          }

          if (!userInfo?.openId) {
            return { success: false, error: 'Failed to get user info' };
          }

          // Upsert user in database
          const user = await upsertUser({
            openId: userInfo.openId,
            name: userInfo.name,
            email: userInfo.email,
          });

          // Ensure player row exists in players table for leaderboard
          if (user && user.id && user.name) {
            try {
              const { getOrCreatePlayer, updatePlayerStats } = await import('./players');
              const player = await getOrCreatePlayer(
                user.id,
                null,
                user.name,
                userInfo.email,
                user.isPremium || 0
              );
              // Update player name if it changed
              if (user.id) {
                await updatePlayerName(user.id, user.name);
              }
              // Refresh player stats from actual data
              if (player?.id) {
                await updatePlayerStats(player.id);
              }
            } catch (playerError) {
              console.warn('[OAuth] Failed to create/update player:', playerError);
            }
          }



          // Create session token
          const sessionToken = nanoid();
          const cookieOptions = getSessionCookieOptions(ctx.req);

          // Set session cookie
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
          });

          return {
            success: true,
            user,
            redirectUrl: redirectOrigin,
          };
        } catch (error) {
          console.error("OAuth callback error:", error);
          return { success: false, error: "Authentication failed" };
        }
      }),

    /**
     * Mark user as registered after first login
     */
    completeRegistration: protectedProcedure.mutation(async ({ ctx }) => {
      if (!ctx.user?.id) {
        throw new Error('User not authenticated');
      }

      const db = await getDb();
      if (!db) {
        throw new Error('Database not available');
      }

      const { users: usersTable } = await import('../drizzle/schema');
      await db
        .update(usersTable)
        .set({ hasRegistered: 1 })
        .where(eq(usersTable.id, ctx.user.id));

      return { success: true };
    }),

    /**
     * Logout user
     */
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),

    /**
     * Check if user is authenticated
     */
    isAuthenticated: publicProcedure.query(async ({ ctx }) => {
      return !!ctx.user;
    }),

    /**
     * Update user name
     */
    updateName: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(50),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }

        const db = await getDb();
        if (!db) {
          throw new Error('Database not available');
        }

        // Update user name in users table
        const { users: usersTable } = await import('../drizzle/schema');
        await db
          .update(usersTable)
          .set({ name: input.name })
          .where(eq(usersTable.id, ctx.user.id));

        // Update player name in leaderboard
        try {
          await updatePlayerName(ctx.user.id, input.name);
        } catch (err) {
          console.warn('Failed to update player name:', err);
        }

        return {
          success: true,
          user: {
            ...ctx.user,
            name: input.name,
          },
        };
      }),

    /**
     * Check if user is eligible for gift/promo
     */
    checkGiftEligibility: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return {
          eligible: true,
          reason: "User is eligible for promotional offers",
        };
      }),
  }),

  // ==================== PUZZLES ====================
  puzzles: router({
    /**
     * Get puzzles by theme and rating range
     */
    getByThemeAndRating: publicProcedure
      .input(
        z.object({
          theme: z.string(),
          minRating: z.number().default(0),
          maxRating: z.number().default(3000),
          limit: z.number().default(50),
        })
      )
      .query(async ({ input }) => {
        return getPuzzlesByThemeAndRating(
          input.theme,
          input.minRating,
          input.maxRating,
          input.limit
        );
      }),

    /**
     * Get random puzzles by theme and rating
     */
    getRandomByThemeAndRating: publicProcedure
      .input(
        z.object({
          theme: z.string(),
          minRating: z.number().default(0),
          maxRating: z.number().default(3000),
          count: z.number().default(1),
        })
      )
      .query(async ({ input }) => {
        return getRandomPuzzlesByThemeAndRating(
          input.theme,
          input.minRating,
          input.maxRating,
          input.count
        );
      }),

    /**
     * Get puzzle by ID
     */
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return getPuzzleById(input.id);
      }),

    /**
     * Insert puzzles (admin only)
     */
    insert: protectedProcedure
      .input(
        z.object({
          puzzles: z.array(
            z.object({
              id: z.string(),
              fen: z.string(),
              moves: z.string(),
              rating: z.number(),
              ratingDeviation: z.number(),
              popularity: z.number(),
              nbPlays: z.number(),
              themes: z.string(),
              gameUrl: z.string(),
              openingTags: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return insertPuzzles(input.puzzles);
      }),
  }),

  // ==================== OPENINGS ====================
  openings: router({
    /**
     * Get all openings
     */
    getAll: publicProcedure.query(async () => {
      return getAllOpenings();
    }),

    /**
     * Get opening names only (for dropdown selection)
     */
    getNames: publicProcedure.query(async () => {
      const { getOpeningsWithPuzzleCounts } = await import("./db");
      try {
        const openingsWithCounts = await getOpeningsWithPuzzleCounts();
        console.log("[getNames] openingsWithCounts:", openingsWithCounts);
        if (!openingsWithCounts || openingsWithCounts.length === 0) {
          return [];
        }
        return openingsWithCounts.map((opening: any) => ({
          name: opening.openingName || opening.name || '',
          puzzleCount: parseInt(opening.puzzle_count) || 0,
          avgRating: parseFloat(opening.avg_rating) || 1500,
        })).filter((o: any) => o.name);
      } catch (error) {
        console.error("[getNames] Error:", error);
        return [];
      }
    }),

    /**
     * Insert openings (admin only)
     */
    insert: publicProcedure
      .input(
        z.object({
          openings: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              fen: z.string(),
              ecoCode: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        return insertOpenings(input.openings);
      }),

    /**
     * Classify all puzzles by opening variations
     */
    classifyVariations: publicProcedure
      .mutation(async () => {
        return await classifyAllPuzzlesByVariation();
      }),

    /**
     * Get opening hierarchy (Opening -> Subset -> Variation)
     */
    getHierarchy: publicProcedure
      .query(async () => {
        return await getOpeningHierarchy();
      }),

    /**
     * Get puzzle count by opening hierarchy level
     */
    getPuzzleCount: publicProcedure
      .input(
        z.object({
          opening: z.string().optional(),
          subset: z.string().optional(),
          variation: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getPuzzleCountByOpeningHierarchy(
          input.opening,
          input.subset,
          input.variation
        );
      }),

    /**
     * Get puzzles by opening hierarchy level
     */
    getPuzzlesByHierarchy: publicProcedure
      .input(
        z.object({
          opening: z.string().optional(),
          subset: z.string().optional(),
          variation: z.string().optional(),
          count: z.number().default(50),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
        })
      )
      .query(async ({ input }) => {
        return await getPuzzlesByOpeningHierarchy(
          input.opening,
          input.subset,
          input.variation,
          input.count,
          input.minRating,
          input.maxRating
        );
      }),
  }),

  // ==================== TRAINING SETS ====================
  trainingSets: router({
    /**
     * Create a new training set
     */
    create: protectedProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          opening: z.string(),
          subset: z.string().optional(),
          variation: z.string().optional(),
          minRating: z.number().default(1000),
          maxRating: z.number().default(2000),
          puzzleCount: z.number().default(50),
          color: z.string().optional(),
          cycles: z.number().default(3),
        })
      )
      .mutation(async ({ input }) => {
        const setId = `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
          console.log(`[trainingSets.create] Fetching puzzles for hierarchy:`, {
            opening: input.opening,
            subset: input.subset,
            variation: input.variation,
          });
          
          const puzzleList = await getPuzzlesByOpeningHierarchy(
            input.opening,
            input.subset,
            input.variation,
            input.puzzleCount,
            input.minRating,
            input.maxRating
          );
          
          console.log(`[trainingSets.create] Found ${puzzleList.length} puzzles`);
          
          const puzzlesForSession = puzzleList.map(p => ({
            id: p.id,
            fen: p.fen,
            moves: p.moves,
            rating: p.rating,
            themes: p.themes,
            openingName: p.openingName,
          }));
          
          const result = await createTrainingSet({
            id: setId,
            userId: input.userId || null,
            deviceId: input.deviceId || null,
            openingName: input.opening,
            themes: JSON.stringify([input.opening]),
            minRating: input.minRating,
            maxRating: input.maxRating,
            puzzleCount: input.puzzleCount,
            targetCycles: input.cycles,
            puzzlesJson: JSON.stringify(puzzlesForSession),
          });
          
          console.log(`[trainingSets.create] Training set created with ID: ${result}`);
          return result;
        } catch (error) {
          console.error(`[trainingSets.create] Error:`, error);
          throw error;
        }
      }),

    /**
     * Get training set by ID
     */
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        return getTrainingSet(input.id);
      }),

    /**
     * Get training sets for user
     */
    getByUser: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        const sets = await getTrainingSetsByUser(input.userId || null, input.deviceId || null);
        if (sets.length === 0) return [];
        
        // Batch query stats for all sets in one query
        const setIds = sets.map((s: any) => s.id);
        const statsMap = await getPuzzleAttemptStatsForSets(setIds);
        
        // Enrich sets with stats from the map
        const enrichedSets = sets.map((set: any) => {
          const stats = statsMap[set.id] || {
            totalAttempts: 0,
            totalCorrect: 0,
            totalTimeMs: 0,
            accuracy: null,
          };
          return {
            ...set,
            attemptAccuracy: stats.accuracy,
            attemptTotalCorrect: stats.totalCorrect,
            attemptTotalAttempts: stats.totalAttempts,
            attemptTotalTimeMs: stats.totalTimeMs,
          };
        });
        return enrichedSets;
      }),

    /**
     * Update training set
     */
    update: publicProcedure
      .input(
        z.object({
          id: z.string(),
          name: z.string().optional(),
          description: z.string().optional(),
          isPublic: z.boolean().optional(),
          status: z.enum(["active", "paused", "completed"]).optional(),
          cyclesCompleted: z.number().optional(),
          currentPuzzleIndex: z.number().optional(),
          currentCycle: z.number().optional(),
          correctCount: z.number().optional(),
          bestAccuracy: z.string().optional(),
          totalAttempts: z.number().optional(),
          totalTimeMs: z.number().optional(),
          lastPlayedAt: z.date().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return updateTrainingSet(input.id, {
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
          status: input.status,
          cyclesCompleted: input.cyclesCompleted,
          currentPuzzleIndex: input.currentPuzzleIndex,
          currentCycle: input.currentCycle,
          correctCount: input.correctCount,
          bestAccuracy: input.bestAccuracy,
          totalAttempts: input.totalAttempts,
          totalTimeMs: input.totalTimeMs,
          lastPlayedAt: input.lastPlayedAt,
        });
      }),

    /**
     * Delete training set
     */
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        return deleteTrainingSet(input.id);
      }),

    fetchPuzzlesByOpening: publicProcedure
      .input(
        z.object({
          opening: z.string(),
          minRating: z.number().default(0),
          maxRating: z.number().default(3000),
          count: z.number().default(50),
          colorFilter: z.enum(['white', 'black', 'both']).default('both'),
        })
      )
      .mutation(async ({ input }) => {
        const { getPuzzlesByOpening } = await import('./puzzles');
        return getPuzzlesByOpening(
          input.opening,
          input.minRating,
          input.maxRating,
          input.count,
          input.colorFilter
        );
      }),
  }),

  // ==================== PUZZLE SESSION ====================
  puzzleSession: router({
    /**
     * Create a new puzzle session
     */
    create: publicProcedure
      .input(
        z.object({
          opening: z.string(),
          variation: z.string(),
          puzzleCount: z.number().default(50),
          minRating: z.number().default(0),
          maxRating: z.number().default(3000),
          targetCycles: z.number().default(3),
          colorFilter: z.enum(['white', 'black', 'both']).default('both'),
          deviceId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          const trainingSetId = nanoid();
          console.log('[puzzleSession.create] Fetching puzzles with:', {
            opening: input.opening,
            minRating: input.minRating,
            maxRating: input.maxRating,
            puzzleCount: input.puzzleCount,
            colorFilter: input.colorFilter,
          });
          const fetchedPuzzles = await getRandomPuzzlesByOpeningAndRating(
            input.opening,
            input.minRating,
            input.maxRating,
            input.puzzleCount,
            input.variation,
            input.colorFilter !== 'both' ? input.colorFilter : undefined
          );
          console.log('[puzzleSession.create] Fetched puzzles count:', fetchedPuzzles.length);
          const puzzlesJson = JSON.stringify(fetchedPuzzles.map(p => {
            let themes = [];
            if (typeof p.themes === 'string') {
              try {
                themes = JSON.parse(p.themes);
              } catch {
                themes = p.themes.split(/\s+/).filter((t: string) => t.length > 0);
              }
            } else if (Array.isArray(p.themes)) {
              themes = p.themes;
            }
            
            return {
              id: p.id,
              fen: p.fen,
              moves: typeof p.moves === 'string' ? p.moves.split(' ') : p.moves,
              rating: p.rating,
              themes,
              color: p.color,
              openingName: p.openingName,
            };
          }));
          const trainingSet = await createTrainingSet({
            id: trainingSetId,
            userId: ctx.user?.id || null,
            deviceId: input.deviceId || null,
            openingName: input.opening,
            openingFen: '',
            themes: JSON.stringify([]),
            minRating: input.minRating,
            maxRating: input.maxRating,
            puzzleCount: input.puzzleCount,
            targetCycles: input.targetCycles,
            colorFilter: input.colorFilter,
            puzzlesJson: puzzlesJson,
          });
          return {
            id: trainingSetId,
            puzzles: fetchedPuzzles,
          };
        } catch (error) {
          console.error('Error creating puzzle session:', error);
          throw error;
        }
      }),
  }),

  // ==================== CYCLES ====================
  cycles: router({
    /**
     * Create a cycle record
     */
    create: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          trainingSetId: z.string(),
          totalPuzzles: z.number(),
          correctCount: z.number(),
          totalTimeMs: z.number(),
          accuracy: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const { getOrCreatePlayer, updatePlayerStats } = await import('./players');
        const { invalidateLeaderboardCache } = await import('./leaderboard-optimized');
        const playerName = input.userId ? `Player-${input.userId}` : `Guest-${(input.deviceId || 'unknown').substring(0, 5)}`;
        const player = await getOrCreatePlayer(
          input.userId || null,
          input.deviceId || null,
          playerName
        );

        if (!player?.id) {
          throw new Error('Failed to create or retrieve player record');
        }

        const result = await createCycleRecord({
          userId: player.userId,
          deviceId: player.deviceId,
          trainingSetId: input.trainingSetId,
          cycleNumber: 1,
          totalPuzzles: input.totalPuzzles,
          correctCount: input.correctCount,
          totalTimeMs: input.totalTimeMs,
          accuracy: input.accuracy.toString(),
        });

        try {
          await updatePlayerStats(player.id);
          console.log(`[cycles.create] Updated player stats for player ${player.id}`);
        } catch (error) {
          console.warn('[cycles.create] Failed to update player stats:', error);
        }

        // CRITICAL: Invalidate leaderboard cache when cycle completes
        // This ensures the leaderboard updates in real-time when puzzles are solved
        invalidateLeaderboardCache();
        console.log('[cycles.create] Leaderboard cache invalidated');

        return result;
      }),

    /**
     * Get cycle history for user
     */
    getByUser: publicProcedure
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
     * Get cycle history for training set
     */
    getBySet: publicProcedure
      .input(z.object({ trainingSetId: z.string() }))
      .query(async ({ input }) => {
        return getCycleHistoryByTrainingSet(input.trainingSetId);
      }),
  }),

  // ==================== STATS ====================
  stats: router({
    /**
     * Get subscription history and churn metrics
     */
    getSubscriptionHistory: publicProcedure
      .input(z.object({}).nullish())
      .query(async () => {
        const { getSubscriptionHistory } = await import('./leaderboard-optimized');
        return await getSubscriptionHistory();
      }),

    /**
     * Get leaderboard
     */
    getLeaderboard: publicProcedure
      .input(
        z.object({
          limit: z.number().default(100),
          sortBy: z.enum(['accuracy', 'speed', 'rating']).default('accuracy'),
        }).nullish()
      )
      .query(async ({ input }) => {
        const { getTopPlayersByMetricOptimized, getLeaderboardSummary } = await import('./leaderboard-optimized');
        
        const limit = input?.limit ?? 50;
        const sortBy = (input?.sortBy ?? 'accuracy') as 'accuracy' | 'speed' | 'rating';
        
        // Get leaderboard entries
        const players = await getTopPlayersByMetricOptimized(limit, sortBy);
        
        // Get summary stats
        const summary = await getLeaderboardSummary();
        
        console.log('[stats.getLeaderboard] Returning', players.length, 'players and summary');
        
        return {
          players,
          summary,
        };
      }),

    /**
     * Get puzzle attempt stats
     */
    getPuzzleStats: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return getPuzzleAttemptStats(input.userId || null, input.deviceId || null);
      }),

    getSummary: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        }).nullish()
      )
      .query(async ({ input, ctx }) => {
        const userId = input?.userId || ctx.user?.id || null;
        const deviceId = input?.deviceId || null;
        const stats = await getPuzzleAttemptStats(userId, deviceId);
        const accuracy = stats.totalPuzzles > 0 ? Math.round((stats.totalCorrect / stats.totalPuzzles) * 100) : 0;
        return {
          totalPuzzles: stats.totalPuzzles || 0,
          totalCorrect: stats.totalCorrect || 0,
          accuracy: accuracy,
          totalCycles: 0,
          averageTimePerPuzzle: stats.totalPuzzles > 0 ? Math.round(stats.totalTimeMs / stats.totalPuzzles) : 0,
          totalTimeMs: stats.totalTimeMs || 0,
          completedCycles: 0,
          rating: 1200,
        };
      }),

    getUserStats: protectedProcedure
      .input(
        z.object({}).nullish()
      )
      .query(async ({ ctx }) => {
        const db = await getDb();
        const stats = await getPuzzleAttemptStats(ctx.user.id, null);
        const accuracy = stats.totalPuzzles > 0 ? Math.round((stats.totalCorrect / stats.totalPuzzles) * 100) : 0;
        const totalTimeMs = stats.totalTimeMs || 0;
        const totalPuzzles = stats.totalPuzzles || 0;
        const totalCorrect = stats.totalCorrect || 0;
        const totalIncorrect = totalPuzzles - totalCorrect;
        
        // Ensure player stats (including rating) are up to date
        let playerRating = 1200;
        let peakRating = 1200;
        if (db) {
          try {
            // First, trigger a stats refresh so rating is computed
            const { getOrCreatePlayer, updatePlayerStats } = await import('./players');
            const player = await getOrCreatePlayer(ctx.user.id, null, ctx.user.name);
            if (player?.id) {
              await updatePlayerStats(player.id);
            }
            // Now fetch the updated rating
            const rows = await db.execute(
              sql`SELECT rating FROM players WHERE userId = ${ctx.user.id} LIMIT 1`
            );
            if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0]) && rows[0].length > 0) {
              const row = rows[0][0];
              if (row?.rating) {
                playerRating = Number(row.rating);
                peakRating = playerRating; // Peak is tracked as highest ever seen
              }
            }
          } catch (error) {
            console.error('[getUserStats] Error fetching player rating:', error);
          }
        }

        // Compute cycle stats from cycle_history
        let totalCycles = 0;
        let fastestCycleTimeMs = 0;
        let cyclesToday = 0;
        if (db) {
          try {
            const cycleRows = await db.execute(
              sql`SELECT COUNT(*) as cnt, MIN(totalTimeMs) as fastest FROM cycle_history WHERE userId = ${ctx.user.id}`
            );
            const cr = Array.isArray(cycleRows) ? (Array.isArray(cycleRows[0]) ? cycleRows[0] : cycleRows) : [];
            if (cr[0]) {
              totalCycles = Number(cr[0].cnt || 0);
              fastestCycleTimeMs = Number(cr[0].fastest || 0);
            }
            // Cycles today
            const todayRows = await db.execute(
              sql`SELECT COUNT(*) as cnt FROM cycle_history WHERE userId = ${ctx.user.id} AND DATE(completedAt) = CURDATE()`
            );
            const tr = Array.isArray(todayRows) ? (Array.isArray(todayRows[0]) ? todayRows[0] : todayRows) : [];
            if (tr[0]) cyclesToday = Number(tr[0].cnt || 0);
          } catch (error) {
            console.error('[getUserStats] Error fetching cycle stats:', error);
          }
        }

        // Compute daily stats and streaks from training_sets
        let puzzlesToday = 0;
        let currentStreak = 0;
        let longestStreak = 0;
        let firstActivityDate: Date | null = null;
        if (db) {
          try {
            // Puzzles solved today
            const todayPuzzles = await db.execute(
              sql`SELECT COUNT(*) as cnt FROM puzzle_attempts pa
                  JOIN training_sets ts ON pa.trainingSetId = ts.id
                  WHERE ts.userId = ${ctx.user.id} AND DATE(pa.completedAt) = CURDATE()`
            );
            const tp = Array.isArray(todayPuzzles) ? (Array.isArray(todayPuzzles[0]) ? todayPuzzles[0] : todayPuzzles) : [];
            if (tp[0]) puzzlesToday = Number(tp[0].cnt || 0);

            // Get distinct active days for streak calculation
            const activeDays = await db.execute(
              sql`SELECT DISTINCT DATE(pa.completedAt) as activeDay FROM puzzle_attempts pa
                  JOIN training_sets ts ON pa.trainingSetId = ts.id
                  WHERE ts.userId = ${ctx.user.id}
                  ORDER BY activeDay DESC`
            );
            const days = Array.isArray(activeDays) ? (Array.isArray(activeDays[0]) ? activeDays[0] : activeDays) : [];
            if (days.length > 0) {
              firstActivityDate = new Date(days[days.length - 1].activeDay);
              // Calculate current streak (consecutive days ending today or yesterday)
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              let streak = 0;
              let maxStreak = 0;
              let tempStreak = 0;
              let expectedDate = new Date(today);
              // Check if today or yesterday has activity
              const firstDay = new Date(days[0].activeDay);
              firstDay.setHours(0, 0, 0, 0);
              const diffFromToday = Math.floor((today.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
              if (diffFromToday > 1) {
                // Last activity was more than 1 day ago, current streak is 0
                streak = 0;
              } else {
                expectedDate = new Date(firstDay);
                for (let i = 0; i < days.length; i++) {
                  const dayDate = new Date(days[i].activeDay);
                  dayDate.setHours(0, 0, 0, 0);
                  const diff = Math.floor((expectedDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
                  if (diff === 0) {
                    streak++;
                    expectedDate.setDate(expectedDate.getDate() - 1);
                  } else {
                    break;
                  }
                }
              }
              // Calculate longest streak
              tempStreak = 1;
              maxStreak = 1;
              for (let i = 1; i < days.length; i++) {
                const prev = new Date(days[i - 1].activeDay);
                const curr = new Date(days[i].activeDay);
                prev.setHours(0, 0, 0, 0);
                curr.setHours(0, 0, 0, 0);
                const diff = Math.floor((prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24));
                if (diff === 1) {
                  tempStreak++;
                  maxStreak = Math.max(maxStreak, tempStreak);
                } else {
                  tempStreak = 1;
                }
              }
              currentStreak = streak;
              longestStreak = Math.max(maxStreak, streak);
            }
          } catch (error) {
            console.error('[getUserStats] Error fetching daily stats:', error);
          }
        }

        // Compute opening stats
        let bestOpening = "N/A";
        let weakestOpening = "N/A";
        if (db) {
          try {
            const openingStats = await db.execute(
              sql`SELECT ts.openingName,
                    COUNT(*) as attempts,
                    SUM(pa.isCorrect) as correct
                  FROM puzzle_attempts pa
                  JOIN training_sets ts ON pa.trainingSetId = ts.id
                  WHERE ts.userId = ${ctx.user.id} AND ts.openingName IS NOT NULL
                  GROUP BY ts.openingName
                  HAVING attempts >= 3
                  ORDER BY (correct / attempts) DESC`
            );
            const os = Array.isArray(openingStats) ? (Array.isArray(openingStats[0]) ? openingStats[0] : openingStats) : [];
            if (os.length > 0) {
              bestOpening = os[0].openingName || "N/A";
              weakestOpening = os[os.length - 1].openingName || "N/A";
            }
          } catch (error) {
            console.error('[getUserStats] Error fetching opening stats:', error);
          }
        }

        // Compute time stats
        const totalTimeHours = totalTimeMs > 0 ? Math.floor(totalTimeMs / 3600000) : 0;
        const totalTimeMinutes = totalTimeMs > 0 ? Math.floor(totalTimeMs / 60000) : 0;
        const avgTimePerPuzzleMs = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles) : 0;
        const avgTimePerPuzzleStr = avgTimePerPuzzleMs > 0 ? (avgTimePerPuzzleMs / 1000).toFixed(1) + "s" : "0s";
        const studyTimeStr = totalTimeHours > 0 ? totalTimeHours + "h" : (totalTimeMinutes > 0 ? totalTimeMinutes + "m" : "0h");

        // Compute averages per day
        const daysSinceFirst = firstActivityDate ? Math.max(1, Math.ceil((Date.now() - firstActivityDate.getTime()) / (1000 * 60 * 60 * 24))) : 1;
        const avgPuzzlesPerDay = totalPuzzles > 0 ? Math.round(totalPuzzles / daysSinceFirst) : 0;
        const avgCyclesPerDay = totalCycles > 0 ? Math.round((totalCycles / daysSinceFirst) * 10) / 10 : 0;
        const avgPuzzlesPerCycle = totalCycles > 0 ? Math.round(totalPuzzles / totalCycles) : 0;
        const fastestCycleTime = fastestCycleTimeMs > 0 ? (fastestCycleTimeMs / 1000).toFixed(0) + "s" : "N/A";
        const consistency = totalPuzzles >= 5 ? Math.min(100, Math.round((currentStreak / Math.max(daysSinceFirst, 1)) * 100)) : 0;
        const ratingGain = playerRating - 1200;

        return {
          userId: ctx.user.id,
          totalPuzzles,
          totalCorrect,
          accuracy,
          totalCycles,
          averageTimePerPuzzle: avgTimePerPuzzleMs,
          totalTimeMs,
          rating: playerRating,
          peakRating,
          ratingGain,
          consistency,
          totalIncorrect,
          avgPuzzlesPerCycle,
          fastestCycleTime,
          studyTime: studyTimeStr,
          totalTimeHours: totalTimeHours + "h",
          avgTimePerPuzzle: avgTimePerPuzzleStr,
          totalTimeMinutes,
          currentStreak,
          longestStreak,
          puzzlesToday,
          cyclesToday,
          avgPuzzlesPerDay,
          avgCyclesPerDay,
          bestOpening,
          weakestOpening,
          lastActive: new Date(),
        };
      }),

    /**
     * Aggregate stats after cycle completion
     */
    aggregateAfterCycle: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Get puzzle attempts for the user/device
          const attempts = await getPuzzleAttemptsByUser(input.userId || null, input.deviceId || null);
          
          // Get cycle history
          const cycles = await getCycleHistoryByUser(input.userId || null, input.deviceId || null);
          
          if (attempts.length === 0 || cycles.length === 0) {
            return { success: false, message: 'No data to aggregate' };
          }

          // Calculate aggregated stats
          const totalPuzzles = attempts.length;
          const totalCorrect = attempts.filter((a: any) => a.isCorrect === 1).length;
          const totalTimeMs = attempts.reduce((sum: number, a: any) => sum + (a.timeMs || 0), 0);
          const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
          const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles) : 0;
          const totalCycles = cycles.length;
          const avgPuzzlesPerCycle = totalCycles > 0 ? Math.round(totalPuzzles / totalCycles) : 0;

          return {
            success: true,
            stats: {
              totalPuzzles,
              totalCorrect,
              accuracy,
              totalTimeMs,
              avgTimePerPuzzle,
              totalCycles,
              avgPuzzlesPerCycle,
            },
          };
        } catch (error) {
          console.error('[Stats] Error aggregating stats:', error);
          return { success: false, message: 'Failed to aggregate stats' };
        }
      }),
  }),

  // ==================== PREMIUM ====================
  premium: router({
    /**
     * Check if user is premium
     */
    isPremium: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        // TODO: Implement premium check from database
        return false;
      }),
  }),

  // ==================== PUZZLE ATTEMPTS ====================
  attempts: router({
    /**
     * Record puzzle attempt
     */
    record: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          trainingSetId: z.string(),
          puzzleId: z.string(),
          isCorrect: z.boolean(),
          timeMs: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await recordPuzzleAttempt({
          userId: input.userId || null,
          deviceId: input.deviceId || null,
          trainingSetId: input.trainingSetId,
          cycleNumber: 1,
          puzzleId: input.puzzleId,
          isCorrect: input.isCorrect ? 1 : 0,
          timeMs: input.timeMs,
        });
        // Update player stats in leaderboard after each attempt
        if (input.userId || input.deviceId) {
          try {
            const { getOrCreatePlayer, updatePlayerStats } = await import('./players');
            const player = await getOrCreatePlayer(
              input.userId || null,
              input.deviceId || null,
              null,
              null,
              0
            );
            if (player?.id) {
              await updatePlayerStats(player.id);
            }
          } catch (e) {
            console.warn('[record] Failed to update player stats:', e);
          }
        }
        return result;
      }),

    /**
     * Get attempts for training set
     */
    getBySet: publicProcedure
      .input(z.object({ trainingSetId: z.string() }))
      .query(async ({ input }) => {
        return getPuzzleAttemptsByTrainingSet(input.trainingSetId);
      }),
  }),

  // ==================== PROMO CODES ====================
  promo: router({
    /**
     * Validate a promo code (check if it exists, is active, has uses left)
     */
    validate: publicProcedure
      .input(z.object({ code: z.string().min(1) }))
      .query(async ({ input }) => {
        const promo = await getPromoCodeByCode(input.code);
        if (!promo) return { valid: false, error: "Invalid promo code" };
        if (!promo.isActive) return { valid: false, error: "This promo code is no longer active" };
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return { valid: false, error: "This promo code has expired" };
        if (promo.currentUses >= promo.maxUses) return { valid: false, error: "This promo code has reached its maximum uses" };
        return {
          valid: true,
          benefitType: promo.benefitType,
          discountPercent: promo.discountPercent,
          description: promo.description,
          remainingUses: promo.maxUses - promo.currentUses,
        };
      }),

    /**
     * Redeem a promo code
     */
    redeem: publicProcedure
      .input(z.object({
        code: z.string().min(1),
        deviceId: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const promo = await getPromoCodeByCode(input.code);
        if (!promo) return { success: false, error: "Invalid promo code" };

        const userId = ctx.user?.id || null;
        const deviceId = input.deviceId || null;

        if (!userId && !deviceId) {
          return { success: false, error: "Please sign in or provide a device ID to redeem" };
        }

        return redeemPromoCode(promo.id, userId, deviceId);
      }),

    /**
     * Get user's redeemed promo codes
     */
    myRedemptions: publicProcedure
      .input(z.object({ deviceId: z.string().optional() }))
      .query(async ({ input, ctx }) => {
        const userId = ctx.user?.id || null;
        const deviceId = input.deviceId || null;
        return getUserRedemptions(userId, deviceId);
      }),
  }),

  // ==================== ONLINE SESSION TRACKING ====================
  session: router({
    /**
     * Track user session start or update
     */
    track: publicProcedure
      .input(z.object({
        playerId: z.number(),
        userId: z.number().nullable(),
        deviceId: z.string().nullable(),
        sessionId: z.string().default(() => `session_${Date.now()}`),
      }))
      .mutation(async ({ input }) => {
        return createOrUpdateOnlineSession(
          input.playerId,
          input.userId,
          input.deviceId,
          input.sessionId
        );
      }),

    /**
     * Send heartbeat to keep session alive
     */
    heartbeat: publicProcedure
      .input(z.object({
        playerId: z.number(),
      }))
      .mutation(async ({ input }) => {
        return updateSessionHeartbeat(input.playerId);
      }),

    /**
     * End user session
     */
    end: publicProcedure
      .input(z.object({ playerId: z.number() }))
      .mutation(async ({ input }) => {
        return endOnlineSession(input.playerId);
      }),

    /**
     * Get current online count
     */
    getOnlineCount: publicProcedure
      .query(async () => {
        // Return mock online count for realistic UI display
        // Simulates 127 base users with natural fluctuations
        return getMockOnlineCount();
      }),

    /**
     * Track user online status
     */
    trackUserOnline: publicProcedure
      .input(z.object({
        userId: z.number().optional(),
        userName: z.string().optional(),
        sessionId: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Just acknowledge the tracking - no-op for now
        return { success: true };
      }),

    /**
     * Get total player count
     */
    getTotalPlayerCount: publicProcedure
      .query(async () => {
        // Return a mock total player count
        return { totalPlayers: 4500, todayActive: 502 };
      }),
  }),

  // ==================== PAYMENT ====================
  payment: router({
    /**
     * Create a checkout session
     */
    createCheckout: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          email: z.string().email(),
          promoCode: z.string().optional(),
          recaptchaToken: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createCheckoutSession } = await import("./_core/payment");
        const { verifyRecaptchaToken, detectSuspiciousActivity, shouldRequireCaptchaChallenge } = await import("./_core/recaptcha");
        const origin = ctx.req?.headers.origin || "https://openpecker.com";
        
        if (input.recaptchaToken) {
          try {
            const recaptchaResult = await verifyRecaptchaToken(input.recaptchaToken);
            if (!recaptchaResult.success) {
              throw new Error('reCAPTCHA verification failed');
            }
            const suspiciousFlags = detectSuspiciousActivity(recaptchaResult.score, {});
            const requiresChallenge = shouldRequireCaptchaChallenge(recaptchaResult.score, suspiciousFlags);
            if (requiresChallenge) {
              throw new Error('Suspicious activity detected');
            }
          } catch (error) {
            console.error('[CHECKOUT] reCAPTCHA error:', error);
            throw error;
          }
        }
        
        return createCheckoutSession(
          input.userId || ctx.user?.id || 0,
          "price_premium",
          input.email,
          origin,
          input.promoCode
        );
      }),

    /**
     * Handle payment success
     */
    handleSuccess: publicProcedure
      .input(
        z.object({
          userId: z.number(),
          sessionId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const { handlePaymentSuccess } = await import("./_core/payment");
        await handlePaymentSuccess(input.userId);
        return { success: true };
      }),
   }),
  puzzleVariations: puzzleVariationsRouter,
});
export type AppRouter = typeof appRouter;
