import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

// Database connection config
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'openpecker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/**
 * Classify a puzzle FEN into an opening category
 */
function classifyOpening(fen) {
  try {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true });
    
    // Extract opening info from FEN
    const fenParts = fen.split(' ');
    const boardState = fenParts[0];
    
    // Count moves from starting position (rough estimate)
    const moveCount = (64 - boardState.split('/').join('').replace(/\d/g, '').length) / 2;
    
    // Simple classification based on move count and position
    if (moveCount < 3) {
      return 'Beginner Openings';
    } else if (moveCount < 6) {
      return 'Intermediate Openings';
    } else if (moveCount < 10) {
      return 'Advanced Openings';
    } else {
      return 'Expert Openings';
    }
  } catch (error) {
    console.error('Error classifying opening:', error.message);
    return 'Unclassified';
  }
}

/**
 * Batch update puzzles with NULL opening names
 */
async function classifyNullPuzzles() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Starting puzzle classification...');
    
    // Get puzzles with NULL opening names
    const [puzzles] = await connection.query(
      'SELECT id, fen FROM puzzles WHERE openingName IS NULL LIMIT 10000'
    );
    
    console.log(`Found ${puzzles.length} puzzles to classify`);
    
    let classified = 0;
    let failed = 0;
    
    // Process puzzles in batches
    for (const puzzle of puzzles) {
      try {
        const opening = classifyOpening(puzzle.fen);
        
        await connection.query(
          'UPDATE puzzles SET openingName = ? WHERE id = ?',
          [opening, puzzle.id]
        );
        
        classified++;
        
        if (classified % 1000 === 0) {
          console.log(`Classified ${classified} puzzles...`);
        }
      } catch (error) {
        failed++;
        console.error(`Failed to classify puzzle ${puzzle.id}:`, error.message);
      }
    }
    
    console.log(`\nClassification complete!`);
    console.log(`Successfully classified: ${classified}`);
    console.log(`Failed: ${failed}`);
    
    // Show updated statistics
    const [stats] = await connection.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN openingName IS NULL THEN 1 END) as null_count,
        COUNT(DISTINCT openingName) as unique_openings
      FROM puzzles`
    );
    
    console.log('\nUpdated puzzle statistics:');
    console.log(`Total puzzles: ${stats[0].total}`);
    console.log(`Puzzles with NULL opening: ${stats[0].null_count}`);
    console.log(`Unique opening categories: ${stats[0].unique_openings}`);
    
  } catch (error) {
    console.error('Error during classification:', error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

// Run the classification
classifyNullPuzzles().catch(console.error);
