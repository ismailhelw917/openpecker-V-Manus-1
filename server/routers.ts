import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { puzzleVariationsRouter } from "./puzzle-variations-router";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { sdk } from "./_core/sdk";
import { trackUserLogin, trackUserRegistration, trackLeaderboardPlayer, trackDailyVisitor, trackOnlineUser, trackPuzzleByOpening } from "./_core/counter-api";
import {
  getDb,
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
          const tokenResponse = await sdk.oauth.exchangeCode({
            code,
            redirectUri: `${redirectOrigin}/api/oauth/callback`,
          });

          if (!tokenResponse.success) {
            return { success: false, error: tokenResponse.error };
          }

          // Get user info
          const userInfo = await sdk.oauth.getUserInfo(tokenResponse.accessToken);
          if (!userInfo.success) {
            return { success: false, error: "Failed to get user info" };
          }

          // Upsert user in database
          const user = await upsertUser({
            openId: userInfo.openId,
            name: userInfo.name,
            email: userInfo.email,
          });

          // Track user login with Counter API (record name for leaderboard)
          if (user && user.id && user.name) {
            await trackUserLogin(user.id, user.name);
            // Also update player name in players table for leaderboard display
            if (user.id) {
              await updatePlayerName(user.id, user.name);
            }
          }

          // Track registration if this is a new user
          if (user && user.id && user.name && userInfo.email) {
            await trackUserRegistration(user.id, user.name, userInfo.email);
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
        return getTrainingSetsByUser(input.userId || null, input.deviceId || null);
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
        })
      )
      .mutation(async ({ input }) => {
        return updateTrainingSet(input.id, {
          name: input.name,
          description: input.description,
          isPublic: input.isPublic,
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
            puzzlesJson: JSON.stringify([]),
          });

          return {
            id: trainingSetId,
            ...trainingSet,
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
        return createCycleRecord({
          userId: input.userId || null,
          deviceId: input.deviceId || null,
          trainingSetId: input.trainingSetId,
          cycleNumber: 1,
          totalPuzzles: input.totalPuzzles,
          correctCount: input.correctCount,
          totalTimeMs: input.totalTimeMs,
          accuracy: input.accuracy.toString(),
        });
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
     * Get leaderboard
     */
    getLeaderboard: publicProcedure
      .input(
        z.object({
          limit: z.number().default(500),
          sortBy: z.enum(['accuracy', 'speed', 'rating']).default('accuracy'),
        }).nullish()
      )
      .query(async ({ input }) => {
        const limit = input?.limit ?? 500;
        const sortBy = (input?.sortBy ?? 'accuracy') as 'accuracy' | 'speed' | 'rating';
        const entries = await getLeaderboardPlayers(limit, sortBy);
        const onlineCount = await getOnlineCountByPageActivity(5);
        const totalCount = await getTotalPlayerCount();

        return {
          entries: entries.map((e: any, index: number) => ({
            ...e,
            hasActivity: e.totalPuzzles > 0,
            rank: index + 1,
          })),
          onlineCount,
          totalCount,
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
        const stats = await getPuzzleAttemptStats(ctx.user.id, null);
        const accuracy = stats.totalPuzzles > 0 ? Math.round((stats.totalCorrect / stats.totalPuzzles) * 100) : 0;
        return {
          userId: ctx.user.id,
          totalPuzzles: stats.totalPuzzles || 0,
          totalCorrect: stats.totalCorrect || 0,
          accuracy: accuracy,
          totalCycles: 0,
          averageTimePerPuzzle: stats.totalPuzzles > 0 ? Math.round(stats.totalTimeMs / stats.totalPuzzles) : 0,
          totalTimeMs: stats.totalTimeMs || 0,
          rating: 1200,
          peakRating: 1200,
          winRate: 0,
          ratingGain: 0,
          consistency: 0,
          totalIncorrect: (stats.totalPuzzles || 0) - (stats.totalCorrect || 0),
          avgPuzzlesPerCycle: 0,
          fastestCycleTime: "N/A",
          studyTime: "0h",
          totalTimeHours: "0h",
          avgTimePerPuzzle: "0s",
          totalTimeMinutes: 0,
          currentStreak: 0,
          longestStreak: 0,
          puzzlesToday: 0,
          cyclesToday: 0,
          avgPuzzlesPerDay: 0,
          avgCyclesPerDay: 0,
          bestOpening: "N/A",
          weakestOpening: "N/A",
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
        return recordPuzzleAttempt({
          userId: input.userId || null,
          deviceId: input.deviceId || null,
          trainingSetId: input.trainingSetId,
          cycleNumber: 1,
          puzzleId: input.puzzleId,
          isCorrect: input.isCorrect ? 1 : 0,
          timeMs: input.timeMs,
        });
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
        return getOnlineSessionCount();
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
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { createCheckoutSession } = await import("./_core/payment");
        const origin = ctx.req?.headers.origin || "https://openpecker.com";
        
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
