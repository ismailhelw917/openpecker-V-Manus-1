import { publicProcedure, protectedProcedure, router } from './_core/trpc';
import { z } from 'zod';
import {
  validateStatsData,
  validateSetsData,
  validateLeaderboardData,
  repairStatsData,
  repairLeaderboardData,
  checkDataConsistency,
} from './data-validation';

export const dataValidationRouter = router({
  // Validate stats data
  validateStats: protectedProcedure
    .input(z.object({
      userId: z.number(),
      stats: z.any(),
    }))
    .query(async ({ input }) => {
      return await validateStatsData(input.userId, input.stats);
    }),

  // Validate sets data
  validateSets: protectedProcedure
    .input(z.object({
      userId: z.number(),
      sets: z.array(z.any()),
    }))
    .query(async ({ input }) => {
      return await validateSetsData(input.userId, input.sets);
    }),

  // Validate leaderboard data
  validateLeaderboard: publicProcedure
    .input(z.object({
      players: z.array(z.any()),
    }))
    .query(async ({ input }) => {
      return await validateLeaderboardData(input.players);
    }),

  // Repair stats data
  repairStats: protectedProcedure
    .input(z.object({
      userId: z.number(),
      stats: z.any(),
    }))
    .mutation(async ({ input }) => {
      return await repairStatsData(input.userId, input.stats);
    }),

  // Repair leaderboard data
  repairLeaderboard: publicProcedure
    .input(z.object({
      players: z.array(z.any()),
    }))
    .mutation(async ({ input }) => {
      return await repairLeaderboardData(input.players);
    }),

  // Check overall data consistency
  checkConsistency: publicProcedure
    .query(async () => {
      return await checkDataConsistency();
    }),
});
