#!/usr/bin/env node

import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

// Top 50 most popular chess openings
const TOP_50_OPENINGS = [
  { name: 'Sicilian Defense', eco: 'B20' },
  { name: 'French Defense', eco: 'C00' },
  { name: 'Caro-Kann Defense', eco: 'B10' },
  { name: 'Italian Game', eco: 'C50' },
  { name: 'Spanish Opening', eco: 'C60' },
  { name: 'Four Knights Game', eco: 'C48' },
  { name: 'Scotch Game', eco: 'C45' },
  { name: 'Vienna Game', eco: 'C25' },
  { name: 'Kings Indian Defense', eco: 'E60' },
  { name: 'Nimzo-Indian Defense', eco: 'E20' },
  { name: 'Queens Indian Defense', eco: 'E12' },
  { name: 'Benko Gambit', eco: 'A56' },
  { name: 'Catalan Opening', eco: 'E04' },
  { name: 'Reti Opening', eco: 'A04' },
  { name: 'English Opening', eco: 'A10' },
  { name: 'Bird Opening', eco: 'A02' },
  { name: 'Sokolsky Opening', eco: 'A00' },
  { name: 'Scandinavian Defense', eco: 'B01' },
  { name: 'Alekhine Defense', eco: 'B02' },
  { name: 'Pirc Defense', eco: 'B06' },
  { name: 'Modern Defense', eco: 'B06' },
  { name: 'Grunfeld Defense', eco: 'D70' },
  { name: 'Semi-Slav Defense', eco: 'D45' },
  { name: 'Slav Defense', eco: 'D10' },
  { name: 'Closed Game', eco: 'D00' },
  { name: 'Queens Gambit', eco: 'D04' },
  { name: 'Benoni Defense', eco: 'A70' },
  { name: 'Orangutan Opening', eco: 'A00' },
  { name: 'Trompowsky Attack', eco: 'A45' },
  { name: 'Larsen Opening', eco: 'A01' },
  { name: 'Ware Opening', eco: 'A00' },
  { name: 'Meadow Hay Opening', eco: 'A00' },
  { name: 'Amar Opening', eco: 'A00' },
  { name: 'Borg Opening', eco: 'A00' },
  { name: 'Durkin Opening', eco: 'A00' },
  { name: 'Grob Opening', eco: 'A00' },
  { name: 'Mieses Opening', eco: 'A00' },
  { name: 'Lemoine Opening', eco: 'A00' },
  { name: 'Saragossa Opening', eco: 'C00' },
  { name: 'Philidor Defense', eco: 'C16' },
  { name: 'Petroff Defense', eco: 'C42' },
  { name: 'Three Knights Opening', eco: 'C46' },
  { name: 'Bishops Opening', eco: 'C23' },
  { name: 'Danish Gambit', eco: 'C21' },
  { name: 'Center Game', eco: 'C20' },
  { name: 'Kings Gambit', eco: 'C30' },
  { name: 'Falkbeer Countergambit', eco: 'C31' },
  { name: 'Evans Gambit', eco: 'C51' },
  { name: 'Two Knights Defense', eco: 'C55' },
  { name: 'Giuoco Piano', eco: 'C50' }
];

async function fetchPuzzles(opening) {
  try {
    console.log(`📥 Fetching puzzles for ${opening.name} (${opening.eco})...`);
    
    // Fetch from Lichess puzzle API
    const url = `https://lichess.org/api/puzzles/search?opening=${opening.eco}&sort=rating&order=asc&max=10`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson',
        'User-Agent': 'OpenPecker/1.0'
      },
      timeout: 10000
    });

    if (!response.ok) {
      console.log(`⚠️  Status ${response.status} for ${opening.eco}`);
      return [];
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    const puzzles = [];
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.puzzle) {
          puzzles.push({
            id: data.puzzle.id,
            fen: data.puzzle.fen,
            moves: data.puzzle.moves.join(' '),
            rating: data.puzzle.rating,
            opening_name: opening.name,
            opening_variation: opening.eco,
            themes: (data.puzzle.themes || []).join(',')
          });
        }
      } catch (e) {
        // Skip malformed lines
      }
    }

    console.log(`✓ Fetched ${puzzles.length} puzzles for ${opening.name}`);
    return puzzles;
  } catch (error) {
    console.error(`✗ Error fetching ${opening.name}:`, error.message);
    return [];
  }
}

async function populateDatabase(allPuzzles) {
  try {
    console.log(`\n💾 Populating database with ${allPuzzles.length} puzzles...`);
    
    // Create SQL INSERT statements
    const values = allPuzzles.map(p => {
      const id = `'${p.id.replace(/'/g, "''")}'`;
      const fen = `'${p.fen.replace(/'/g, "''")}'`;
      const moves = `'${p.moves.replace(/'/g, "''")}'`;
      const rating = p.rating;
      const opening_name = `'${p.opening_name.replace(/'/g, "''")}'`;
      const opening_variation = `'${p.opening_variation.replace(/'/g, "''")}'`;
      const themes = `'${p.themes.replace(/'/g, "''")}'`;
      
      return `(${id}, ${fen}, ${moves}, ${rating}, ${opening_name}, ${opening_variation}, ${themes})`;
    }).join(',\n');

    const sql = `
      DELETE FROM puzzles;
      INSERT INTO puzzles (id, fen, moves, rating, opening_name, opening_variation, themes) 
      VALUES
      ${values};
    `;

    // Execute SQL
    const { stdout, stderr } = await execAsync(`mysql -h ${process.env.DB_HOST || 'localhost'} -u ${process.env.DB_USER || 'root'} ${process.env.DB_PASSWORD ? `-p${process.env.DB_PASSWORD}` : ''} ${process.env.DB_NAME || 'openpecker'} << 'EOF'\n${sql}\nEOF`, {
      maxBuffer: 10 * 1024 * 1024
    });

    if (stderr && !stderr.includes('Using a password')) {
      console.error('Database error:', stderr);
      return false;
    }

    console.log(`✅ Database populated successfully`);
    return true;
  } catch (error) {
    console.error('✗ Database population failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Starting puzzle population...\n');
  
  const allPuzzles = [];
  
  for (let i = 0; i < TOP_50_OPENINGS.length; i++) {
    const opening = TOP_50_OPENINGS[i];
    const puzzles = await fetchPuzzles(opening);
    allPuzzles.push(...puzzles);
    
    // Rate limiting
    if (i < TOP_50_OPENINGS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n📊 Total puzzles fetched: ${allPuzzles.length}`);
  
  if (allPuzzles.length > 0) {
    const success = await populateDatabase(allPuzzles);
    if (success) {
      console.log('\n✨ Puzzle population complete!');
      process.exit(0);
    }
  }
  
  process.exit(1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
