#!/usr/bin/env node
/**
 * Build-time script to generate hierarchy.json from database
 * Run this before building to embed the hierarchy in the bundle
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

    // Query hierarchy with counts
    const [rows] = await connection.execute(`
      SELECT opening, subset, variation, COUNT(*) as puzzleCount
      FROM puzzles
      WHERE opening IS NOT NULL 
        AND opening != ''
        AND subset IS NOT NULL 
        AND subset != ''
        AND variation IS NOT NULL 
        AND variation != ''
      GROUP BY opening, subset, variation
      ORDER BY opening ASC, subset ASC, variation ASC
    `);

    await connection.end();

    console.log(`[GenerateHierarchy] Fetched ${rows.length} hierarchy items`);

    // Write to file
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(rows, null, 2));

    const fileSize = fs.statSync(OUTPUT_PATH).size;
    console.log(`[GenerateHierarchy] Written to ${OUTPUT_PATH} (${(fileSize / 1024).toFixed(2)}KB)`);
    console.log('[GenerateHierarchy] Done!');
  } catch (error) {
    console.error('[GenerateHierarchy] Error:', error);
    process.exit(1);
  }
}

generateHierarchy();
