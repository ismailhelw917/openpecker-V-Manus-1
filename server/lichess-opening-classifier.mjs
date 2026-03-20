#!/usr/bin/env node

/**
 * Lichess Opening Classifier
 * 
 * Uses Lichess opening explorer API to accurately classify all puzzles
 * by their opening names, ECO codes, and variations.
 * 
 * API: https://lichess.org/api/opening?fen={fen}
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFile = '/tmp/lichess-classifier.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Lichess API helper
async function getOpeningFromLichess(fen) {
  try {
    const response = await fetch(`https://lichess.org/api/opening?fen=${encodeURIComponent(fen)}`, {
      headers: { 'Accept': 'application/json' },
      timeout: 5000,
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    // Silently fail - will use fallback
    return null;
  }
}

// Extract opening info from Lichess API response
function extractOpeningInfo(lichessData) {
  if (!lichessData) {
    return {
      opening: 'Unclassified',
      subset: 'Unclassified',
      variation: 'Unclassified',
      ecoCode: null,
    };
  }

  const opening = lichessData.opening?.name || 'Unclassified';
  const ecoCode = lichessData.opening?.eco || null;

  // Parse opening name into hierarchy
  // Example: "Sicilian Defense: Najdorf, 6.Bg5" 
  // → opening: "Sicilian Defense", subset: "Najdorf", variation: "6.Bg5"
  
  let subset = 'Main Line';
  let variation = 'Main Line';

  if (opening && opening.includes(':')) {
    const parts = opening.split(':');
    const mainOpening = parts[0].trim();
    const rest = parts[1].trim();

    if (rest.includes(',')) {
      const subParts = rest.split(',');
      subset = subParts[0].trim();
      variation = subParts.slice(1).join(',').trim();
    } else {
      subset = rest;
    }

    return {
      opening: mainOpening,
      subset: subset,
      variation: variation,
      ecoCode: ecoCode,
    };
  }

  return {
    opening: opening,
    subset: 'Main Line',
    variation: 'Main Line',
    ecoCode: ecoCode,
  };
}

// Database connection
async function getConnection() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL environment variable not set');
  }
  
  // Parse DATABASE_URL format: mysql://user:password@host:port/database
  const url = new URL(dbUrl);
  
  return await mysql.createConnection({
    host: url.hostname,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    port: url.port || 3306,
    ssl: {
      rejectUnauthorized: false,
    },
  });
}

// Main classification function
async function classifyAllPuzzles() {
  log('Starting Lichess opening classification...');
  
  const connection = await getConnection();
  
  try {
    // Get all puzzles
    const [puzzles] = await connection.query('SELECT id, fen FROM puzzles ORDER BY id');
    log(`Found ${puzzles.length} puzzles to classify`);

    let classified = 0;
    let unclassified = 0;
    let errors = 0;

    // Process puzzles in batches
    const batchSize = 10;
    for (let i = 0; i < puzzles.length; i += batchSize) {
      const batch = puzzles.slice(i, i + batchSize);
      
      const promises = batch.map(async (puzzle) => {
        try {
          // Get opening from Lichess API
          const lichessData = await getOpeningFromLichess(puzzle.fen);
          const openingInfo = extractOpeningInfo(lichessData);

          // Update puzzle with classification
          await connection.query(
            `UPDATE puzzles SET opening = ?, subset = ?, variation = ?, ecoCode = ? WHERE id = ?`,
            [
              openingInfo.opening,
              openingInfo.subset,
              openingInfo.variation,
              openingInfo.ecoCode,
              puzzle.id,
            ]
          );

          if (openingInfo.opening === 'Unclassified') {
            unclassified++;
          } else {
            classified++;
          }

          if ((classified + unclassified) % 100 === 0) {
            log(`Progress: ${classified + unclassified}/${puzzles.length} puzzles classified`);
          }
        } catch (error) {
          errors++;
          log(`Error classifying puzzle ${puzzle.id}: ${error.message}`);
        }
      });

      // Wait for batch to complete
      await Promise.all(promises);
      
      // Rate limit: wait 1 second between batches to avoid overwhelming Lichess API
      if (i + batchSize < puzzles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    log(`Classification complete!`);
    log(`Classified: ${classified}`);
    log(`Unclassified: ${unclassified}`);
    log(`Errors: ${errors}`);

    // Get opening distribution
    const [distribution] = await connection.query(`
      SELECT opening, COUNT(*) as count 
      FROM puzzles 
      GROUP BY opening 
      ORDER BY count DESC
    `);

    log('\nOpening Distribution:');
    distribution.forEach(row => {
      log(`  ${row.opening}: ${row.count} puzzles`);
    });

  } finally {
    await connection.end();
  }
}

// Run classification
classifyAllPuzzles().catch(error => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
