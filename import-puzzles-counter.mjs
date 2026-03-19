import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;
const COUNTER_API_KEY = process.env.COUNTER_API_KEY || 'ut_RDvVPl9tOkYq9NfLPSNz8lZmOSI6pUTI0iXa7pAb';
const COUNTER_API_URL = 'https://api.counter.dev/v1/events';

/**
 * Validate FEN string using Chess.js
 */
function isValidFEN(fen) {
  try {
    new Chess(fen);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Track puzzle import progress via Counter API
 */
async function trackImportProgress(action, count, totalCount) {
  try {
    const payload = {
      key: COUNTER_API_KEY,
      event: 'puzzle_import',
      category: action,
      value: count,
      metadata: {
        totalCount,
        progress: Math.round((count / totalCount) * 100),
        timestamp: new Date().toISOString(),
      },
    };

    await fetch(COUNTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COUNTER_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    console.log(`[Counter API] Tracked: ${action} - ${count}/${totalCount} (${Math.round((count / totalCount) * 100)}%)`);
  } catch (error) {
    console.error(`[Counter API] Error tracking progress:`, error.message);
  }
}

/**
 * Parse Lichess puzzle CSV format using readline
 */
async function importLichessPuzzles(filePath, connection, batchSize = 100) {
  console.log(`📥 Importing Lichess puzzles from: ${filePath}`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let validCount = 0;
  let invalidCount = 0;
  let batch = [];
  let totalLines = 0;

  // Count total lines first
  console.log('📊 Counting total lines...');
  const countStream = fs.createReadStream(filePath);
  const countRl = readline.createInterface({
    input: countStream,
    crlfDelay: Infinity
  });

  for await (const line of countRl) {
    totalLines++;
  }
  console.log(`📊 Total lines to process: ${totalLines}`);

  return new Promise((resolve, reject) => {
    rl.on('line', async (line) => {
      lineCount++;
      
      if (lineCount === 1) return; // Skip header
      
      try {
        // Parse CSV line - handle quoted fields
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim().replace(/^"|"$/g, ''));
        
        const [puzzleId, fen, moves, rating, ratingDev, popularity, themes, gameUrl] = fields;
        
        if (!fen || !moves) {
          invalidCount++;
          return;
        }
        
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
          themes: themes || '',
          openingName: null,
          openingFen: null,
        });

        validCount++;

        // Insert batch when size reached
        if (batch.length >= batchSize) {
          await insertBatch(connection, batch);
          
          // Track progress via Counter API every 500 valid puzzles
          if (validCount % 500 === 0) {
            await trackImportProgress('batch_inserted', validCount, totalLines - 1);
          }
          
          console.log(`✅ Inserted ${validCount} puzzles (${invalidCount} invalid, line ${lineCount}/${totalLines})`);
          batch = [];
        }
      } catch (error) {
        invalidCount++;
      }
    });

    rl.on('end', async () => {
      // Insert remaining batch
      if (batch.length > 0) {
        await insertBatch(connection, batch);
      }
      
      console.log(`\n📊 Lichess Import Complete:`);
      console.log(`   Valid puzzles: ${validCount}`);
      console.log(`   Invalid puzzles: ${invalidCount}`);
      console.log(`   Total processed: ${lineCount - 1}`);
      
      // Track final import stats
      await trackImportProgress('import_complete', validCount, totalLines - 1);
      
      resolve({ valid: validCount, invalid: invalidCount });
    });

    rl.on('error', reject);
  });
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

    if (!filePath) {
      console.error('Usage: node import-puzzles-counter.mjs <file-path>');
      console.error('Example: node import-puzzles-counter.mjs puzzles-sample.csv');
      process.exit(1);
    }

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`🚀 Starting puzzle import with Counter API tracking...`);
    console.log(`   File: ${filePath}`);
    console.log(`   Database: ${DATABASE_URL.split('@')[1] || 'unknown'}`);

    // Track import start
    await trackImportProgress('import_started', 0, 5000);

    const result = await importLichessPuzzles(filePath, connection);

    // Verify import
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM puzzles');
    console.log(`\n✅ Total puzzles in database: ${count.toLocaleString()}`);

    // Track final stats
    await trackImportProgress('import_finished', count, count);

  } catch (error) {
    console.error('❌ Import error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

importPuzzles();
