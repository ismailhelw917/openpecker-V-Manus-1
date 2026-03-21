/**
 * Puzzle Classification Helper
 * Uses ECO opening codes and hierarchy to classify unclassified puzzles
 */

import { getDb } from './db';
import { sql } from 'drizzle-orm';

/**
 * ECO Opening Hierarchy
 * Maps opening names to ECO codes for classification
 */
const ECO_HIERARCHY: Record<string, { code: string; name: string; category: string }> = {
  // A-codes: Irregular openings
  'Irregular': { code: 'A00', name: 'Irregular Opening', category: 'Irregular' },
  'Bird Opening': { code: 'A02', name: "Bird's Opening", category: 'Irregular' },
  'Sokolsky Opening': { code: 'A04', name: 'Sokolsky Opening', category: 'Irregular' },
  
  // B-codes: Semi-open games
  'Sicilian': { code: 'B20', name: 'Sicilian Defense', category: 'Semi-Open' },
  'Sicilian Najdorf': { code: 'B90', name: 'Sicilian Najdorf', category: 'Semi-Open' },
  'Sicilian Dragon': { code: 'B70', name: 'Sicilian Dragon', category: 'Semi-Open' },
  'Sicilian Sveshnikov': { code: 'B33', name: 'Sicilian Sveshnikov', category: 'Semi-Open' },
  'Caro-Kann': { code: 'B10', name: 'Caro-Kann Defense', category: 'Semi-Open' },
  'French': { code: 'C00', name: 'French Defense', category: 'Semi-Open' },
  'Scandinavian': { code: 'B01', name: 'Scandinavian Defense', category: 'Semi-Open' },
  
  // C-codes: Open games
  'Italian': { code: 'C50', name: 'Italian Game', category: 'Open' },
  'Spanish': { code: 'C60', name: 'Spanish Opening (Ruy Lopez)', category: 'Open' },
  'Ruy Lopez': { code: 'C60', name: 'Spanish Opening (Ruy Lopez)', category: 'Open' },
  'Scotch': { code: 'C45', name: 'Scotch Game', category: 'Open' },
  'Giuoco Piano': { code: 'C50', name: 'Giuoco Piano', category: 'Open' },
  'Two Knights': { code: 'C55', name: 'Two Knights Defense', category: 'Open' },
  'Vienna': { code: 'C25', name: 'Vienna Game', category: 'Open' },
  'King\'s Gambit': { code: 'C30', name: "King's Gambit", category: 'Open' },
  'Danish Gambit': { code: 'C21', name: 'Danish Gambit', category: 'Open' },
  
  // D-codes: Closed games
  'Queen\'s Gambit': { code: 'D04', name: "Queen's Gambit", category: 'Closed' },
  'Slav': { code: 'D10', name: 'Slav Defense', category: 'Closed' },
  'Semi-Slav': { code: 'D30', name: 'Semi-Slav', category: 'Closed' },
  'Nimzo-Indian': { code: 'E20', name: 'Nimzo-Indian Defense', category: 'Closed' },
  'Queen\'s Indian': { code: 'E12', name: "Queen's Indian Defense", category: 'Closed' },
  'Catalan': { code: 'E04', name: 'Catalan Opening', category: 'Closed' },
  'Reti': { code: 'A09', name: 'Reti Opening', category: 'Closed' },
  
  // E-codes: Indian defenses
  'Indian': { code: 'E00', name: 'Indian Defense', category: 'Indian' },
  'King\'s Indian': { code: 'E60', name: "King's Indian Defense", category: 'Indian' },
  'Grunfeld': { code: 'D80', name: 'Grünfeld Defense', category: 'Indian' },
  'Benko Gambit': { code: 'A56', name: 'Benko Gambit', category: 'Indian' },
};

/**
 * Classify a puzzle based on its opening name
 * Returns ECO code and category
 */
export function classifyPuzzleOpening(openingName: string | null): { ecoCode: string; category: string } | null {
  if (!openingName) return null;
  
  const normalized = openingName.toLowerCase().trim();
  
  // Direct match
  for (const [key, value] of Object.entries(ECO_HIERARCHY)) {
    if (normalized === key.toLowerCase()) {
      return { ecoCode: value.code, category: value.category };
    }
  }
  
  // Partial match (for variations)
  for (const [key, value] of Object.entries(ECO_HIERARCHY)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return { ecoCode: value.code, category: value.category };
    }
  }
  
  // Default: Unknown
  return { ecoCode: 'Z00', category: 'Unclassified' };
}

/**
 * Classify all unclassified puzzles in the database
 */
export async function classifyUnclassifiedPuzzles() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  try {
    // Get all puzzles with null or empty opening classification
    const unclassified = await db.execute(sql`
      SELECT id, opening FROM puzzles 
      WHERE (opening IS NULL OR opening = '' OR opening = 'Unclassified')
      LIMIT 1000
    `);
    
    const rows = Array.isArray(unclassified) ? (Array.isArray(unclassified[0]) ? unclassified[0] : unclassified) : [];
    
    let classified = 0;
    let failed = 0;
    
    for (const row of rows) {
      try {
        const classification = classifyPuzzleOpening(row.opening);
        
        if (classification) {
          await db.execute(sql`
            UPDATE puzzles 
            SET 
              ecoCode = ${classification.ecoCode},
              category = ${classification.category},
              updatedAt = NOW()
            WHERE id = ${row.id}
          `);
          classified++;
        }
      } catch (error) {
        console.error(`Failed to classify puzzle ${row.id}:`, error);
        failed++;
      }
    }
    
    return {
      total: rows.length,
      classified,
      failed,
      message: `Classified ${classified} puzzles, ${failed} failed`
    };
  } catch (error) {
    console.error('Error classifying puzzles:', error);
    throw error;
  }
}

/**
 * Get puzzle statistics by opening classification
 */
export async function getPuzzleStatsByOpening() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.execute(sql`
    SELECT 
      category,
      COUNT(*) as count,
      AVG(difficulty) as avgDifficulty,
      COUNT(DISTINCT opening) as uniqueOpenings
    FROM puzzles
    WHERE category IS NOT NULL AND category != 'Unclassified'
    GROUP BY category
    ORDER BY count DESC
  `);
  
  const rows = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];
  return rows;
}

/**
 * Merge similar opening names
 * E.g., "Sicilian" and "Sicilian Defense" -> "Sicilian Defense"
 */
export async function mergeSimilarOpenings() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const merges = [
    { from: "Alekhine Opening", to: "Alekhine's Opening" },
    { from: "Bird Opening", to: "Bird's Opening" },
    { from: "King's Gambit", to: "King's Gambit" },
    { from: "Queen's Gambit", to: "Queen's Gambit" },
    { from: "Ruy Lopez", to: "Spanish Opening (Ruy Lopez)" },
  ];
  
  let merged = 0;
  
  for (const merge of merges) {
    try {
      await db.execute(sql`
        UPDATE puzzles 
        SET opening = ${merge.to}
        WHERE opening = ${merge.from}
      `);
      merged++;
    } catch (error) {
      console.error(`Failed to merge ${merge.from} to ${merge.to}:`, error);
    }
  }
  
  return { merged, message: `Merged ${merged} opening name variations` };
}

/**
 * Generate classification report
 */
export async function generateClassificationReport() {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const stats = await getPuzzleStatsByOpening();
  
  const report = {
    timestamp: new Date().toISOString(),
    totalPuzzles: 0,
    classifiedPuzzles: 0,
    unclassifiedPuzzles: 0,
    categories: stats,
    summary: ''
  };
  
  // Calculate totals
  const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM puzzles`);
  const totalRows = Array.isArray(totalResult) ? (Array.isArray(totalResult[0]) ? totalResult[0] : totalResult) : [];
  report.totalPuzzles = totalRows[0]?.count || 0;
  
  const classifiedResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM puzzles 
    WHERE category IS NOT NULL AND category != 'Unclassified'
  `);
  const classifiedRows = Array.isArray(classifiedResult) ? (Array.isArray(classifiedResult[0]) ? classifiedResult[0] : classifiedResult) : [];
  report.classifiedPuzzles = classifiedRows[0]?.count || 0;
  
  report.unclassifiedPuzzles = report.totalPuzzles - report.classifiedPuzzles;
  report.summary = `${report.classifiedPuzzles} of ${report.totalPuzzles} puzzles classified (${Math.round((report.classifiedPuzzles / report.totalPuzzles) * 100)}%)`;
  
  return report;
}
