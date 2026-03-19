import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { sdk } from "./_core/sdk";
import { trackUserLogin, trackUserRegistration, trackLeaderboardPlayer, trackDailyVisitor, trackOnlineUser, trackPuzzleByOpening } from "./_core/counter-api";
import {
  getDb,
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
      const allOpenings = await getAllOpenings();
      return allOpenings.map((opening) => opening.name).filter((name) => name);
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
  }),

  // ==================== TRAINING SETS ====================
  trainingSets: router({
    /**
     * Create a new training set
     */
    create: publicProcedure
      .input(
        z.object({
          userId: z.number().optional(),
          deviceId: z.string().optional(),
          name: z.string(),
          description: z.string().optional(),
          opening: z.string(),
          minRating: z.number().default(0),
          maxRating: z.number().default(3000),
          puzzleCount: z.number().default(50),
          isPublic: z.boolean().default(false),
        })
      )
      .mutation(async ({ input }) => {
        return createTrainingSet({
          userId: input.userId || null,
          deviceId: input.deviceId || null,
          name: input.name,
          description: input.description || null,
          opening: input.opening,
          minRating: input.minRating,
          maxRating: input.maxRating,
          puzzleCount: input.puzzleCount,
          isPublic: input.isPublic,
        });
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
      .query(async ({ input }) => {
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
          averageSpeed: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        return createCycleRecord({
          userId: input.userId || null,
          deviceId: input.deviceId || null,
          trainingSetId: input.trainingSetId,
          totalPuzzles: input.totalPuzzles,
          correctCount: input.correctCount,
          totalTimeMs: input.totalTimeMs,
          accuracy: input.accuracy,
          averageSpeed: input.averageSpeed,
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
          puzzleId: input.puzzleId,
          isCorrect: input.isCorrect,
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
});

export type AppRouter = typeof appRouter;
