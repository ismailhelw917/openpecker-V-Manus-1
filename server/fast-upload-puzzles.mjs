import fs from 'fs';
import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const DATABASE_URL = process.env.DATABASE_URL;
const COUNTER_API_KEY = process.env.COUNTER_API_KEY || 'ut_RDvVPl9tOkYq9NfLPSNz8lZmOSI6pUTI0iXa7pAb';
const COUNTER_API_URL = 'https://api.counter.dev/v1/events';

let connection;
let uploadedCount = 0;
let failedCount = 0;
let openingsInserted = new Set();

/**
 * Track puzzle upload via Counter API (non-blocking)
 */
async function trackPuzzleUpload(puzzleId, opening, rating) {
  setImmediate(async () => {
    try {
      const payload = {
        key: COUNTER_API_KEY,
        event: 'puzzle_uploaded',
        category: 'puzzle_import',
        value: rating,
        metadata: {
          puzzleId,
          opening,
          rating,
          timestamp: new Date().toISOString(),
        },
      };

      const response = await fetch(COUNTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COUNTER_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.error(`[Counter API] Error: ${response.status}`);
      }
    } catch (error) {
      // Silently fail - don't block puzzle upload
    }
  });
}

/**
 * Extract opening name from FEN using Chess.js
 */
function extractOpeningFromFEN(fen) {
  try {
    const chess = new Chess(fen);
    
    // Count pieces to estimate move number
    const board = chess.board();
    let piecesOnBoard = 0;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        if (board[i][j]) piecesOnBoard++;
      }
    }
    
    // Estimate opening based on piece count
    const piecesRemoved = 32 - piecesOnBoard;
    const estimatedMoveNumber = Math.round(piecesRemoved / 1.5);
    
    // Classify opening by move number
    if (estimatedMoveNumber < 4) {
      return 'Opening';
    } else if (estimatedMoveNumber < 8) {
      return 'Middlegame Opening';
    } else if (estimatedMoveNumber < 15) {
      return 'Advanced Opening';
    } else {
      return 'Complex Position';
    }
  } catch (error) {
    return 'Unknown Opening';
  }
}

/**
 * Insert or get opening from database
 */
async function insertOpeningIfNeeded(openingName) {
  if (openingsInserted.has(openingName)) {
    return;
  }

  try {
    // Check if opening already exists
    const [existing] = await connection.query(
      'SELECT id FROM openings WHERE name = ? LIMIT 1',
      [openingName]
    );

    if (existing.length === 0) {
      // Insert new opening
      await connection.query(
        'INSERT INTO openings (name, fen, ecoCode) VALUES (?, ?, ?)',
        [openingName, '', '']
      );
      console.log(`  ✓ Inserted opening: ${openingName}`);
    }

    openingsInserted.add(openingName);
  } catch (error) {
    console.error(`  ✗ Error inserting opening ${openingName}:`, error.message);
  }
}

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
 * Import puzzles from CSV file with Counter API tracking
 */
async function importPuzzlesWithCounterAPI(filePath, batchSize = 100) {
  console.log(`📥 Starting puzzle import from: ${filePath}`);
  console.log(`📊 Batch size: ${batchSize}`);
  console.log(`🔄 Counter API tracking enabled\n`);

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n');
  
  let lineCount = 0;
  let batch = [];
  let startTime = Date.now();

  for (const line of lines) {
    lineCount++;

    // Skip header
    if (lineCount === 1) continue;
    
    // Skip empty lines
    if (!line.trim()) continue;

    try {
      const [puzzleId, fen, moves, rating, ...rest] = line.split(',');

      if (!fen || !moves) {
        failedCount++;
        continue;
      }

      // Validate FEN
      if (!isValidFEN(fen)) {
        failedCount++;
        continue;
      }

      // Extract opening name
      const openingName = extractOpeningFromFEN(fen);

      // Add to batch
      batch.push({
        id: puzzleId.trim(),
        fen: fen.trim().replace(/^"/, '').replace(/"$/, ''),
        moves: moves.trim().replace(/^"/, '').replace(/"$/, ''),
        rating: parseInt(rating) || 1500,
        themes: rest[4] ? rest[4].replace(/^"/, '').replace(/"$/, '') : '',
        openingName,
      });

      uploadedCount++;

      // Insert batch when size reached
      if (batch.length >= batchSize) {
        await processBatch(batch);
        batch = [];
      }

      // Progress indicator
      if (uploadedCount % 500 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (uploadedCount / elapsed).toFixed(0);
        console.log(`✅ Processed ${uploadedCount} puzzles (${rate} puzzles/sec)`);
      }
    } catch (error) {
      failedCount++;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    await processBatch(batch);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n📊 Import Complete!`);
  console.log(`   ✅ Uploaded: ${uploadedCount}`);
  console.log(`   ❌ Failed: ${failedCount}`);
  console.log(`   ⏱️  Time: ${elapsed}s`);
  console.log(`   📈 Rate: ${(uploadedCount / elapsed).toFixed(0)} puzzles/sec`);
  console.log(`   🏷️  Unique openings: ${openingsInserted.size}`);

  return { uploaded: uploadedCount, failed: failedCount };
}

/**
 * Process a batch of puzzles
 */
async function processBatch(batch) {
  try {
    // Insert openings first (real-time insertion)
    const uniqueOpenings = [...new Set(batch.map(p => p.openingName))];
    for (const opening of uniqueOpenings) {
      await insertOpeningIfNeeded(opening);
    }

    // Insert puzzles
    for (const puzzle of batch) {
      try {
        await connection.query(
          `INSERT INTO puzzles (id, fen, moves, rating, themes, openingName, createdAt, updatedAt) 
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
           ON DUPLICATE KEY UPDATE updatedAt = NOW()`,
          [puzzle.id, puzzle.fen, puzzle.moves, puzzle.rating, puzzle.themes, puzzle.openingName]
        );

        // Track via Counter API (non-blocking)
        await trackPuzzleUpload(puzzle.id, puzzle.openingName, puzzle.rating);
      } catch (error) {
        console.error(`Error inserting puzzle ${puzzle.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error processing batch:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Parse database URL
    const url = new URL(DATABASE_URL);
    const config = {
      host: url.hostname,
      port: url.port || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      ssl: { rejectUnauthorized: false },
    };

    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Import puzzles from CSV
    const csvPath = '/home/ubuntu/openpecker-recreated/puzzles-sample.csv';
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvPath}`);
      process.exit(1);
    }

    await importPuzzlesWithCounterAPI(csvPath, 100);

    // Show final statistics
    console.log('\n📊 Final Database Statistics:');
    const [stats] = await connection.query(`
      SELECT 
        COUNT(*) as total_puzzles,
        COUNT(DISTINCT openingName) as unique_openings,
        MIN(rating) as min_rating,
        MAX(rating) as max_rating,
        ROUND(AVG(rating), 0) as avg_rating
      FROM puzzles
    `);

    console.log(`   Total puzzles: ${stats[0].total_puzzles}`);
    console.log(`   Unique openings: ${stats[0].unique_openings}`);
    console.log(`   Rating range: ${stats[0].min_rating} - ${stats[0].max_rating}`);
    console.log(`   Average rating: ${stats[0].avg_rating}`);

    // Show top openings
    console.log('\n🏆 Top 10 Openings by Puzzle Count:');
    const [topOpenings] = await connection.query(`
      SELECT openingName, COUNT(*) as count, ROUND(AVG(rating), 0) as avg_rating
      FROM puzzles
      GROUP BY openingName
      ORDER BY count DESC
      LIMIT 10
    `);

    for (const opening of topOpenings) {
      console.log(`   ${opening.openingName.padEnd(30)} ${opening.count.toString().padStart(5)} puzzles (avg: ${opening.avg_rating})`);
    }

    console.log('\n✅ Puzzle import complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the script
main();
