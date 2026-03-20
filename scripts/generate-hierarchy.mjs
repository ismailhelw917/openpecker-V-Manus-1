#!/usr/bin/env node
/**
 * Build-time script to generate hierarchy.json from database
 * Parses openingName and openingVariation to create proper hierarchy
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../client/public/hierarchy.json');

async function generateHierarchy() {
  console.log('[GenerateHierarchy] Starting...');

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[GenerateHierarchy] DATABASE_URL not set');
    process.exit(1);
  }

  try {
    const connection = await mysql.createConnection(dbUrl);
    console.log('[GenerateHierarchy] Connected to database');

    // Get all distinct opening/variation combinations with counts
    const [rows] = await connection.execute(`
      SELECT 
        openingName,
        openingVariation,
        COUNT(*) as puzzleCount
      FROM puzzles
      WHERE openingName IS NOT NULL 
        AND openingName != ''
        AND openingVariation IS NOT NULL 
        AND openingVariation != ''
      GROUP BY openingName, openingVariation
      ORDER BY openingName ASC, openingVariation ASC
    `);

    await connection.end();

    console.log(`[GenerateHierarchy] Fetched ${rows.length} hierarchy items`);

    // Parse the hierarchy to extract opening, subset, and variation
    // First, calculate total puzzles per opening
    const openingTotals = {};
    rows.forEach(row => {
      if (!openingTotals[row.openingName]) {
        openingTotals[row.openingName] = 0;
      }
      openingTotals[row.openingName] += row.puzzleCount;
    });

    const MIN_PUZZLES = 20;
    const filteredRows = rows.filter(row => openingTotals[row.openingName] >= MIN_PUZZLES);
    console.log(`[GenerateHierarchy] Filtered from ${rows.length} to ${filteredRows.length} items (min ${MIN_PUZZLES} puzzles per opening)`);

    // Parse the hierarchy to extract opening, subset, and variation
    const hierarchy = filteredRows.map(row => {
      const { openingName, openingVariation, puzzleCount } = row;
      
      // Parse openingVariation format: "Type OpeningName Type VariationName"
      // Example: "Defense Alekhine Defense Four Pawns Attack"
      // Example: "Opening Amar Opening Paris Gambit"
      
      let subset = null;
      let variation = null;
      
      // Split by the opening name to extract the variation part
      const parts = openingVariation.split(openingName);
      
      if (parts.length >= 2) {
        // Get the part after the opening name
        const afterOpening = parts[1].trim();
        
        // Split by space to get type and variation name
        const words = afterOpening.split(/\s+/);
        
        if (words.length >= 2) {
          // First word is the type (Defense, Opening, etc.)
          const type = words[0];
          // Rest is the variation name
          const variationName = words.slice(1).join(' ');
          
          subset = type;
          variation = variationName;
        } else if (words.length === 1) {
          // Only type, no variation name
          subset = words[0];
          variation = null;
        }
      }
      
      return {
        opening: openingName,
        subset: subset,
        variation: variation,
        puzzleCount: parseInt(puzzleCount, 10),
      };
    });

    // Write to file
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(hierarchy, null, 2));

    const fileSize = fs.statSync(OUTPUT_PATH).size;
    console.log(`[GenerateHierarchy] Written to ${OUTPUT_PATH} (${(fileSize / 1024).toFixed(2)}KB)`);
    console.log(`[GenerateHierarchy] Total items: ${hierarchy.length}`);
    
    // Count unique openings
    const uniqueOpenings = new Set(hierarchy.map(h => h.opening)).size;
    console.log(`[GenerateHierarchy] Unique openings: ${uniqueOpenings}`);
    
    // Log sample items for verification
    console.log('[GenerateHierarchy] Sample items:');
    hierarchy.slice(0, 5).forEach(item => {
      console.log(`  - ${item.opening} > ${item.subset} > ${item.variation} (${item.puzzleCount} puzzles)`);
    });
    
    // Log removed openings
    const removedOpenings = Object.entries(openingTotals)
      .filter(([_, count]) => count < MIN_PUZZLES)
      .map(([name, count]) => `${name} (${count})`)
      .slice(0, 10);
    if (removedOpenings.length > 0) {
      console.log(`[GenerateHierarchy] Removed openings (first 10): ${removedOpenings.join(', ')}`);
    }
    
    console.log('[GenerateHierarchy] Done!');
  } catch (error) {
    console.error('[GenerateHierarchy] Error:', error);
    process.exit(1);
  }
}

generateHierarchy();
