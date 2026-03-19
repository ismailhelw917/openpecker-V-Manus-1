import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Validate FEN string using Chess.js
 */
function isValidFEN(fen) {
  try {
    const chess = new Chess(fen);
    return !chess.isCheckmate() || chess.isCheck(); // Valid if it's a valid position
  } catch (e) {
    return false;
  }
}

/**
 * Parse Lichess puzzle CSV format
 * Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,Themes,GameUrl
 */
async function importLichessPuzzles(filePath, connection, batchSize = 1000) {
  console.log(`📥 Importing Lichess puzzles from: ${filePath}`);
  
  const fileStream = fs.createReadStream(filePath);
  let lineCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let batch = [];

  return new Promise((resolve, reject) => {
    fileStream.on('line', async (line) => {
      lineCount++;
      
      if (lineCount === 1) return; // Skip header
      
      try {
        const [puzzleId, fen, moves, rating, ...rest] = line.split(',');
        
        if (!fen || !moves) return;
        
        // Validate FEN
        if (!isValidFEN(fen)) {
          invalidCount++;
          return;
        }

        batch.push({
          id: puzzleId,
          fen,
          moves,
          rating: parseInt(rating) || 1500,
          themes: rest[4] || '', // Themes field
          openingName: null,
          openingFen: null,
        });

        validCount++;

        // Insert batch when size reached
        if (batch.length >= batchSize) {
          await insertBatch(connection, batch);
          console.log(`✅ Inserted ${validCount} puzzles (${invalidCount} invalid)`);
          batch = [];
        }
      } catch (error) {
        invalidCount++;
      }
    });

    fileStream.on('end', async () => {
      // Insert remaining batch
      if (batch.length > 0) {
        await insertBatch(connection, batch);
      }
      
      console.log(`\n📊 Lichess Import Complete:`);
      console.log(`   Valid puzzles: ${validCount}`);
      console.log(`   Invalid puzzles: ${invalidCount}`);
      console.log(`   Total processed: ${lineCount - 1}`);
      
      resolve({ valid: validCount, invalid: invalidCount });
    });

    fileStream.on('error', reject);
  });
}

/**
 * Parse Chess.com puzzle JSON format
 * Format: { "puzzleId": "...", "fen": "...", "moves": [...], "rating": 1500 }
 */
async function importChesscomPuzzles(filePath, connection, batchSize = 1000) {
  console.log(`📥 Importing Chess.com puzzles from: ${filePath}`);
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const puzzles = JSON.parse(fileContent);
  
  let validCount = 0;
  let invalidCount = 0;
  let batch = [];

  for (const puzzle of puzzles) {
    try {
      const { puzzleId, fen, moves, rating } = puzzle;
      
      if (!fen || !moves) continue;
      
      // Validate FEN
      if (!isValidFEN(fen)) {
        invalidCount++;
        continue;
      }

      batch.push({
        id: puzzleId,
        fen,
        moves: Array.isArray(moves) ? moves.join(' ') : moves,
        rating: parseInt(rating) || 1500,
        themes: puzzle.themes?.join(',') || '',
        openingName: puzzle.opening || null,
        openingFen: null,
      });

      validCount++;

      // Insert batch when size reached
      if (batch.length >= batchSize) {
        await insertBatch(connection, batch);
        console.log(`✅ Inserted ${validCount} puzzles (${invalidCount} invalid)`);
        batch = [];
      }
    } catch (error) {
      invalidCount++;
    }
  }

  // Insert remaining batch
  if (batch.length > 0) {
    await insertBatch(connection, batch);
  }
  
  console.log(`\n📊 Chess.com Import Complete:`);
  console.log(`   Valid puzzles: ${validCount}`);
  console.log(`   Invalid puzzles: ${invalidCount}`);
  console.log(`   Total processed: ${puzzles.length}`);
  
  return { valid: validCount, invalid: invalidCount };
}

/**
 * Insert batch of puzzles into database
 */
async function insertBatch(connection, batch) {
  if (batch.length === 0) return;

  const values = batch.map(p => [
    p.id,
    p.fen,
    p.moves,
    p.rating,
    p.themes,
    p.openingName,
    p.openingFen,
  ]);

  const query = `
    INSERT INTO puzzles (id, fen, moves, rating, themes, openingName, openingFen)
    VALUES ?
    ON DUPLICATE KEY UPDATE
      rating = VALUES(rating),
      themes = VALUES(themes)
  `;

  try {
    await connection.query(query, [values]);
  } catch (error) {
    console.error('❌ Batch insert error:', error.message);
  }
}

/**
 * Main import function
 */
async function importPuzzles() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    const filePath = process.argv[2];
    const fileType = process.argv[3] || 'lichess'; // 'lichess' or 'chesscom'

    if (!filePath) {
      console.error('Usage: node import-puzzles.mjs <file-path> [lichess|chesscom]');
      console.error('Examples:');
      console.error('  node import-puzzles.mjs puzzles.csv lichess');
      console.error('  node import-puzzles.mjs puzzles.json chesscom');
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`🚀 Starting puzzle import...`);
    console.log(`   File: ${filePath}`);
    console.log(`   Type: ${fileType}`);
    console.log(`   Database: ${DATABASE_URL.split('@')[1] || 'unknown'}`);

    let result;
    if (fileType === 'chesscom') {
      result = await importChesscomPuzzles(filePath, connection);
    } else {
      result = await importLichessPuzzles(filePath, connection);
    }

    // Verify import
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM puzzles');
    console.log(`\n✅ Total puzzles in database: ${count.toLocaleString()}`);

  } catch (error) {
    console.error('❌ Import error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

importPuzzles();
