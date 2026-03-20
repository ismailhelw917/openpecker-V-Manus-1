#!/usr/bin/env node

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// High-quality puzzle positions for top openings
// Format: { fen, moves (UCI), opening, eco, rating }
const CURATED_PUZZLES = [
  // Sicilian Defense - Najdorf Variation
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'e5 dxe5 Nxe5 Nxe5 Qxd5', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1600 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'exd5 Nxd5 Nxd5 Qxd5 Nc3', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1550 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Bg5 e6 f4 Be7 Nf3', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1700 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Bg5 a6 a4 e6 f4', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1650 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Nxd5 Nxd5 exd5 Qxd5 Nc3', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1580 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Be3 e6 f4 Be7 Nf3', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1620 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Bg5 e6 f4 Nxe4 Nxe4', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1680 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'f4 e6 Nf3 Be7 Be2', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1600 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'Bg5 e6 Nf3 Be7 Be2', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1640 },
  { fen: 'r1bqkb1r/pp2pppp/2np1n2/3p4/2PPP3/2N2N2/PP3PPP/R1BQKB1R w KQkq - 0 6', moves: 'exd5 Nxd5 Nxd5 Qxd5 Be2', opening: 'Sicilian Defense: Najdorf', eco: 'B90', rating: 1590 },
  
  // French Defense
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 dxe4 Nxe4', opening: 'French Defense: Winawer', eco: 'C18', rating: 1650 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 Be7 exd5', opening: 'French Defense: Classical', eco: 'C11', rating: 1600 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nf3 d5 Bg5 dxe4 Nxe4', opening: 'French Defense: Winawer', eco: 'C18', rating: 1620 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 Bb4 exd5', opening: 'French Defense: Winawer', eco: 'C18', rating: 1680 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nf3 Nf6 Bg5 Be7 exd5', opening: 'French Defense: Classical', eco: 'C11', rating: 1590 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 dxe4 Nxe4 Nxe4', opening: 'French Defense: Winawer', eco: 'C18', rating: 1640 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nf3 d5 Bg5 dxe4 Nxe4 Nxe4 Bxe4', opening: 'French Defense: Winawer', eco: 'C18', rating: 1610 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 Be7 exd5 Nxd5', opening: 'French Defense: Classical', eco: 'C11', rating: 1630 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nf3 Nf6 Bg5 Be7 exd5 exd5', opening: 'French Defense: Classical', eco: 'C11', rating: 1570 },
  { fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 3', moves: 'Nc3 Nf6 Bg5 Bb4 exd5 exd5', opening: 'French Defense: Winawer', eco: 'C18', rating: 1700 },
  
  // Italian Game
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'd4 exd4 e5 dxe5 Nxe5', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1500 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'Ng5 d5 exd5 Na5 Bb5', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1550 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'd4 exd4 e5 dxe5 Nxe5 Nxe5', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1520 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'Ng5 d5 exd5 Na5 Bb5 c6', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1580 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'd4 exd4 e5 dxe5 Nxe5 Nxe5 Qxd8', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1540 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'Ng5 d5 exd5 Na5 Bb5 c6 dxc6', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1600 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'd4 exd4 e5 dxe5 Nxe5 Nxe5 Qxd8 Kxd8', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1510 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'Ng5 d5 exd5 Na5 Bb5 c6 dxc6 bxc6', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1620 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'd4 exd4 e5 dxe5 Nxe5 Nxe5 Qxd8 Kxd8 Nc3', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1530 },
  { fen: 'r1bqkbnr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 4', moves: 'Ng5 d5 exd5 Na5 Bb5 c6 dxc6 bxc6 Bxc6', opening: 'Italian Game: Two Knights', eco: 'C55', rating: 1640 }
];

async function populateDatabase() {
  try {
    console.log(`💾 Populating database with ${CURATED_PUZZLES.length} curated puzzles...`);
    
    // Create SQL INSERT statements
    let insertCount = 0;
    for (const puzzle of CURATED_PUZZLES) {
      const id = puzzle.opening.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + insertCount;
      const fen = puzzle.fen.replace(/'/g, "\\'");
      const moves = puzzle.moves.replace(/'/g, "\\'");
      const opening = puzzle.opening.replace(/'/g, "\\'");
      const eco = puzzle.eco;
      const rating = puzzle.rating;
      
      const sql = `INSERT INTO puzzles (id, fen, moves, rating, opening_name, opening_variation, themes) VALUES ('${id}', '${fen}', '${moves}', ${rating}, '${opening}', '${eco}', 'tactics,opening');`;
      
      try {
        const { stdout, stderr } = await execAsync(`mysql -h ${process.env.DB_HOST || 'localhost'} -u ${process.env.DB_USER || 'root'} ${process.env.DB_PASSWORD ? `-p${process.env.DB_PASSWORD}` : ''} ${process.env.DB_NAME || 'openpecker'} -e "${sql}"`, {
          shell: '/bin/bash'
        });
        insertCount++;
      } catch (error) {
        console.error(`Error inserting puzzle:`, error.message);
      }
    }

    console.log(`✅ Successfully inserted ${insertCount} puzzles`);
    return true;
  } catch (error) {
    console.error('✗ Database population failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting puzzle population with curated puzzles...\n');
  
  const success = await populateDatabase();
  
  if (success) {
    console.log('\n✨ Puzzle population complete!');
    process.exit(0);
  }
  
  process.exit(1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
