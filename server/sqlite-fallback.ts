import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SQLite database path - store in project root
const DB_PATH = path.join(__dirname, '..', 'puzzles-cache.db');

let _sqliteDb: Database.Database | null = null;

/**
 * Get or create SQLite database instance for local puzzle caching
 */
export function getSqliteDb(): Database.Database {
  if (!_sqliteDb) {
    try {
      _sqliteDb = new Database(DB_PATH);
      _sqliteDb.pragma('journal_mode = WAL');
      initializeSqliteSchema();
      console.log('[SQLite] Database initialized at:', DB_PATH);
    } catch (error) {
      console.error('[SQLite] Failed to initialize database:', error);
      throw error;
    }
  }
  return _sqliteDb;
}

/**
 * Initialize SQLite schema for puzzle caching
 */
function initializeSqliteSchema() {
  const db = _sqliteDb!;
  
  // Create puzzles table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS puzzles (
      id TEXT PRIMARY KEY,
      fen TEXT NOT NULL,
      moves TEXT NOT NULL,
      rating INTEGER,
      themes TEXT NOT NULL,
      color TEXT,
      openingName TEXT,
      openingVariation TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles(rating);
    CREATE INDEX IF NOT EXISTS idx_puzzles_color ON puzzles(color);
    CREATE INDEX IF NOT EXISTS idx_puzzles_openingName ON puzzles(openingName);
  `);
  
  console.log('[SQLite] Schema initialized');
}

/**
 * Insert puzzles into SQLite cache
 */
export function insertPuzzlesIntoCache(puzzles: any[]): void {
  try {
    const db = getSqliteDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO puzzles 
      (id, fen, moves, rating, themes, color, openingName, openingVariation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertMany = db.transaction((puzzles: any[]) => {
      for (const puzzle of puzzles) {
        stmt.run(
          puzzle.id,
          puzzle.fen,
          typeof puzzle.moves === 'string' ? puzzle.moves : JSON.stringify(puzzle.moves),
          puzzle.rating,
          typeof puzzle.themes === 'string' ? puzzle.themes : JSON.stringify(puzzle.themes),
          puzzle.color || null,
          puzzle.openingName || null,
          puzzle.openingVariation || null
        );
      }
    });
    
    insertMany(puzzles);
    console.log(`[SQLite] Cached ${puzzles.length} puzzles`);
  } catch (error) {
    console.error('[SQLite] Error inserting puzzles:', error);
  }
}

/**
 * Get random puzzles from SQLite cache by opening name
 */
export function getRandomPuzzlesFromCache(
  openingName: string,
  minRating: number,
  maxRating: number,
  limit: number = 20,
  color?: string
): any[] {
  try {
    const db = getSqliteDb();
    
    let query = `
      SELECT * FROM puzzles 
      WHERE openingName = ? 
      AND rating BETWEEN ? AND ?
    `;
    const params: any[] = [openingName, minRating, maxRating];
    
    if (color && color !== 'both') {
      query += ` AND color = ?`;
      params.push(color);
    }
    
    query += ` ORDER BY RANDOM() LIMIT ?`;
    params.push(limit);
    
    const stmt = db.prepare(query);
    const results = stmt.all(...params) as any[];
    
    // Parse JSON fields
    return results.map(p => ({
      ...p,
      moves: typeof p.moves === 'string' ? p.moves.split(' ') : p.moves,
      themes: typeof p.themes === 'string' ? JSON.parse(p.themes) : p.themes,
    }));
  } catch (error) {
    console.error('[SQLite] Error fetching puzzles:', error);
    return [];
  }
}

/**
 * Get puzzle count by opening name
 */
export function getPuzzleCountByOpening(openingName: string): number {
  try {
    const db = getSqliteDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM puzzles WHERE openingName = ?');
    const result = stmt.get(openingName) as any;
    return result?.count || 0;
  } catch (error) {
    console.error('[SQLite] Error getting puzzle count:', error);
    return 0;
  }
}

/**
 * Get all unique opening names from cache
 */
export function getUniqueOpeningsFromCache(): string[] {
  try {
    const db = getSqliteDb();
    const stmt = db.prepare(`
      SELECT DISTINCT openingName FROM puzzles 
      WHERE openingName IS NOT NULL 
      ORDER BY openingName ASC
    `);
    const results = stmt.all() as any[];
    return results.map(r => r.openingName).filter(Boolean);
  } catch (error) {
    console.error('[SQLite] Error fetching openings:', error);
    return [];
  }
}

/**
 * Clear all puzzles from cache
 */
export function clearPuzzleCache(): void {
  try {
    const db = getSqliteDb();
    db.exec('DELETE FROM puzzles');
    console.log('[SQLite] Puzzle cache cleared');
  } catch (error) {
    console.error('[SQLite] Error clearing cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { totalPuzzles: number; uniqueOpenings: number } {
  try {
    const db = getSqliteDb();
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM puzzles');
    const openingsStmt = db.prepare('SELECT COUNT(DISTINCT openingName) as count FROM puzzles');
    
    const total = (totalStmt.get() as any)?.count || 0;
    const openings = (openingsStmt.get() as any)?.count || 0;
    
    return { totalPuzzles: total, uniqueOpenings: openings };
  } catch (error) {
    console.error('[SQLite] Error getting cache stats:', error);
    return { totalPuzzles: 0, uniqueOpenings: 0 };
  }
}

/**
 * Close SQLite database
 */
export function closeSqliteDb(): void {
  if (_sqliteDb) {
    _sqliteDb.close();
    _sqliteDb = null;
    console.log('[SQLite] Database closed');
  }
}
