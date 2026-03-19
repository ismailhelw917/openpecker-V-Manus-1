import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'openpecker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// Opening classification database
// Maps opening names to their hierarchy
const openingHierarchy = {
  'Sicilian Defense': {
    'Sicilian Najdorf': 'Najdorf Variation',
    'Sicilian Accelerated Dragon': 'Accelerated Dragon',
    'Sicilian Closed': 'Closed Variation',
    'Sicilian': 'Main Line',
  },
  'Italian Game': {
    'Italian Game Giuoco Piano': 'Giuoco Piano',
    'Italian Game Two Knights Defense': 'Two Knights Defense',
    'Italian Game': 'Main Line',
  },
  'French Defense': {
    'French Defense': 'Main Line',
  },
  'Four Knights': {
    'Four Knights Game': 'Four Knights Game',
    'Four Knights Scotch': 'Scotch Game',
    'Four Knights': 'Main Line',
  },
  'Opening': {
    'Opening': 'Unclassified',
  },
};

// Function to classify a puzzle based on its opening name
function classifyOpening(openingName) {
  if (!openingName) {
    return { opening: 'Opening', subset: 'Unclassified', variation: 'Unknown' };
  }

  // Check if opening name matches any known hierarchy
  for (const [mainOpening, subsets] of Object.entries(openingHierarchy)) {
    if (openingName.includes(mainOpening)) {
      // Try to find the most specific subset match
      for (const [subsetName, variation] of Object.entries(subsets)) {
        if (openingName.includes(subsetName)) {
          return { opening: mainOpening, subset: subsetName, variation };
        }
      }
      // If no subset match, use main opening
      return { opening: mainOpening, subset: mainOpening, variation: 'Main Line' };
    }
  }

  // Default classification
  return { opening: 'Opening', subset: 'Unclassified', variation: openingName || 'Unknown' };
}

// Main classification function
async function classifyAllPuzzles() {
  const conn = await pool.getConnection();
  
  try {
    console.log('[Classify] Starting puzzle classification...');
    
    // Get total puzzle count
    const [countResult] = await conn.query('SELECT COUNT(*) as total FROM puzzles');
    const totalPuzzles = countResult[0].total;
    console.log(`[Classify] Total puzzles to classify: ${totalPuzzles}`);
    
    // Process puzzles in batches
    const batchSize = 100;
    let processed = 0;
    let updated = 0;
    
    for (let offset = 0; offset < totalPuzzles; offset += batchSize) {
      const [puzzles] = await conn.query(
        'SELECT id, openingName FROM puzzles LIMIT ? OFFSET ?',
        [batchSize, offset]
      );
      
      for (const puzzle of puzzles) {
        const classification = classifyOpening(puzzle.openingName);
        
        // Update puzzle with classification
        await conn.query(
          'UPDATE puzzles SET opening = ?, subset = ?, variation = ? WHERE id = ?',
          [classification.opening, classification.subset, classification.variation, puzzle.id]
        );
        
        updated++;
        processed++;
        
        if (processed % 500 === 0) {
          console.log(`[Classify] Processed ${processed}/${totalPuzzles} puzzles`);
        }
      }
    }
    
    console.log(`[Classify] Classification complete! Updated ${updated} puzzles`);
    
    // Get distribution of classifications
    const [distribution] = await conn.query(
      'SELECT opening, subset, COUNT(*) as count FROM puzzles GROUP BY opening, subset ORDER BY count DESC'
    );
    
    console.log('[Classify] Opening distribution:');
    for (const row of distribution) {
      console.log(`  ${row.opening} → ${row.subset}: ${row.count} puzzles`);
    }
    
  } catch (error) {
    console.error('[Classify] Error:', error);
  } finally {
    await conn.release();
    await pool.end();
  }
}

// Run classification
classifyAllPuzzles();
