import { Chess } from 'chess.js';
import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// Parse DATABASE_URL for TiDB connection
const dbUrl = process.env.DATABASE_URL;
let dbConfig;

if (dbUrl && dbUrl.includes('tidbcloud')) {
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
  console.log('🔍 Starting comprehensive puzzle verification...\n');
  
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    // Get count of all puzzles
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM puzzles');
    results.total = count;
    console.log(`Found ${count.toLocaleString()} puzzles to verify...\n`);
    
    // Process in batches to avoid memory issues
    const batchSize = 10000;
    let processedCount = 0;
    
    // Process puzzles in batches
    for (let offset = 0; offset < count; offset += batchSize) {
      const [puzzles] = await connection.query(
        'SELECT id, fen, moves FROM puzzles LIMIT ? OFFSET ?',
        [batchSize, offset]
      );
      
      if (puzzles.length === 0) break;
      
      // Verify each puzzle in batch
      for (const puzzle of puzzles) {
        const verification = await verifyPuzzle(puzzle);
        
        if (verification.status === 'working') {
          results.working++;
        } else {
          results.broken++;
          // Only store first 1000 broken puzzles to avoid memory issues
          if (results.brokenPuzzles.length < 1000) {
            results.brokenPuzzles.push({
              id: puzzle.id,
              fen: puzzle.fen,
              moves: puzzle.moves,
              reason: verification.reason
            });
          }
        }
        
        processedCount++;
      }
      
      // Progress indicator every 50,000 puzzles
      if (processedCount % 50000 === 0) {
        const percentage = Math.round((processedCount / count) * 100);
        const elapsed = (new Date() - results.startTime) / 1000;
        const rate = (processedCount / elapsed).toFixed(0);
        const remaining = ((count - processedCount) / rate / 60).toFixed(1);
        console.log(`Progress: ${processedCount.toLocaleString()}/${count.toLocaleString()} (${percentage}%) - Working: ${results.working.toLocaleString()}, Broken: ${results.broken.toLocaleString()} - Rate: ${rate} puzzles/sec - ETA: ${remaining}min`);
      }
    }
    
    // Generate report
    results.endTime = new Date();
    const duration = (results.endTime - results.startTime) / 1000;
    const workingPercentage = ((results.working / results.total) * 100).toFixed(2);
    const brokenPercentage = ((results.broken / results.total) * 100).toFixed(2);
    
    const report = `
╔════════════════════════════════════════════════════════════╗
║    COMPREHENSIVE PUZZLE VERIFICATION REPORT                ║
║              5.4 Million Puzzles Tested                     ║
╚════════════════════════════════════════════════════════════╝

📊 STATISTICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Puzzles Tested:     ${results.total.toLocaleString()}
✅ Working Puzzles:       ${results.working.toLocaleString()} (${workingPercentage}%)
❌ Broken Puzzles:        ${results.broken.toLocaleString()} (${brokenPercentage}%)
⏱️  Verification Time:     ${(duration / 60).toFixed(2)} minutes
⚡ Average Speed:         ${(results.total / duration).toFixed(0)} puzzles/second
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 BROKEN PUZZLES (First 50 of ${results.broken.toLocaleString()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${results.brokenPuzzles.slice(0, 50).map((p, i) => `
${i + 1}. Puzzle ID: ${p.id}
   Reason: ${p.reason}
   FEN: ${p.fen}
   Moves: ${p.moves}
`).join('')}

${results.brokenPuzzles.length > 50 ? `... and ${results.broken - 50} more broken puzzles\n` : ''}

📋 RECOMMENDATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Delete ${results.broken.toLocaleString()} broken puzzles from database
2. Keep ${results.working.toLocaleString()} working puzzles
3. Success Rate: ${workingPercentage}%
4. Data Quality: ${workingPercentage > 90 ? '✅ ACCEPTABLE' : workingPercentage > 50 ? '⚠️  NEEDS IMPROVEMENT' : '❌ CRITICAL - REBUILD REQUIRED'}

Generated: ${new Date().toISOString()}
Verification Duration: ${(duration / 60).toFixed(2)} minutes
`;

    console.log(report);
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'puzzle-verification-full-report.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n✅ Report saved to: ${reportPath}`);
    
    // Save broken puzzles to JSON for easy processing
    const brokenPath = path.join(process.cwd(), 'broken-puzzles-full.json');
    fs.writeFileSync(brokenPath, JSON.stringify(results.brokenPuzzles, null, 2));
    console.log(`📄 Broken puzzles saved to: ${brokenPath}`);
    
    // Save summary
    const summary = {
      total: results.total,
      working: results.working,
      broken: results.broken,
      workingPercentage: parseFloat(workingPercentage),
      brokenPercentage: parseFloat(brokenPercentage),
      durationSeconds: duration,
      durationMinutes: (duration / 60).toFixed(2),
      averageSpeed: (results.total / duration).toFixed(0),
      timestamp: new Date().toISOString()
    };
    
    const summaryPath = path.join(process.cwd(), 'puzzle-verification-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`📊 Summary saved to: ${summaryPath}`);
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    results.errors.push(error.message);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
