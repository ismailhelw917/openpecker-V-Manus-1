#!/usr/bin/env node

/**
 * Parallel Puzzle Generation Worker
 * 
 * Generates 1000 puzzles for a single opening
 * Designed to be run in parallel for multiple openings
 */

import mysql from 'mysql2/promise';
import { Chess } from 'chess.js';

const openingData = JSON.parse(process.argv[2]);

async function getConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set');
  
  const url = new URL(dbUrl);
  return await mysql.createConnection({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: url.port || 3306,
    ssl: { rejectUnauthorized: false },
  });
}

function generatePuzzleFromFen(fen, openingName, subset, variation, puzzleIndex) {
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    
    if (moves.length === 0) return null;
    
    const solutionMove = moves[Math.floor(Math.random() * moves.length)];
    chess.move(solutionMove);
    
    const moveCount = Math.floor(Math.random() * 3) + 1;
    const allMoves = [solutionMove.san];
    
    for (let i = 0; i < moveCount; i++) {
      const nextMoves = chess.moves({ verbose: true });
      if (nextMoves.length === 0) break;
      const nextMove = nextMoves[Math.floor(Math.random() * nextMoves.length)];
      allMoves.push(nextMove.san);
      chess.move(nextMove);
    }
    
    const puzzleId = `puzzle_${openingName.replace(/\s+/g, '_')}_${subset.replace(/\s+/g, '_')}_${puzzleIndex}`;
    const rating = 800 + Math.floor(Math.random() * 1600);
    const themes = ['tactic', 'strategy', 'endgame', 'opening', 'middlegame'][Math.floor(Math.random() * 5)];
    
    return {
      id: puzzleId,
      fen: fen,
      moves: allMoves.join(' '),
      rating: rating,
      themes: themes,
      opening: openingName,
      subset: subset,
      variation: variation,
    };
  } catch (error) {
    return null;
  }
}

async function generatePuzzlesForOpening() {
  const connection = await getConnection();
  
  try {
    const { name, fen, ecoCode } = openingData;
    const puzzlesPerSubset = 143;
    const subsets = ['Main Line', 'Aggressive', 'Defensive', 'Positional', 'Tactical', 'Endgame', 'Rare Variation'];
    const variations = ['Variation A', 'Variation B', 'Variation C', 'Variation D', 'Variation E'];
    
    let inserted = 0;
    let errors = 0;
    
    for (let subsetIdx = 0; subsetIdx < subsets.length; subsetIdx++) {
      const subset = subsets[subsetIdx];
      
      for (let puzzleIdx = 0; puzzleIdx < puzzlesPerSubset; puzzleIdx++) {
        const variation = variations[puzzleIdx % variations.length];
        
        const puzzle = generatePuzzleFromFen(fen, name, subset, variation, puzzleIdx);
        
        if (puzzle) {
          try {
            await connection.query(
              `INSERT INTO puzzles (id, fen, moves, rating, themes, opening, subset, variation) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [puzzle.id, puzzle.fen, puzzle.moves, puzzle.rating, puzzle.themes, puzzle.opening, puzzle.subset, puzzle.variation]
            );
            inserted++;
          } catch (error) {
            if (!error.message.includes('Duplicate entry')) {
              errors++;
            }
          }
        } else {
          errors++;
        }
      }
    }
    
    console.log(JSON.stringify({ opening: name, inserted, errors, total: puzzlesPerSubset * subsets.length }));
    
  } finally {
    await connection.end();
  }
}

generatePuzzlesForOpening().catch(error => {
  console.error(JSON.stringify({ error: error.message }));
  process.exit(1);
});
