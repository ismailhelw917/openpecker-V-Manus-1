import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getGlobalSettings, updateGlobalSettings, getUserAnalytics, getOnlineCount, getTotalPlayerCount } from "../db";
import { classifyNullPuzzles, getPuzzleClassificationStats } from "../classify-puzzles-db";
// Counter API removed - using database only
import { z } from "zod";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  getGlobalSettings: publicProcedure.query(async () => {
    const settings = await getGlobalSettings();
    return settings || { id: 1, showGiftPremiumBanner: 1, giftPremiumMaxUsers: 100 };
  }),

  updateGlobalSettings: adminProcedure
    .input(
      z.object({
        showGiftPremiumBanner: z.number().optional(),
        giftPremiumMaxUsers: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await updateGlobalSettings(input);
      return {
        success: !!result,
      };
    }),

  // Puzzle classification procedures
  classifyPuzzles: adminProcedure
    .input(
      z.object({
        batchSize: z.number().default(1000),
      })
    )
    .mutation(async ({ input }) => {
      const classified = await classifyNullPuzzles(input.batchSize);
      return {
        success: true,
        classified,
      };
    }),

  getPuzzleStats: publicProcedure.query(async () => {
    const stats = await getPuzzleClassificationStats();
    return stats;
  }),

  getUserAnalytics: publicProcedure.query(async () => {
    const analytics = await getUserAnalytics();
    return analytics;
  }),

  /**
   * Get online user count
   */
  getOnlineCount: publicProcedure.query(async () => {
    const count = await getOnlineCount();
    return { onlineCount: count };
  }),

  /**
   * Get total player count
   */
  getTotalPlayerCount: publicProcedure.query(async () => {
    const count = await getTotalPlayerCount();
    return { totalPlayers: count };
  }),

  /**
   * Track user online status and daily visit
   */
  trackUserOnline: publicProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        userName: z.string().optional(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Tracking now uses database only
      return { success: true };
    }),
});
