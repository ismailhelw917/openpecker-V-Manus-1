#!/usr/bin/env node

import fetch from 'node-fetch';
import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Top 50 most popular chess openings by ECO code
const TOP_50_OPENINGS = [
  'C20', 'C21', 'C22', 'C23', 'C24', // Italian Game
  'C25', 'C26', 'C27', 'C28', 'C29', // Vienna Game
  'C30', 'C31', 'C32', 'C33', 'C34', // King's Indian Attack
  'C35', 'C36', 'C37', 'C38', 'C39', // Goring Gambit
  'C40', 'C41', 'C42', 'C43', 'C44', // Scandinavian
  'C45', 'C46', 'C47', 'C48', 'C49', // Three Knights
  'B20', 'B21', 'B22', 'B23', 'B24', // Sicilian Defense
  'B25', 'B26', 'B27', 'B28', 'B29', // Sicilian Closed
  'B30', 'B31', 'B32', 'B33', 'B34', // Sicilian Najdorf
  'B35', 'B36', 'B37', 'B38', 'B39', // Sicilian Dragon
  'A04', 'A05', 'A06', 'A07', 'A08', // Reti Opening
];

async function fetchPuzzlesFromLichess(eco) {
  try {
    // Lichess puzzle API endpoint
    const url = `https://lichess.org/api/puzzles/search?opening=${eco}&sort=rating&order=asc&max=10`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/x-ndjson',
        'User-Agent': 'OpenPecker/1.0'
      }
    });

    if (!response.ok) {
      console.log(`⚠️  No puzzles found for ECO ${eco}`);
      return [];
    }

    const text = await response.text();
    const lines = text.trim().split('\n');
    const puzzles = lines
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(p => p !== null);

    console.log(`✓ Fetched ${puzzles.length} puzzles for ECO ${eco}`);
    return puzzles;
  } catch (error) {
    console.error(`✗ Error fetching puzzles for ${eco}:`, error.message);
    return [];
  }
}

async function convertPuzzleFormat(lichessPuzzle) {
  // Convert Lichess puzzle format to our format
  return {
    id: lichessPuzzle.puzzle.id,
    fen: lichessPuzzle.puzzle.fen,
    moves: lichessPuzzle.puzzle.moves.join(' '), // Space-separated UCI moves
    rating: lichessPuzzle.puzzle.rating,
    popularity: lichessPuzzle.puzzle.popularity || 0,
    opening_name: lichessPuzzle.game?.opening?.name || 'Unknown',
    opening_variation: lichessPuzzle.game?.opening?.eco || '',
    themes: (lichessPuzzle.puzzle.themes || []).join(',')
  };
}

async function populateDatabase() {
  const connection = await createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'openpecker'
  });

  try {
    // Clear existing puzzles
    console.log('🗑️  Clearing existing puzzles...');
    await connection.execute('DELETE FROM puzzles');
    console.log('✓ Puzzles cleared');

    let totalPuzzles = 0;

    // Fetch puzzles for each ECO code
    for (const eco of TOP_50_OPENINGS) {
      console.log(`\n📥 Fetching puzzles for ECO ${eco}...`);
      
      const lichessPuzzles = await fetchPuzzlesFromLichess(eco);
      
      for (const lichessPuzzle of lichessPuzzles) {
        const puzzle = await convertPuzzleFormat(lichessPuzzle);
        
        try {
          await connection.execute(
            `INSERT INTO puzzles 
             (id, fen, moves, rating, opening_name, opening_variation, themes)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              puzzle.id,
              puzzle.fen,
              puzzle.moves,
              puzzle.rating,
              puzzle.opening_name,
              puzzle.opening_variation,
              puzzle.themes
            ]
          );
          totalPuzzles++;
        } catch (error) {
          console.error(`✗ Error inserting puzzle ${puzzle.id}:`, error.message);
        }
      }

      // Rate limit: 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✅ Successfully populated database with ${totalPuzzles} puzzles`);
  } finally {
    await connection.end();
  }
}

// Run the population script
populateDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
