import { Chess } from 'chess.js';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Comprehensive ECO opening database
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
  'b1c3': {
    'e7e5': 'Vienna Game',
    'd7d5': 'Slav Defense',
  },
  'f2f4': {
    'e7e5': 'King\'s Gambit',
  },
};

function detectOpening(fen, moves) {
  try {
    const chess = new Chess(fen);
    const moveList = typeof moves === 'string' 
      ? moves.split(' ').filter(m => m.length > 0)
      : Array.isArray(moves) ? moves : [];
    
    let currentMoves = [];
    
    for (const moveStr of moveList.slice(0, 4)) {
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
    
    if (currentMoves.length >= 1) {
      const firstMove = currentMoves[0];
      if (OPENINGS_DB[firstMove]) {
        if (currentMoves.length >= 2) {
          const secondMove = currentMoves[1];
          if (OPENINGS_DB[firstMove][secondMove]) {
            return OPENINGS_DB[firstMove][secondMove];
          }
        }
        if (firstMove === 'e2e4') return 'Open Game';
        if (firstMove === 'd2d4') return 'Closed Game';
        if (firstMove === 'g1f3') return 'Reti Opening';
        if (firstMove === 'c2c4') return 'English Opening';
        if (firstMove === 'b1c3') return 'Vienna Game';
        if (firstMove === 'f2f4') return 'King\'s Gambit';
      }
    }
    
    return 'Other Opening';
  } catch (error) {
    return 'Unknown Opening';
  }
}

async function identifyAndUpdateOpeningsFull() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openpecker',
  });

  const logFile = '/home/ubuntu/openpecker-recreated/scripts/opening-identification.log';
  const log = (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(logMsg);
    fs.appendFileSync(logFile, logMsg + '\n');
  };

  try {
    log('Starting full puzzle opening identification...');
    
    // Get total puzzle count
    const [[{ total }]] = await connection.query('SELECT COUNT(*) as total FROM puzzles');
    log(`Total puzzles to process: ${total}`);
    
    const BATCH_SIZE = 5000;
    let processed = 0;
    let updated = 0;
    let errors = 0;
    let startTime = Date.now();

    for (let offset = 0; offset < total; offset += BATCH_SIZE) {
      const [puzzles] = await connection.query(
        'SELECT id, fen, moves, themes FROM puzzles LIMIT ? OFFSET ?',
        [BATCH_SIZE, offset]
      );

      for (const puzzle of puzzles) {
        try {
          const opening = detectOpening(puzzle.fen, puzzle.moves);
          
          const currentThemes = puzzle.themes ? JSON.parse(puzzle.themes) : [];
          if (!currentThemes.includes(opening)) {
            currentThemes.push(opening);
            
            await connection.query(
              'UPDATE puzzles SET themes = ? WHERE id = ?',
              [JSON.stringify(currentThemes), puzzle.id]
            );
            updated++;
          }
          
          processed++;
          if (processed % 10000 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = (processed / elapsed).toFixed(0);
            log(`Progress: ${processed}/${total} (${(processed/total*100).toFixed(1)}%) - Rate: ${rate} puzzles/sec - Updated: ${updated}`);
          }
        } catch (error) {
          errors++;
          if (errors % 100 === 0) {
            log(`Errors encountered: ${errors}`);
          }
        }
      }
    }

    const totalTime = (Date.now() - startTime) / 1000;
    log(`\n✅ COMPLETED!`);
    log(`Total processed: ${processed}`);
    log(`Updated with openings: ${updated}`);
    log(`Errors: ${errors}`);
    log(`Total time: ${totalTime.toFixed(2)} seconds`);
    log(`Average rate: ${(processed/totalTime).toFixed(0)} puzzles/sec`);
    
  } catch (error) {
    log(`❌ FATAL ERROR: ${error.message}`);
    log(error.stack);
  } finally {
    await connection.end();
  }
}

// Run in background
identifyAndUpdateOpeningsFull().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
