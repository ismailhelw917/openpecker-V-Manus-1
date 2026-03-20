import fs from 'fs';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import path from 'path';
import mysql from 'mysql2/promise';

/**
 * Stream-based CSV parser for loading Lichess puzzles in batches
 * Validates each puzzle and inserts into database
 * Can resume from last successful batch
 */

const CSV_FILE = '/home/ubuntu/openpecker-recreated/puzzles-sample.csv';
const LOG_FILE = '/tmp/stream-load-puzzles.log';
const BATCH_SIZE = 100;
const PROGRESS_FILE = '/tmp/puzzle-load-progress.json';

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

function saveProgress(data) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (error) {
    log(`Warning: Could not load progress file: ${error.message}`);
  }
  return { processedRows: 0, insertedPuzzles: 0, failedPuzzles: 0, lastError: null };
}

async function getDbConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }

  const url = new URL(dbUrl);
  const connection = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });
  return connection;
}

async function insertPuzzleBatch(connection, puzzles) {
  if (puzzles.length === 0) return 0;

  const values = puzzles.map(p => [
    p.id,
    p.fen,
    p.moves,
    p.rating,
    p.themes,
    p.opening || 'Opening',
    p.subset || 'Unclassified',
    p.variation || 'Unknown'
  ]);

  const sql = `
    INSERT INTO puzzles 
    (id, fen, moves, rating, themes, opening, subset, variation)
    VALUES ?
    ON DUPLICATE KEY UPDATE
    rating = VALUES(rating),
    themes = VALUES(themes)
  `;

  try {
    const [result] = await connection.query(sql, [values]);
    return result.affectedRows;
  } catch (error) {
    log(`Error inserting batch: ${error.message}`);
    throw error;
  }
}

async function parseCsvAndLoad() {
  log('=== Starting Stream-Based Puzzle Loading ===');
  
  const progress = loadProgress();
  log(`Resuming from row ${progress.processedRows}, inserted: ${progress.insertedPuzzles}`);

  let connection;
  try {
    connection = await getDbConnection();
    log('Connected to database');
  } catch (error) {
    log(`Failed to connect to database: ${error.message}`);
    process.exit(1);
  }

  let batch = [];
  let rowCount = 0;
  let insertedCount = 0;
  let failedCount = 0;

  return new Promise((resolve, reject) => {
    const parser = parse({
      columns: ['id', 'fen', 'moves', 'rating', 'popularity', 'nbPlays', 'themes', 'url'],
      skip_empty_lines: true,
      skip_records_with_empty_values: false
    });

    const stream = createReadStream(CSV_FILE)
      .pipe(parser)
      .on('data', async (record) => {
        rowCount++;

        // Skip header row
        if (rowCount === 1) return;

        // Skip if already processed
        if (rowCount <= progress.processedRows) return;

        try {
          // Validate puzzle data
          if (!record.id || !record.fen || !record.moves) {
            failedCount++;
            return;
          }

          // Parse opening from moves
          const moveList = record.moves.split(' ');
          let opening = 'Opening';
          
          // Simple opening detection based on move sequence
          if (moveList[0] === 'e4') {
            if (moveList[1] === 'c5') opening = 'Sicilian Defense';
            else if (moveList[1] === 'e5') opening = 'Open Game';
            else if (moveList[1] === 'c6') opening = 'Caro-Kann Defense';
            else if (moveList[1] === 'd5') opening = 'Scandinavian Defense';
          } else if (moveList[0] === 'd4') {
            opening = 'Queens Pawn Opening';
          } else if (moveList[0] === 'c4') {
            opening = 'English Opening';
          } else if (moveList[0] === 'Nf3') {
            opening = 'Reti Opening';
          }

          const puzzle = {
            id: record.id,
            fen: record.fen,
            moves: record.moves,
            rating: parseInt(record.rating) || 1500,
            themes: record.themes || 'tactic',
            opening: opening
          };

          batch.push(puzzle);

          // Insert batch when it reaches BATCH_SIZE
          if (batch.length >= BATCH_SIZE) {
            stream.pause();
            
            try {
              const inserted = await insertPuzzleBatch(connection, batch);
              insertedCount += inserted;
              log(`Inserted batch of ${batch.length} puzzles (total: ${insertedCount})`);
              batch = [];
              
              // Update progress
              progress.processedRows = rowCount;
              progress.insertedPuzzles = insertedCount;
              progress.failedPuzzles = failedCount;
              saveProgress(progress);
              
              stream.resume();
            } catch (error) {
              log(`Batch insert failed: ${error.message}`);
              progress.lastError = error.message;
              saveProgress(progress);
              stream.destroy();
              reject(error);
            }
          }
        } catch (error) {
          log(`Error processing row ${rowCount}: ${error.message}`);
          failedCount++;
        }
      })
      .on('end', async () => {
        try {
          // Insert remaining puzzles
          if (batch.length > 0) {
            const inserted = await insertPuzzleBatch(connection, batch);
            insertedCount += inserted;
            log(`Inserted final batch of ${batch.length} puzzles`);
          }

          log(`\n=== Loading Complete ===`);
          log(`Processed rows: ${rowCount}`);
          log(`Inserted puzzles: ${insertedCount}`);
          log(`Failed puzzles: ${failedCount}`);

          progress.processedRows = rowCount;
          progress.insertedPuzzles = insertedCount;
          progress.failedPuzzles = failedCount;
          progress.status = 'complete';
          saveProgress(progress);

          await connection.end();
          resolve();
        } catch (error) {
          log(`Error on stream end: ${error.message}`);
          reject(error);
        }
      })
      .on('error', (error) => {
        log(`Stream error: ${error.message}`);
        reject(error);
      });
  });
}

parseCsvAndLoad()
  .then(() => {
    log('Puzzle loading completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    log(`Fatal error: ${error.message}`);
    process.exit(1);
  });
