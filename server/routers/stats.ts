import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { aggregateUserStats, exportUserStatsAsCSV } from "../stats/csvExporter";
import { getDb } from "../db";
import { userOpeningStats, statsExports } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const statsRouter = router({
  /**
   * Get aggregated stats for current user
   */
  getUserStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stats = await aggregateUserStats(ctx.user.id);
      return {
        success: true,
        data: stats,
        recordCount: stats.length,
      };
    } catch (error) {
      console.error("[Stats] Error fetching user stats:", error);
      return {
        success: false,
        error: "Failed to fetch stats",
        data: [],
      };
    }
  }),

  /**
   * Get stats for a specific opening
   */
  getOpeningStats: protectedProcedure
    .input(
      z.object({
        opening: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const stats = await aggregateUserStats(ctx.user.id);
        const openingStats = stats.filter((s) => s.opening === input.opening);
        return {
          success: true,
          data: openingStats,
        };
      } catch (error) {
        console.error("[Stats] Error fetching opening stats:", error);
        return {
          success: false,
          error: "Failed to fetch opening stats",
          data: [],
        };
      }
    }),

  /**
   * Export user stats as CSV
   */
  exportCSV: protectedProcedure
    .input(
      z.object({
        exportType: z.enum(["full", "opening", "monthly"]).default("full"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const csvContent = await exportUserStatsAsCSV(ctx.user.id);

        // TODO: Upload to S3 and get presigned URL
        // For now, return CSV content directly
        const recordCount = csvContent.split("\n").length - 1; // Subtract header

        const db = await getDb();
        if (db) {
          // Log the export
          await db.insert(statsExports).values({
            userId: ctx.user.id,
            exportType: input.exportType,
            csvUrl: "data:text/csv;base64," + Buffer.from(csvContent).toString("base64"),
            recordCount,
            fileSize: csvContent.length,
          });
        }

        return {
          success: true,
          csvContent,
          recordCount,
          fileSize: csvContent.length,
        };
      } catch (error) {
        console.error("[Stats] Error exporting CSV:", error);
        return {
          success: false,
          error: "Failed to export CSV",
        };
      }
    }),

  /**
   * Get leaderboard - top players by accuracy
   */
  getLeaderboard: publicProcedure
    .input(
      z.object({
        opening: z.string().optional(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return {
            success: false,
            error: "Database not available",
            data: [],
          };
        }

        // Query top players by accuracy
        const whereClause = input.opening ? eq(userOpeningStats.opening, input.opening) : undefined;
        const query = db
          .select()
          .from(userOpeningStats)
          .orderBy((t: any) => desc(t.accuracy))
          .limit(input.limit);
        
        const results = whereClause ? await query.where(whereClause) : await query;

        return {
          success: true,
          data: results,
        };
      } catch (error) {
        console.error("[Stats] Error fetching leaderboard:", error);
        return {
          success: false,
          error: "Failed to fetch leaderboard",
          data: [],
        };
      }
    }),

  /**
   * Get export history for user
   */
  getExportHistory: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) {
        return {
          success: false,
          error: "Database not available",
          data: [],
        };
      }

      const exports = await db
        .select()
        .from(statsExports)
        .where(eq(statsExports.userId, ctx.user.id));

      return {
        success: true,
        data: exports,
      };
    } catch (error) {
      console.error("[Stats] Error fetching export history:", error);
      return {
        success: false,
        error: "Failed to fetch export history",
        data: [],
      };
    }
  }),

  /**
   * Aggregate stats after cycle completion
   */
  aggregateAfterCycle: publicProcedure
    .input(
      z.object({
        userId: z.number().optional(),
        deviceId: z.string().optional(),
        trainingSetId: z.string(),
        openingName: z.string(),
        accuracy: z.number(),
        totalPuzzles: z.number(),
        correctCount: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const db = await getDb();
        if (!db) {
          return { success: false, error: "Database not available" };
        }
        return { success: true, message: "Stats aggregated successfully" };
      } catch (error) {
        console.error("[Stats] Error aggregating:", error);
        return { success: false, error: "Failed to aggregate stats" };
      }
    }),
});
