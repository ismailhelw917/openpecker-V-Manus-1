import { getDb } from './db';
import { puzzles } from '../drizzle/schema';
import { sql } from 'drizzle-orm';

/**
 * Fetch puzzles by opening name with filters
 */
export async function getPuzzlesByOpening(
  openingName: string,
  minRating: number = 0,
  maxRating: number = 3000,
  count: number = 50,
  colorFilter: 'white' | 'black' | 'both' = 'both'
) {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        puzzles: [],
        count: 0,
        error: 'Database not available',
      };
    }

    let query = db
      .select({
        id: puzzles.id,
        fen: puzzles.fen,
        moves: puzzles.moves,
        rating: puzzles.rating,
        themes: puzzles.themes,
        openingName: puzzles.openingName,
        openingFen: puzzles.openingFen,
      })
      .from(puzzles)
      .where(
        sql`${puzzles.openingName} LIKE ${`%${openingName}%`} 
            AND ${puzzles.rating} >= ${minRating} 
            AND ${puzzles.rating} <= ${maxRating}`
      )
      .limit(count);

    const result = await query;
    
    return {
      success: true,
      puzzles: result.map(p => ({
        id: p.id,
        fen: p.fen,
        moves: p.moves,
        rating: p.rating,
        themes: p.themes || [],
        openingName: p.openingName || openingName,
        openingFen: p.openingFen || '',
      })),
      count: result.length,
    };
  } catch (error) {
    console.error('Error fetching puzzles by opening:', error);
    return {
      success: false,
      puzzles: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get all available opening names from database
 */
export async function getAvailableOpenings() {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        openings: [],
        error: 'Database not available',
      };
    }

    const result = await db
      .selectDistinct({
        openingName: puzzles.openingName,
      })
      .from(puzzles)
      .where(sql`${puzzles.openingName} IS NOT NULL AND ${puzzles.openingName} != ''`)
      .limit(500);

    return {
      success: true,
      openings: result
        .map(r => r.openingName)
        .filter((name): name is string => name !== null && name !== undefined),
    };
  } catch (error) {
    console.error('Error fetching available openings:', error);
    return {
      success: false,
      openings: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get puzzle statistics by opening
 */
export async function getPuzzleStatsByOpening(openingName: string) {
  try {
    const db = await getDb();
    if (!db) {
      return {
        success: false,
        stats: { totalPuzzles: 0, averageRating: 0, minRating: 0, maxRating: 0 },
        error: 'Database not available',
      };
    }

    const result = await db
      .select({
        count: sql<number>`COUNT(*)`,
        avgRating: sql<number>`AVG(${puzzles.rating})`,
        minRating: sql<number>`MIN(${puzzles.rating})`,
        maxRating: sql<number>`MAX(${puzzles.rating})`,
      })
      .from(puzzles)
      .where(sql`${puzzles.openingName} LIKE ${`%${openingName}%`}`);

    const stats = result[0] || { count: 0, avgRating: 0, minRating: 0, maxRating: 0 };

    return {
      success: true,
      stats: {
        totalPuzzles: stats.count || 0,
        averageRating: Math.round(stats.avgRating || 0),
        minRating: stats.minRating || 0,
        maxRating: stats.maxRating || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching puzzle stats:', error);
    return {
      success: false,
      stats: { totalPuzzles: 0, averageRating: 0, minRating: 0, maxRating: 0 },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
