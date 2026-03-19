import { Chess } from 'chess.js';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Parse DATABASE_URL for TiDB connection
const dbUrl = process.env.DATABASE_URL;
let dbConfig;

if (dbUrl && dbUrl.includes('tidbcloud')) {
  // Parse TiDB connection string
  const url = new URL(dbUrl);
  dbConfig = {
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    ssl: {},
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
} else {
  dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openpecker',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
}

const results = {
  total: 0,
  working: 0,
  broken: 0,
  fixable: 0,
  errors: [],
  brokenPuzzles: [],
  startTime: new Date(),
};

async function verifyPuzzle(puzzle) {
  try {
    const game = new Chess();
    
    // Set up the position
    if (!game.load(puzzle.fen)) {
      return { status: 'broken', reason: 'Invalid FEN' };
    }
    
    // Parse moves
    let moves = [];
    try {
      moves = puzzle.moves.split(' ').filter(m => m.length > 0);
    } catch (e) {
      return { status: 'broken', reason: 'Invalid moves format' };
    }
    
    if (moves.length === 0) {
      return { status: 'broken', reason: 'No moves provided' };
    }
    
    // Verify each move is legal
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const legalMoves = game.moves({ verbose: true });
      const isLegal = legalMoves.some(m => m.san === move || m.uci === move);
      
      if (!isLegal) {
        return { 
          status: 'broken', 
          reason: `Illegal move at position ${i + 1}: ${move}` 
        };
      }
      
      // Make the move
      const result = game.move(move, { sloppy: true });
      if (!result) {
        return { 
          status: 'broken', 
          reason: `Failed to execute move ${i + 1}: ${move}` 
        };
      }
    }
    
    // Check if puzzle ends in a valid state
    if (game.isCheckmate()) {
      return { status: 'working', reason: 'Valid checkmate puzzle' };
    } else if (game.isCheck()) {
      return { status: 'working', reason: 'Valid check puzzle' };
    } else if (game.isStalemate()) {
      return { status: 'broken', reason: 'Puzzle ends in stalemate' };
    } else {
      return { status: 'working', reason: 'Valid puzzle' };
    }
  } catch (error) {
    return { 
      status: 'broken', 
      reason: `Error: ${error.message}` 
    };
  }
}

async function main() {
  console.log('🔍 Starting puzzle verification...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Get all puzzles
    const [puzzles] = await connection.query('SELECT id, fen, moves FROM puzzles LIMIT 10000');
    results.total = puzzles.length;
    
    console.log(`Found ${puzzles.length} puzzles to verify...\n`);
    
    // Verify each puzzle
    for (let i = 0; i < puzzles.length; i++) {
      const puzzle = puzzles[i];
      const verification = await verifyPuzzle(puzzle);
      
      if (verification.status === 'working') {
        results.working++;
      } else {
        results.broken++;
        results.brokenPuzzles.push({
          id: puzzle.id,
          fen: puzzle.fen,
          moves: puzzle.moves,
          reason: verification.reason
        });
      }
      
      // Progress indicator
      if ((i + 1) % 100 === 0) {
        const percentage = Math.round(((i + 1) / puzzles.length) * 100);
        console.log(`Progress: ${i + 1}/${puzzles.length} (${percentage}%) - Working: ${results.working}, Broken: ${results.broken}`);
      }
    }
    
    // Generate report
    results.endTime = new Date();
    const duration = (results.endTime - results.startTime) / 1000;
    
    const report = `
╔════════════════════════════════════════════════════════════╗
║         PUZZLE VERIFICATION REPORT                         ║
╚════════════════════════════════════════════════════════════╝

📊 STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Puzzles Tested:     ${results.total}
✅ Working Puzzles:       ${results.working} (${((results.working / results.total) * 100).toFixed(2)}%)
❌ Broken Puzzles:        ${results.broken} (${((results.broken / results.total) * 100).toFixed(2)}%)
⏱️  Verification Time:     ${duration.toFixed(2)} seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 BROKEN PUZZLES (First 50)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${results.brokenPuzzles.slice(0, 50).map((p, i) => `
${i + 1}. Puzzle ID: ${p.id}
   Reason: ${p.reason}
   FEN: ${p.fen}
   Moves: ${p.moves}
`).join('')}

${results.brokenPuzzles.length > 50 ? `... and ${results.brokenPuzzles.length - 50} more broken puzzles\n` : ''}

📋 RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Delete ${results.broken} broken puzzles from database
2. Keep ${results.working} working puzzles
3. Success Rate: ${((results.working / results.total) * 100).toFixed(2)}%

Generated: ${new Date().toISOString()}
`;

    console.log(report);
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'puzzle-verification-report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Save broken puzzles to JSON for easy processing
    const brokenPath = path.join(process.cwd(), 'broken-puzzles.json');
    fs.writeFileSync(brokenPath, JSON.stringify(results.brokenPuzzles, null, 2));
    console.log(`📄 Broken puzzles saved to: ${brokenPath}`);
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    results.errors.push(error.message);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
