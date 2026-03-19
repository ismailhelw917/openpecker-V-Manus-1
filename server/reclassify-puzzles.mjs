import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const DATABASE_URL = process.env.DATABASE_URL;

/**
 * Map of opening move sequences to opening names
 * Based on common chess openings
 */
const OPENING_PATTERNS = [
  // Sicilian Defense (1.e4 c5)
  {
    name: 'Sicilian Defense',
    moves: ['e4', 'c5'],
  },
  // French Defense (1.e4 e6)
  {
    name: 'French Defense',
    moves: ['e4', 'e6'],
  },
  // Italian Game (1.e4 e5 2.Nf3 Nc6 3.Bc4)
  {
    name: 'Italian Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
  },
  // Four Knights Game (1.e4 e5 2.Nf3 Nc6 3.Nc3 Nf6)
  {
    name: 'Four Knights Game',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Nc3', 'Nf6'],
  },
  // Ruy Lopez (1.e4 e5 2.Nf3 Nc6 3.Bb5)
  {
    name: 'Ruy Lopez',
    moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  },
  // Caro-Kann Defense (1.e4 c6)
  {
    name: 'Caro-Kann Defense',
    moves: ['e4', 'c6'],
  },
  // Scandinavian Defense (1.e4 d5)
  {
    name: 'Scandinavian Defense',
    moves: ['e4', 'd5'],
  },
  // Queen's Gambit (1.d4 d5 2.c4)
  {
    name: 'Queen\'s Gambit',
    moves: ['d4', 'd5', 'c4'],
  },
  // King's Indian Defense (1.d4 Nf6 2.c4 g6)
  {
    name: 'King\'s Indian Defense',
    moves: ['d4', 'Nf6', 'c4', 'g6'],
  },
  // Nimzo-Indian Defense (1.d4 Nf6 2.c4 e6 3.Nc3 Bb4)
  {
    name: 'Nimzo-Indian Defense',
    moves: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
  },
];

/**
 * Extract opening name from move sequence
 */
function classifyOpeningFromMoves(moves) {
  if (!moves || typeof moves !== 'string') {
    return 'Unknown Opening';
  }

  const moveList = moves.split(/\s+/).filter(m => m.length > 0);

  // Try to match against known patterns
  for (const pattern of OPENING_PATTERNS) {
    let matches = true;
    for (let i = 0; i < pattern.moves.length; i++) {
      if (i >= moveList.length) {
        matches = true; // Partial match is OK
        break;
      }
      
      // Extract the move notation (remove check/checkmate symbols)
      const cleanMove = moveList[i].replace(/[+#]$/, '');
      
      if (!cleanMove.includes(pattern.moves[i])) {
        matches = false;
        break;
      }
    }
    
    if (matches) {
      return pattern.name;
    }
  }

  // Fallback: classify by first move
  if (moveList.length > 0) {
    const firstMove = moveList[0].replace(/[+#]$/, '');
    if (firstMove === 'e4') return 'Open Game';
    if (firstMove === 'd4') return 'Closed Game';
    if (firstMove === 'c4') return 'English Opening';
    if (firstMove === 'Nf3') return 'Reti Opening';
  }

  return 'Unknown Opening';
}

/**
 * Reclassify all puzzles with proper opening names
 */
async function reclassifyPuzzles() {
  let connection;

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

    // Get all puzzles
    console.log('📊 Fetching all puzzles...');
    const [puzzles] = await connection.query('SELECT id, moves FROM puzzles');
    console.log(`Found ${puzzles.length} puzzles to reclassify\n`);

    let updated = 0;
    let failed = 0;

    // Process puzzles in batches
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i];

      try {
        const openingName = classifyOpeningFromMoves(puzzle.moves);

        await connection.query(
          'UPDATE puzzles SET openingName = ? WHERE id = ?',
          [openingName, puzzle.id]
        );

        updated++;

        if ((i + 1) % 500 === 0) {
          const percent = (((i + 1) / puzzles.length) * 100).toFixed(1);
          console.log(`✅ Reclassified ${i + 1}/${puzzles.length} (${percent}%)`);
        }
      } catch (error) {
        failed++;
        console.error(`Error reclassifying puzzle ${puzzle.id}:`, error.message);
      }
    }

    console.log(`\n✅ Reclassification Complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);

    // Show final statistics
    console.log('\n📊 Final Opening Distribution:');
    const [stats] = await connection.query(`
      SELECT openingName, COUNT(*) as count, ROUND(AVG(rating), 0) as avg_rating
      FROM puzzles
      GROUP BY openingName
      ORDER BY count DESC
    `);

    for (const stat of stats) {
      console.log(`   ${stat.openingName.padEnd(35)} ${stat.count.toString().padStart(5)} puzzles (avg: ${stat.avg_rating})`);
    }

    console.log('\n✅ Puzzle reclassification complete!');
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
reclassifyPuzzles();
