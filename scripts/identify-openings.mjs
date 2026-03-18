import { Chess } from 'chess.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Common chess openings database (ECO codes and names)
const OPENINGS_DB = {
  'e2e4': {
    'c7c5': 'Sicilian Defense',
    'e7e5': 'Open Game',
    'c7c6': 'Caro-Kann Defense',
    'd7d5': 'Scandinavian Defense',
    'e7e6': 'French Defense',
  },
  'd2d4': {
    'd7d5': 'Queen\'s Gambit',
    'g8f6': 'Indian Defense',
    'e7e6': 'Queen\'s Gambit Declined',
    'c7c6': 'Slav Defense',
    'f7f5': 'Dutch Defense',
  },
  'g1f3': {
    'g8f6': 'Reti Opening',
    'd7d5': 'Reti Opening',
  },
  'c2c4': {
    'e7e5': 'English Opening',
    'g8f6': 'English Opening',
  },
};

// Opening name detection from move sequence
function detectOpening(fen, moves) {
  try {
    const chess = new Chess(fen);
    const moveList = moves.split(' ').filter(m => m.length > 0);
    
    // Reconstruct the game from the FEN position
    let currentMoves = [];
    
    for (const moveStr of moveList.slice(0, 4)) {
      // Parse UCI move format (e.g., "e2e4")
      const from = moveStr.substring(0, 2);
      const to = moveStr.substring(2, 4);
      
      const move = chess.move({
        from,
        to,
        promotion: moveStr.length > 4 ? moveStr[4] : undefined,
      });
      
      if (!move) break;
      currentMoves.push(moveStr);
    }
    
    // Try to identify opening from first few moves
    if (currentMoves.length >= 1) {
      const firstMove = currentMoves[0];
      if (OPENINGS_DB[firstMove]) {
        if (currentMoves.length >= 2) {
          const secondMove = currentMoves[1];
          if (OPENINGS_DB[firstMove][secondMove]) {
            return OPENINGS_DB[firstMove][secondMove];
          }
        }
        // Return generic opening name based on first move
        if (firstMove === 'e2e4') return 'Open Game';
        if (firstMove === 'd2d4') return 'Closed Game';
        if (firstMove === 'g1f3') return 'Reti Opening';
        if (firstMove === 'c2c4') return 'English Opening';
      }
    }
    
    return 'Other Opening';
  } catch (error) {
    console.error('Error detecting opening:', error.message);
    return 'Unknown Opening';
  }
}

async function identifyAndUpdateOpenings() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openpecker',
  });

  try {
    console.log('Fetching puzzles from database...');
    const [puzzles] = await connection.query(
      'SELECT id, fen, moves FROM puzzles LIMIT 1000'
    );

    console.log(`Processing ${puzzles.length} puzzles...`);
    
    let updated = 0;
    let errors = 0;

    for (const puzzle of puzzles) {
      try {
        const opening = detectOpening(puzzle.fen, puzzle.moves);
        
        // Update puzzle with opening name in themes
        const currentThemes = JSON.parse(puzzle.themes || '[]');
        if (!currentThemes.includes(opening)) {
          currentThemes.push(opening);
        }
        
        await connection.query(
          'UPDATE puzzles SET themes = ? WHERE id = ?',
          [JSON.stringify(currentThemes), puzzle.id]
        );
        
        updated++;
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} puzzles...`);
        }
      } catch (error) {
        errors++;
        console.error(`Error processing puzzle ${puzzle.id}:`, error.message);
      }
    }

    console.log(`\nCompleted! Updated: ${updated}, Errors: ${errors}`);
  } finally {
    await connection.end();
  }
}

identifyAndUpdateOpenings().catch(console.error);
