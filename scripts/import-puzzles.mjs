import fs from 'fs';
import readline from 'readline';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

// Parse connection string
function parseConnectionString(url) {
  const match = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!match) throw new Error('Invalid DATABASE_URL');
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: parseInt(match[4]),
    database: match[5],
  };
}

// Format opening name with proper spacing
function formatOpeningName(name) {
  if (!name) return 'Unknown';
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Extract opening name from OpeningTags
function extractOpeningName(tags) {
  if (!tags) return 'Unknown';
  const parts = tags.split(' ');
  return formatOpeningName(parts[0]);
}

// Main import function
async function importPuzzles() {
  const config = parseConnectionString(DATABASE_URL);
  const connection = await createConnection(config);

  try {
    console.log('Starting puzzle import...');
    
    const fileStream = fs.createReadStream('/home/ubuntu/upload/lichess_db_puzzle(1).csv');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineCount = 0;
    let insertCount = 0;
    let batch = [];
    const BATCH_SIZE = 1000;

    for await (const line of rl) {
      lineCount++;
      
      // Skip header
      if (lineCount === 1) continue;

      try {
        const parts = line.split(',');
        if (parts.length < 10) continue;

        const [puzzleId, fen, moves, rating, ratingDev, popularity, nbPlays, themes, gameUrl, openingTags] = parts;

        // Determine color from FEN (whose turn it is)
        const color = fen.split(' ')[1] === 'w' ? 'white' : 'black';

        const puzzle = {
          id: puzzleId,
          fen: fen,
          moves: JSON.stringify(moves.split(' ')),
          rating: parseInt(rating) || 1500,
          themes: JSON.stringify(themes.split(' ')),
          color: color,
          opening: extractOpeningName(openingTags),
          popularity: parseInt(popularity) || 0,
          nbPlays: parseInt(nbPlays) || 0,
        };

        batch.push(puzzle);

        if (batch.length >= BATCH_SIZE) {
          insertCount += await insertBatch(connection, batch);
          batch = [];
          console.log(`Processed ${lineCount} lines, inserted ${insertCount} puzzles...`);
        }
      } catch (error) {
        console.error(`Error parsing line ${lineCount}:`, error.message);
      }
    }

    // Insert remaining batch
    if (batch.length > 0) {
      insertCount += await insertBatch(connection, batch);
    }

    console.log(`\nImport complete! Total puzzles inserted: ${insertCount}`);
  } finally {
    await connection.end();
  }
}

async function insertBatch(connection, puzzles) {
  if (puzzles.length === 0) return 0;

  const values = puzzles.map(p => [
    p.id,
    p.fen,
    p.moves,
    p.rating,
    p.themes,
    p.color,
    JSON.stringify(p),
  ]);

  const query = `
    INSERT INTO puzzles (id, fen, moves, rating, themes, color, puzzleData)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      rating = VALUES(rating),
      themes = VALUES(themes),
      color = VALUES(color)
  `;

  try {
    for (const value of values) {
      await connection.execute(query, value);
    }
    return values.length;
  } catch (error) {
    console.error('Batch insert error:', error.message);
    return 0;
  }
}

importPuzzles().catch(console.error);
