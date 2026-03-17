import fs from 'fs';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

// Parse connection string
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {},
};

console.log('Connecting to database...');
const pool = mysql.createPool(config);

async function loadCSV() {
  const connection = await pool.getConnection();
  
  try {
    console.log('Starting CSV import...');
    
    const parser = createReadStream('/home/ubuntu/upload/lichess_db_puzzle(1).csv')
      .pipe(parse({
        columns: ['PuzzleId', 'FEN', 'Moves', 'Rating', 'RatingDeviation', 'Popularity', 'NbPlays', 'Themes', 'GameUrl', 'OpeningTags'],
        skip_empty_lines: true,
        from_line: 2,
      }));

    let lineCount = 0;
    let batchSize = 500;
    let batch = [];

    for await (const record of parser) {
      lineCount++;

      const { PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags } = record;

      if (!PuzzleId || !FEN || !Moves) continue;

      batch.push([
        PuzzleId,
        FEN,
        Moves,
        parseInt(Rating) || null,
        parseInt(RatingDeviation) || null,
        parseInt(Popularity) || null,
        parseInt(NbPlays) || null,
        Themes || null,
        GameUrl || null,
        OpeningTags || null,
      ]);

      // Insert batch
      if (batch.length >= batchSize) {
        try {
          await connection.query(
            'INSERT IGNORE INTO puzzles_raw (PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags) VALUES ?',
            [batch]
          );
          console.log(`Inserted ${lineCount} rows...`);
          batch = [];
        } catch (error) {
          console.error('Batch insert error:', error.message);
          batch = [];
        }
      }

      if (lineCount % 100000 === 0) {
        console.log(`Processed ${lineCount} lines...`);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      await connection.query(
        'INSERT IGNORE INTO puzzles_raw (PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays, Themes, GameUrl, OpeningTags) VALUES ?',
        [batch]
      );
      console.log(`Inserted final ${batch.length} rows`);
    }

    // Get final count
    const [result] = await connection.query('SELECT COUNT(*) as count FROM puzzles_raw');
    console.log(`\n✓ CSV import complete! Total puzzles: ${result[0].count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

loadCSV();
