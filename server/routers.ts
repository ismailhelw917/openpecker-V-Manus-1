import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import bcrypt from "bcrypt";
import { sdk } from "./_core/sdk";
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
} from "./db";
import {
  getOrCreateAnonymousUser,
  linkDeviceToUser,
  getUserByDeviceId,
  getAllUsers,
  getUserCount,
} from "./anonymous-users";

const BCRYPT_ROUNDS = 10;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Fetch puzzles from local database only
 * Supports filtering by theme, rating range, and color
 */
async function fetchPuzzlesFromDatabase(
  theme: string,
  minRating: number,
  maxRating: number,
  count: number,
  color?: string
) {
  console.log("[PUZZLE FETCH] Using local database");
  return getPuzzlesByThemeAndRating(theme, minRating, maxRating, count, color);
}

/**
 * Fetch openings from local database only
 */
async function fetchOpeningsData() {
  console.log("[OPENINGS FETCH] Using local database");
  return getAllOpenings();
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    getOrCreateAnonymous: publicProcedure
      .input(z.object({ deviceId: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const user = await getOrCreateAnonymousUser(input.deviceId);
          return {
            success: true,
            user,
          };
        } catch (error) {
          console.error("[GET OR CREATE ANONYMOUS] Error:", error);
          return {
            success: false,
            error: "Failed to create anonymous user",
          };
        }
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    giftPremium: protectedProcedure.mutation(async ({ ctx }) => {
      try {
        // Update user to premium
        await upsertUser({
          ...ctx.user,
          isPremium: 1,
        });
        return {
          success: true,
          message: "Premium access granted!",
        };
      } catch (error) {
        console.error("[Gift Premium] Error:", error);
        return {
          success: false,
          error: "Failed to grant premium access",
        };
      }
    }),
    checkGiftEligibility: publicProcedure.query(async () => {
      try {
        // Count total users in database
        const totalUsers = await countTotalUsers();
        
        // Return whether gift is still active (less than 100 users)
        return {
          isEligible: totalUsers < 100,
          totalUsers: totalUsers,
        };
      } catch (error) {
        console.error("[Check Gift Eligibility] Error:", error);
        return {
          isEligible: false,
          totalUsers: 0,
        };
      }
    }),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2, "Name must be at least 2 characters"),
          email: z.string().email("Invalid email address"),
          password: z.string().min(8, "Password must be at least 8 characters"),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Check if user with this email already exists
          const existingUser = await getUserByEmail(input.email);
          if (existingUser) {
            return {
              success: false,
              error: "Email already registered",
            };
          }

          // Hash password
          const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

          // Create new user with unique openId
          const openId = `local_${nanoid()}`;
          
          // Check if this is within first 100 users
          const totalUsers = await countTotalUsers();
          const isPremium = totalUsers < 100 ? 1 : 0;
          
          const newUser = {
            openId,
            name: input.name,
            email: input.email,
            passwordHash,
            loginMethod: "email",
            role: "user" as const,
            isPremium,
          };

          await upsertUser(newUser);

          return {
            success: true,
            message: "Account created successfully. Please sign in.",
            isPremium: isPremium === 1,
          };
        } catch (error) {
          console.error("[Registration] Error:", error);
          return {
            success: false,
            error: "Registration failed. Please try again.",
          };
        }
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email("Invalid email address"),
          password: z.string().min(1, "Password required"),
          rememberMe: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          // Find user by email
          const user = await getUserByEmail(input.email);
          if (!user || !user.passwordHash) {
            return {
              success: false,
              error: "Invalid email or password",
            };
          }

          // Verify password
          const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
          if (!passwordMatch) {
            return {
              success: false,
              error: "Invalid email or password",
            };
          }

          // Create session token
          const sessionDuration = input.rememberMe ? SESSION_DURATION_MS : 24 * 60 * 60 * 1000;
          const sessionToken = await sdk.createSessionToken(user.openId, {
            expiresInMs: sessionDuration,
            name: user.name || user.email || "User",
          });

          // Set session cookie
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, {
            ...cookieOptions,
            maxAge: sessionDuration,
          });

          return {
            success: true,
            message: "Logged in successfully",
          };
        } catch (error) {
          console.error("[Login] Error:", error);
          return {
            success: false,
            error: "Login failed. Please try again.",
          };
        }
      }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
          name: z.string().optional(),
          email: z.string().email().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          if (ctx.user?.id !== input.userId) {
            return {
              success: false,
              error: "Unauthorized",
            };
          }

          const updates: any = {};
          if (input.name) updates.name = input.name;
          if (input.email) updates.email = input.email;

          await upsertUser({
            openId: ctx.user.openId,
            ...updates,
          });

          return {
            success: true,
            message: "Profile updated successfully",
          };
        } catch (error) {
          console.error("[Update Profile] Error:", error);
          return {
            success: false,
            error: "Failed to update profile",
          };
        }
      }),
    changePassword: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
          currentPassword: z.string().min(1, "Current password required"),
          newPassword: z.string().min(8, "Password must be at least 8 characters"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        try {
          if (ctx.user?.id !== input.userId) {
            return {
              success: false,
              error: "Unauthorized",
            };
          }

          // Get user with password hash
          const user = await getUserByOpenId(ctx.user.openId);
          if (!user || !user.passwordHash) {
            return {
              success: false,
              error: "User not found or password not set",
            };
          }

          // Verify current password
          const passwordMatch = await bcrypt.compare(input.currentPassword, user.passwordHash);
          if (!passwordMatch) {
            return {
              success: false,
              error: "Current password is incorrect",
            };
          }

          // Hash new password
          const newPasswordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);

          // Update password
          await updateUserPasswordHash(user.id, newPasswordHash);

          return {
            success: true,
            message: "Password changed successfully",
          };
        } catch (error) {
          console.error("[Change Password] Error:", error);
          return {
            success: false,
            error: "Failed to change password",
          };
        }
      }),
  }),

  // Puzzle-related procedures
  puzzles: router({
    /**
     * Fetch puzzles by theme and rating range from local database
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
          const puzzles = await fetchPuzzlesFromDatabase(
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
              openingName: z.string().optional(),
              openingVariation: z.string().optional(),
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
                openingName: p.openingName,
                openingVariation: p.openingVariation,
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
      .mutation(async ({ input }) => {
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
                openingName: p.openingName,
                openingVariation: p.openingVariation,
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
        // Fetch per-set puzzle attempt stats for real-time data
        const setsWithStats = await Promise.all(
          sets.map(async (set: any) => {
            const themes = typeof set.themes === 'string' ? JSON.parse(set.themes) : set.themes || [];
            const puzzlesJson = typeof set.puzzlesJson === 'string' ? JSON.parse(set.puzzlesJson) : set.puzzlesJson || [];
            
            // Get real-time attempt stats for this set
            const attempts = await getPuzzleAttemptsByTrainingSet(set.id);
            const attemptCount = attempts.length;
            const correctCount = attempts.filter((a: any) => a.isCorrect).length;
            const realTimeAccuracy = attemptCount > 0 ? Math.round((correctCount / attemptCount) * 100) : null;
            const totalTimeMs = attempts.reduce((sum: number, a: any) => sum + (a.timeMs || 0), 0);
            const lastAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
            
            return {
              id: set.id,
              userId: set.userId,
              deviceId: set.deviceId,
              openingName: set.openingName || 'Custom Set',
              openingFen: set.openingFen,
              themes: themes,
              minRating: set.minRating,
              maxRating: set.maxRating,
              puzzleCount: set.puzzleCount || puzzlesJson.length,
              targetCycles: set.targetCycles,
              colorFilter: set.colorFilter,
              puzzlesJson: puzzlesJson,
              status: set.status,
              cyclesCompleted: set.cyclesCompleted || 0,
              bestAccuracy: realTimeAccuracy ?? set.bestAccuracy,
              lastPlayedAt: lastAttempt?.completedAt || set.lastPlayedAt,
              totalAttempts: attemptCount || set.totalAttempts || 0,
              totalTimeMs: totalTimeMs,
              createdAt: set.createdAt,
              updatedAt: set.updatedAt,
            };
          })
        );
        return setsWithStats;
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
          // Get real-time stats from individual puzzle attempts (not just completed cycles)
          const attemptStats = await getPuzzleAttemptStats(input.userId || null, input.deviceId || null);
          
          // Also get completed cycles count
          const cycles = await getCycleHistoryByUser(input.userId || null, input.deviceId || null);
          const completedCycles = cycles.length;

          const { totalPuzzles, totalCorrect, totalTimeMs } = attemptStats;
          const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;

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

    getUserStats: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.user) return null;
        const cycles = await getCycleHistoryByUser(ctx.user.id, null);
        
        // Get real-time stats from individual puzzle attempts
        const attemptStats = await getPuzzleAttemptStats(ctx.user.id, null);
        
        // Use puzzle attempts for real-time data, fall back to cycles if no attempts
        const totalPuzzles = attemptStats.totalPuzzles > 0 ? attemptStats.totalPuzzles : cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
        const totalCorrect = attemptStats.totalCorrect > 0 ? attemptStats.totalCorrect : cycles.reduce((sum, c) => sum + c.correctCount, 0);
        
        if (totalPuzzles === 0) {
          return {
            rating: 1200,
            peakRating: 1200,
            accuracy: 0,
            winRate: 0,
            lossRate: 0,
            totalPuzzles: 0,
            totalCycles: 0,
            avgTimePerPuzzle: '0s',
            currentStreak: 0,
            longestStreak: 0,
            totalTimeHours: '0h',
            puzzlesToday: 0,
            cyclesToday: 0,
            avgPuzzlesPerDay: 0,
            avgCyclesPerDay: 0,
            ratingGain: 0,
            bestOpening: 'N/A',
            weakestOpening: 'N/A',
            studyTime: '0h 0m',
            consistency: 0,
          };
        }
        const accuracy = totalPuzzles > 0 ? (totalCorrect / totalPuzzles) * 100 : 0;
        const completedCycles = cycles.length;
        const totalTimeMs = attemptStats.totalTimeMs > 0 ? attemptStats.totalTimeMs : cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
        const totalTimeHours = totalTimeMs / 1000 / 60 / 60;
        const totalTimeMinutes = (totalTimeMs / 1000 / 60) % 60;
        const winRate = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
        const lossRate = 100 - winRate;
        const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
        
        // Calculate today's stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaysCycles = cycles.filter(c => new Date(c.completedAt || new Date()).getTime() >= today.getTime());
        const puzzlesToday = todaysCycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
        const cyclesToday = todaysCycles.length;
        
        // Calculate averages
        const daysActive = Math.max(1, completedCycles);
        const avgPuzzlesPerDay = Math.round(totalPuzzles / daysActive);
        const avgCyclesPerDay = (completedCycles / daysActive).toFixed(1);
        
        // Calculate streaks (simplified)
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        for (const cycle of cycles) {
          const cycleAccuracy = typeof cycle.accuracy === 'string' ? parseFloat(cycle.accuracy) : cycle.accuracy || 0;
          if (cycleAccuracy >= 70) {
            tempStreak++;
            longestStreak = Math.max(longestStreak, tempStreak);
          } else {
            tempStreak = 0;
          }
        }
        currentStreak = tempStreak;
        
        // Calculate rating (simple ELO-like calculation)
        const baseRating = 1200;
        const ratingGain = Math.round(winRate * 2);
        const rating = baseRating + ratingGain;
        const peakRating = rating + Math.round(ratingGain * 0.3);
        
        // Calculate consistency
        const accuracies = cycles.map(c => c.totalPuzzles > 0 ? (c.correctCount / c.totalPuzzles) * 100 : 0);
        const avgAccuracy = accuracies.length > 0 ? accuracies.reduce((a, b) => a + b) / accuracies.length : 0;
        const variance = accuracies.length > 0 ? accuracies.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracies.length : 0;
        const consistency = Math.max(0, Math.round(100 - Math.sqrt(variance)));
        
        return {
          rating,
          peakRating,
          accuracy: Math.round(accuracy),
          winRate,
          lossRate,
          totalPuzzles,
          totalCycles: completedCycles,
          avgTimePerPuzzle: avgTimePerPuzzle + 's',
          currentStreak,
          longestStreak,
          totalTimeHours: Math.round(totalTimeHours * 10) / 10 + 'h',
          puzzlesToday,
          cyclesToday,
          avgPuzzlesPerDay,
          avgCyclesPerDay: parseFloat(avgCyclesPerDay),
          ratingGain,
          bestOpening: 'Sicilian',
          weakestOpening: 'Ruy Lopez',
          studyTime: Math.floor(totalTimeHours) + 'h ' + Math.floor(totalTimeMinutes) + 'm',
          consistency,
        };
      } catch (error) {
        console.error("[GET USER STATS ERROR]", error);
        return null;
      }
    }),

    /**
     * Get leaderboard with top users ranked by accuracy and speed
     */
    getLeaderboard: publicProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          sortBy: z.enum(["accuracy", "speed", "rating"]).default("accuracy"),
        })
      )
      .query(async ({ input }) => {
        try {
          const registeredUsers = await getAllUsers(input.limit * 2); // Fetch more to account for filtering

          // Calculate stats for each user using puzzle_attempts for real-time data
          const leaderboardData = await Promise.all(
            registeredUsers.map(async (user: any) => {
              // Try puzzle attempts first for real-time data
              const attemptStats = await getPuzzleAttemptStats(user.id, null);
              const cycles = await getCycleHistoryByUser(user.id, null);
              
              // Use attempt stats if available, fall back to cycle stats
              const totalPuzzles = attemptStats.totalPuzzles > 0 ? attemptStats.totalPuzzles : cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
              const totalCorrect = attemptStats.totalCorrect > 0 ? attemptStats.totalCorrect : cycles.reduce((sum, c) => sum + c.correctCount, 0);
              const totalTimeMs = attemptStats.totalTimeMs > 0 ? attemptStats.totalTimeMs : cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
              
              const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
              const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
              const baseRating = 1200;
              const ratingGain = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 200) : 0;
              const rating = baseRating + ratingGain;

              return {
                id: user.id,
                name: user.name || "Anonymous",
                isPremium: user.isPremium === 1,
                accuracy,
                speed: avgTimePerPuzzle,
                rating,
                totalPuzzles,
                completedCycles: cycles.length,
              };
            })
          );

          // Sort by selected metric
          const sorted = leaderboardData.sort((a: any, b: any) => {
            if (input.sortBy === "accuracy") {
              return b.accuracy - a.accuracy;
            } else if (input.sortBy === "speed") {
              return a.speed - b.speed;
            } else {
              return b.rating - a.rating;
            }
          });

          // Return top N users with rank
          return sorted.slice(0, input.limit).map((user: any, index: number) => ({
            ...user,
            rank: index + 1,
          }));
        } catch (error) {
          console.error("[GET LEADERBOARD ERROR]", error);
          return [];
        }
    }),
  }),

  // Premium features
  premium: router({
    /**
     * Get user premium status
     */
    getStatus: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.user) {
          return {
            isPremium: false,
          };
        }

        return {
          isPremium: ctx.user.isPremium === 1,
          userId: ctx.user.id,
        };
      } catch (error) {
        console.error("[GET PREMIUM STATUS ERROR]", error);
        return {
          isPremium: false,
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
});

export type AppRouter = typeof appRouter;
