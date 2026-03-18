import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getGlobalSettings, updateGlobalSettings } from "../db";
import { classifyNullPuzzles, getPuzzleClassificationStats } from "../classify-puzzles-db";
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
});
