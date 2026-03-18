/**
 * MCP Server for OpenPecker Analytics
 * Provides statistical queries accessible through Manus Chat
 * 
 * Usage in Manus Chat:
 * - "How many users are on the platform?"
 * - "What's the average accuracy across all users?"
 * - "Show me the top 10 openings by puzzle count"
 * - "How many puzzles have been solved today?"
 */

import { getDb } from "./db";
import { users, cycleHistory, puzzles, trainingSets } from "../drizzle/schema";
import { sql, count, avg, sum } from "drizzle-orm";

interface AnalyticsQuery {
  type: "users" | "puzzles" | "stats" | "openings" | "trends";
  metric?: string;
  timeRange?: "today" | "week" | "month" | "all";
  limit?: number;
}

interface AnalyticsResponse {
  success: boolean;
  data: any;
  timestamp: string;
  message: string;
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<AnalyticsResponse> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: "Database not available",
    };
  }

  try {
    // Total users
    const totalUsersResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);
    const totalUsers = totalUsersResult[0]?.count || 0;

    // Premium users
    const premiumUsersResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users)
      .where(sql`isPremium = 1`);
    const premiumUsers = premiumUsersResult[0]?.count || 0;

    // Active users (users with training sets)
    const activeUsersResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT userId)` })
      .from(trainingSets)
      .where(sql`userId IS NOT NULL`);
    const activeUsers = activeUsersResult[0]?.count || 0;

    return {
      success: true,
      data: {
        totalUsers,
        premiumUsers,
        premiumPercentage: totalUsers > 0 ? ((premiumUsers / totalUsers) * 100).toFixed(1) : 0,
        activeUsers,
        conversionRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
      },
      timestamp: new Date().toISOString(),
      message: `Platform has ${totalUsers} users (${premiumUsers} premium, ${activeUsers} active)`,
    };
  } catch (error) {
    console.error("[Analytics] Error getting user stats:", error);
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get puzzle statistics
 */
export async function getPuzzleStats(): Promise<AnalyticsResponse> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: "Database not available",
    };
  }

  try {
    // Total puzzles
    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(puzzles);
    const totalPuzzles = totalResult[0]?.count || 0;

    // Puzzles with opening names
    const namedResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(puzzles)
      .where(sql`openingName IS NOT NULL`);
    const namedPuzzles = namedResult[0]?.count || 0;

    // Puzzles without opening names (NULL)
    const nullResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(puzzles)
      .where(sql`openingName IS NULL`);
    const nullPuzzles = nullResult[0]?.count || 0;

    // Unique openings
    const uniqueResult = await db
      .select({ count: sql<number>`COUNT(DISTINCT openingName)` })
      .from(puzzles);
    const uniqueOpenings = uniqueResult[0]?.count || 0;

    // Average rating
    const ratingResult = await db
      .select({ avg: sql<number>`AVG(rating)` })
      .from(puzzles);
    const avgRating = ratingResult[0]?.avg || 0;

    return {
      success: true,
      data: {
        totalPuzzles,
        namedPuzzles,
        nullPuzzles,
        classificationPercentage: totalPuzzles > 0 ? ((namedPuzzles / totalPuzzles) * 100).toFixed(1) : 0,
        uniqueOpenings,
        averageRating: avgRating.toFixed(0),
      },
      timestamp: new Date().toISOString(),
      message: `Database has ${totalPuzzles.toLocaleString()} puzzles (${namedPuzzles.toLocaleString()} classified, ${uniqueOpenings} unique openings)`,
    };
  } catch (error) {
    console.error("[Analytics] Error getting puzzle stats:", error);
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get user performance statistics
 */
export async function getPerformanceStats(): Promise<AnalyticsResponse> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: "Database not available",
    };
  }

  try {
    // Total cycles completed
    const cyclesResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(cycleHistory);
    const totalCycles = cyclesResult[0]?.count || 0;

    // Average accuracy
    const accuracyResult = await db
      .select({ avg: sql<number>`AVG(accuracy)` })
      .from(cycleHistory);
    const avgAccuracy = accuracyResult[0]?.avg || 0;

    // Total puzzles solved
    const puzzlesSolvedResult = await db
      .select({ sum: sql<number>`SUM(totalPuzzles)` })
      .from(cycleHistory);
    const totalPuzzlesSolved = puzzlesSolvedResult[0]?.sum || 0;

    // Total correct answers
    const correctResult = await db
      .select({ sum: sql<number>`SUM(correctCount)` })
      .from(cycleHistory);
    const totalCorrect = correctResult[0]?.sum || 0;

    return {
      success: true,
      data: {
        totalCycles,
        totalPuzzlesSolved,
        totalCorrect,
        averageAccuracy: avgAccuracy.toFixed(2),
        winRate: totalPuzzlesSolved > 0 ? ((totalCorrect / totalPuzzlesSolved) * 100).toFixed(1) : 0,
      },
      timestamp: new Date().toISOString(),
      message: `Users have completed ${totalCycles} cycles, solving ${totalPuzzlesSolved.toLocaleString()} puzzles with ${avgAccuracy.toFixed(1)}% average accuracy`,
    };
  } catch (error) {
    console.error("[Analytics] Error getting performance stats:", error);
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Get top openings by puzzle count
 */
export async function getTopOpenings(limit: number = 10): Promise<AnalyticsResponse> {
  const db = await getDb();
  if (!db) {
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: "Database not available",
    };
  }

  try {
    const openings = await db
      .select({
        opening: puzzles.openingName,
        count: sql<number>`COUNT(*)`,
      })
      .from(puzzles)
      .groupBy(puzzles.openingName)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    return {
      success: true,
      data: openings.map((o) => ({
        opening: o.opening || "Unclassified",
        puzzleCount: o.count,
      })),
      timestamp: new Date().toISOString(),
      message: `Top ${limit} openings by puzzle count`,
    };
  } catch (error) {
    console.error("[Analytics] Error getting top openings:", error);
    return {
      success: false,
      data: null,
      timestamp: new Date().toISOString(),
      message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Process natural language analytics query
 */
export async function processAnalyticsQuery(query: string): Promise<AnalyticsResponse> {
  const lowerQuery = query.toLowerCase();

  // User statistics queries
  if (
    lowerQuery.includes("user") ||
    lowerQuery.includes("player") ||
    lowerQuery.includes("active") ||
    lowerQuery.includes("premium")
  ) {
    return getUserStats();
  }

  // Puzzle statistics queries
  if (
    lowerQuery.includes("puzzle") ||
    lowerQuery.includes("opening") ||
    lowerQuery.includes("database") ||
    lowerQuery.includes("classified")
  ) {
    if (lowerQuery.includes("top") || lowerQuery.includes("most")) {
      return getTopOpenings(10);
    }
    return getPuzzleStats();
  }

  // Performance statistics queries
  if (
    lowerQuery.includes("accuracy") ||
    lowerQuery.includes("performance") ||
    lowerQuery.includes("solved") ||
    lowerQuery.includes("cycle")
  ) {
    return getPerformanceStats();
  }

  // Default: return all stats
  const userStats = await getUserStats();
  const puzzleStats = await getPuzzleStats();
  const perfStats = await getPerformanceStats();

  return {
    success: true,
    data: {
      users: userStats.data,
      puzzles: puzzleStats.data,
      performance: perfStats.data,
    },
    timestamp: new Date().toISOString(),
    message: "Complete platform analytics",
  };
}

/**
 * Export all analytics functions for MCP integration
 */
export const analyticsTools = {
  getUserStats,
  getPuzzleStats,
  getPerformanceStats,
  getTopOpenings,
  processAnalyticsQuery,
};
