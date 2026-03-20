import { z } from 'zod';
import { publicProcedure } from './_core/trpc';
import { getOnlineCount, getTotalPlayerCount, getLeaderboardPlayers } from './players';

/**
 * New leaderboard router using unified players table
 * Replaces the old fragmented approach
 */

export const leaderboardRouter = {
  getLeaderboard: publicProcedure
    .input(
      z.object({
        limit: z.number().max(1000).default(500),
        sortBy: z.enum(['accuracy', 'speed', 'rating']).default('accuracy'),
      })
    )
    .query(async ({ input }) => {
      try {
        console.log('[LEADERBOARD] Fetching leaderboard with sortBy:', input.sortBy);

        // Get online count (currently active players)
        const onlineCount = await getOnlineCount();
        console.log('[LEADERBOARD] Online count:', onlineCount);

        // Get total player count
        const totalPlayers = await getTotalPlayerCount();
        console.log('[LEADERBOARD] Total players:', totalPlayers);

        // Get leaderboard entries
        const players = await getLeaderboardPlayers(input.limit, input.sortBy);
        console.log('[LEADERBOARD] Leaderboard entries count:', players.length);

        // Transform to leaderboard format
        const entries = players.map((player: any, index: number) => {
          const totalPuzzles = Number(player.totalPuzzles || 0);
          const totalCorrect = Number(player.totalCorrect || 0);
          const totalTimeMs = Number(player.totalTimeMs || 0);
          const completedCycles = Number(player.completedCycles || 0);

          const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
          const speed = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
          const rating = Number(player.rating || 1200);

          return {
            rank: index + 1,
            id: player.id,
            userId: player.userId,
            deviceId: player.deviceId,
            name: player.name,
            email: player.email,
            type: player.type,
            isPremium: Number(player.isPremium) === 1,
            accuracy,
            speed,
            rating,
            totalPuzzles,
            totalCorrect,
            completedCycles,
            totalTimeMin: Math.round(totalTimeMs / 1000 / 60),
            hasActivity: totalPuzzles > 0 || completedCycles > 0,
          };
        });

        console.log('[LEADERBOARD] Returning', entries.length, 'entries with online:', onlineCount, 'total:', totalPlayers);

        return {
          entries,
          onlineCount,
          totalPlayers,
        };
      } catch (error) {
        console.error('[LEADERBOARD ERROR]', error);
        console.error('[LEADERBOARD ERROR] Stack:', (error as any)?.stack);
        return { entries: [], onlineCount: 0, totalPlayers: 0 };
      }
    }),

  getOnlineCount: publicProcedure.query(async () => {
    return await getOnlineCount();
  }),

  getTotalPlayerCount: publicProcedure.query(async () => {
    return await getTotalPlayerCount();
  }),
};
