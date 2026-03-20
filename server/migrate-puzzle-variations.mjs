#!/usr/bin/env node

/**
 * Migration script to populate puzzle variations from existing move data
 * Parses algebraic moves and builds variation trees for all puzzles
 */

import { createConnection } from 'mysql2/promise';
import { Chess } from 'chess.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ChessMove class (simplified from TypeScript)
class ChessMove {
  constructor(algebraicMove, evaluationScore = null, isBestMove = false) {
    this.algebraicMove = algebraicMove;
    this.evaluationScore = evaluationScore;
    this.isBestMove = isBestMove;
    this.nextMoves = [];
  }

  addNextMove(move) {
    this.nextMoves.push(move);
  }

  toJSON() {
    return {
      move: this.algebraicMove,
      eval: this.evaluationScore,
      best: this.isBestMove,
      variations: this.nextMoves.map(m => m.toJSON()),
    };
  }
}

// Parse moves from string
function parseMovesList(movesString) {
  if (!movesString) return [];
  
  const moves = movesString.split(/[,\s]+/).filter(m => m.length > 0);
  return moves.filter(m => !/^\d+\./.test(m));
}

// Build variation tree
function buildMoveTree(fen, moves) {
  if (moves.length === 0) return null;
  
  const root = new ChessMove(moves[0], null, true);
  let current = root;
  
  for (let i = 1; i < moves.length; i++) {
    const newNode = new ChessMove(moves[i], null, i === 1);
    current.addNextMove(newNode);
    current = newNode;
  }
  
  return root;
}

// Main migration
async function migrateVariations() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openpecker',
  });

  try {
    console.log('Starting puzzle variations migration...');
    
    // Get all puzzles
    const [puzzles] = await connection.query('SELECT id, fen, moves FROM puzzles LIMIT 100');
    console.log(`Found ${puzzles.length} puzzles to migrate`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const puzzle of puzzles) {
      try {
        const moves = parseMovesList(puzzle.moves);
        const tree = buildMoveTree(puzzle.fen, moves);
        
        if (tree) {
          const variationsJson = JSON.stringify(tree.toJSON());
          
          // Update puzzle with variations
          await connection.query(
            'UPDATE puzzles SET variations = ? WHERE id = ?',
            [variationsJson, puzzle.id]
          );
          
          updated++;
        }
        
        processed++;
        
        if (processed % 10 === 0) {
          console.log(`Progress: ${processed}/${puzzles.length} (${updated} updated, ${errors} errors)`);
        }
      } catch (error) {
        errors++;
        console.error(`Error processing puzzle ${puzzle.id}:`, error.message);
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`Total processed: ${processed}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors: ${errors}`);

  } finally {
    await connection.end();
  }
}

// Run migration
migrateVariations().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
