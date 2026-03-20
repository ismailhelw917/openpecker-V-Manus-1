import { sql } from 'drizzle-orm';
import { getDb } from './connection';
import { puzzles } from '../drizzle/schema';

const DISPLAY_TO_DB_OPENING: Record<string, string> = {
  'Sicilian Defence': 'Sicilian',
  'Queens Gambit': 'Queen\'s Gambit',
  'French Defence': 'French Defense',
  'Italian Game': 'Italian Game',
  'Caro-Kann Defence': 'Caro-Kann Defense',
  'King\'s Indian Defence': 'King\'s Indian Defense',
  'Scandinavian Defence': 'Scandinavian Defense',
  'English Opening': 'English Opening',
  'Ruy López': 'Ruy Lopez',
};

export async function getRandomPuzzlesByOpeningAndRatingFixed(
  openingName: string,
  minRating: number,
  maxRating: number,
  puzzleCount: number,
  variation?: string,
  color?: string
) {
  try {
    const db = await getDb();
    if (!db) {
      console.error('[getRandomPuzzlesByOpeningAndRating] Database not available');
      return [];
    }

    // Convert display name to database name
    const dbOpeningName = DISPLAY_TO_DB_OPENING[openingName as keyof typeof DISPLAY_TO_DB_OPENING] || openingName;
    console.log('[getRandomPuzzlesByOpeningAndRating] Fetching puzzles for:', dbOpeningName);

    // Build the query using Drizzle's sql helper for raw queries
    let query = sql`SELECT * FROM ${puzzles} 
      WHERE ${puzzles.openingName} = ${dbOpeningName}
      AND ${puzzles.rating} >= ${minRating}
      AND ${puzzles.rating} <= ${maxRating}`;

    if (color && color !== 'both') {
      query = sql`${query} AND ${puzzles.color} = ${color}`;
    }

    query = sql`${query} LIMIT ${puzzleCount}`;

    const result = await db.all(query);
    console.log('[getRandomPuzzlesByOpeningAndRating] Found:', result?.length || 0, 'puzzles');
    return result || [];
  } catch (error) {
    console.error('[getRandomPuzzlesByOpeningAndRating] Error:', error);
    return [];
  }
}
