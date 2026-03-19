import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample opening positions and puzzle data
const openings = [
  { name: 'Sicilian Defense', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2', eco: 'B20' },
  { name: 'Sicilian Najdorf', fen: 'rnbqkbnr/pp3ppp/4p3/2ppP3/2P5/8/PP1P1PPP/RNBQKBNR w KQkq - 0 4', eco: 'B90' },
  { name: 'Sicilian Accelerated Dragon', fen: 'rnbqkbnr/pp2pppp/8/2pp4/2P5/8/PP1PPPPP/RNBQKBNR w KQkq d6 0 3', eco: 'B37' },
  { name: 'Sicilian Closed', fen: 'rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR w KQkq c6 0 2', eco: 'A82' },
  { name: 'Italian Game', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq e6 0 3', eco: 'C50' },
  { name: 'Italian Game Two Knights Defense', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 3', eco: 'C55' },
  { name: 'Italian Game Giuoco Piano', fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 1 4', eco: 'C50' },
  { name: 'Four Knights Game', fen: 'r1bqkbnr/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R w KQkq - 4 4', eco: 'C47' },
  { name: 'Four Knights Scotch', fen: 'r1bqkbnr/pppp1ppp/2n2n2/4p3/4P3/3P1N2/PPP2PPP/RNBQKB1R b KQkq - 0 4', eco: 'C48' },
  { name: 'French Defense', fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', eco: 'C00' },
  { name: 'French Winawer', fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', eco: 'C01' },
  { name: 'French Tarrasch', fen: 'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq d3 0 3', eco: 'C04' },
  { name: 'Caro-Kann Defense', fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', eco: 'B10' },
  { name: 'Caro-Kann Main Line', fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', eco: 'B12' },
  { name: 'Scandinavian Defense', fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2', eco: 'B01' },
  { name: 'Ruy Lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4', eco: 'C60' },
  { name: 'Ruy Lopez Morphy Defense', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4', eco: 'C79' },
  { name: 'Ruy Lopez Open', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 4', eco: 'C80' },
  { name: 'Alekhine Defense', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1', eco: 'B02' },
  { name: 'Pirc Defense', fen: 'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', eco: 'B06' },
];

// Generate puzzle data
function generatePuzzles(count = 1000) {
  const puzzles = [];
  const puzzleIds = new Set();
  
  for (let i = 0; i < count; i++) {
    const opening = openings[i % openings.length];
    const puzzleId = `puzzle_${Date.now()}_${i}`;
    
    if (puzzleIds.has(puzzleId)) continue;
    puzzleIds.add(puzzleId);
    
    // Generate random rating between 800 and 2400
    const rating = Math.floor(Math.random() * 1600) + 800;
    
    // Generate random moves (simplified - just sample moves)
    const moves = ['e4', 'c5', 'Nf3', 'd6', 'Be2', 'Nf6', 'O-O', 'e6', 'Nc3', 'Be7', 'f4', 'O-O', 'a4', 'Nc6', 'Be3', 'a6', 'Qe1', 'Nh7', 'Qg3', 'e5', 'fxe5', 'dxe5', 'Nd5', 'Nxd5', 'exd5', 'Qxd5', 'Qxg7'].slice(0, Math.floor(Math.random() * 15) + 5).join(' ');
    
    // Random themes
    const themes = ['endgame', 'middlegame', 'opening', 'tactics', 'strategy', 'sacrifice', 'pin', 'fork', 'skewer'][Math.floor(Math.random() * 9)];
    
    puzzles.push({
      id: puzzleId,
      fen: opening.fen,
      moves,
      rating,
      themes,
      openingName: opening.name,
      eco: opening.eco,
    });
  }
  
  return puzzles;
}

// Generate CSV format
function generateCSV(puzzles) {
  const header = 'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,Themes,GameUrl\n';
  const rows = puzzles.map(p => 
    `${p.id},"${p.fen}","${p.moves}",${p.rating},100,50,"${p.themes}","https://lichess.org/puzzle/${p.id}"`
  ).join('\n');
  
  return header + rows;
}

// Main
const puzzles = generatePuzzles(5000); // Generate 5000 sample puzzles
const csv = generateCSV(puzzles);
const outputPath = path.join(__dirname, 'puzzles-sample.csv');

fs.writeFileSync(outputPath, csv, 'utf-8');
console.log(`✅ Generated ${puzzles.length} sample puzzles`);
console.log(`📁 Saved to: ${outputPath}`);
console.log(`\n📊 Opening distribution:`);

const openingCounts = {};
puzzles.forEach(p => {
  openingCounts[p.openingName] = (openingCounts[p.openingName] || 0) + 1;
});

Object.entries(openingCounts).forEach(([name, count]) => {
  console.log(`   ${name}: ${count} puzzles`);
});

console.log(`\n🚀 To import these puzzles, run:`);
console.log(`   node server/import-puzzles.mjs ${outputPath} lichess`);
