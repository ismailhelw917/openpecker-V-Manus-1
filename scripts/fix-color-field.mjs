#!/usr/bin/env node
/**
 * Fix inverted color field in puzzles table.
 * The color field currently represents whose turn it is in the FEN (the opponent's setup move),
 * but it should represent the user's color (who plays after the setup move).
 * 
 * Strategy: Use temp values to avoid conflicts during swap.
 * Step 1: white -> temp_black (in batches)
 * Step 2: black -> white (in batches)  
 * Step 3: temp_black -> black (in batches)
 */

import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const BATCH_SIZE = 100000;

async function main() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // Check current state
    const [rows] = await connection.execute('SELECT color, COUNT(*) as cnt FROM puzzles GROUP BY color');
    console.log('Current color distribution:', rows);
    
    // Step 1: white -> temp_black
    console.log('\nStep 1: Converting white -> temp_black...');
    let totalConverted = 0;
    while (true) {
      const [result] = await connection.execute(
        `UPDATE puzzles SET color = 'temp_black' WHERE color = 'white' LIMIT ${BATCH_SIZE}`
      );
      const affected = result.affectedRows;
      totalConverted += affected;
      console.log(`  Batch: ${affected} rows (total: ${totalConverted})`);
      if (affected < BATCH_SIZE) break;
    }
    
    // Step 2: black -> white
    console.log('\nStep 2: Converting black -> white...');
    totalConverted = 0;
    while (true) {
      const [result] = await connection.execute(
        `UPDATE puzzles SET color = 'white' WHERE color = 'black' LIMIT ${BATCH_SIZE}`
      );
      const affected = result.affectedRows;
      totalConverted += affected;
      console.log(`  Batch: ${affected} rows (total: ${totalConverted})`);
      if (affected < BATCH_SIZE) break;
    }
    
    // Step 3: temp_black -> black
    console.log('\nStep 3: Converting temp_black -> black...');
    totalConverted = 0;
    while (true) {
      const [result] = await connection.execute(
        `UPDATE puzzles SET color = 'black' WHERE color = 'temp_black' LIMIT ${BATCH_SIZE}`
      );
      const affected = result.affectedRows;
      totalConverted += affected;
      console.log(`  Batch: ${affected} rows (total: ${totalConverted})`);
      if (affected < BATCH_SIZE) break;
    }
    
    // Verify
    const [finalRows] = await connection.execute('SELECT color, COUNT(*) as cnt FROM puzzles GROUP BY color');
    console.log('\nFinal color distribution:', finalRows);
    
    // Verify specific puzzles
    const [verify] = await connection.execute(
      "SELECT id, fen, color FROM puzzles WHERE id IN ('00008', '0000D', '0008Q')"
    );
    console.log('\nVerification (should be: 00008=white, 0000D=black, 0008Q=black):');
    for (const row of verify) {
      const fenTurn = row.fen.split(' ')[1]; // 'w' or 'b'
      const userColor = fenTurn === 'w' ? 'black' : 'white'; // User plays opposite of FEN turn
      console.log(`  ${row.id}: color=${row.color}, FEN turn=${fenTurn}, expected user color=${userColor}, correct=${row.color === userColor}`);
    }
    
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
