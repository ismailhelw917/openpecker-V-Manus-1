#!/usr/bin/env node

/**
 * Merge duplicate opening names in the puzzles table
 * Handles variations like:
 * - "Bird Opening" → "Bird's Opening"
 * - "Alekhine Defense" → "Alekhines Defense"
 * - Removes apostrophes and normalizes spacing
 */

import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'openpecker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Mapping of non-canonical names to canonical names
const openingMappings = {
  // Bird's Opening variations
  'Bird Opening': "Bird's Opening",
  'Birds Opening': "Bird's Opening",
  
  // Alekhine Defense variations
  'Alekhine Defense': "Alekhine's Defense",
  'Alekhines Defense': "Alekhine's Defense",
  
  // Anderson's Opening variations
  'Anderssens Opening': "Anderson's Opening",
  'Anderson Opening': "Anderson's Opening",
  
  // Benko Gambit - keep as is, but check for variations
  // (already has Accepted/Declined variants)
  
  // Add more mappings as needed
};

async function mergeOpenings() {
  const conn = await pool.getConnection();
  
  try {
    console.log('Starting opening name merge...\n');
    
    let totalUpdated = 0;
    
    for (const [oldName, newName] of Object.entries(openingMappings)) {
      try {
        // Count puzzles with the old name
        const [rows] = await conn.query(
          'SELECT COUNT(*) as count FROM puzzles WHERE openingName = ?',
          [oldName]
        );
        const count = rows[0].count;
        
        if (count > 0) {
          // Update all puzzles with the old name to the new name
          await conn.query(
            'UPDATE puzzles SET openingName = ? WHERE openingName = ?',
            [newName, oldName]
          );
          
          console.log(`✓ Merged "${oldName}" → "${newName}" (${count} puzzles)`);
          totalUpdated += count;
        }
      } catch (error) {
        console.error(`✗ Error merging "${oldName}":`, error.message);
      }
    }
    
    console.log(`\n✓ Total puzzles updated: ${totalUpdated}`);
    console.log('✓ Opening name merge complete!');
    
    // Verify the merge
    const [finalRows] = await conn.query(
      'SELECT COUNT(DISTINCT openingName) as unique_openings FROM puzzles'
    );
    console.log(`\nUnique openings after merge: ${finalRows[0].unique_openings}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await conn.release();
    await pool.end();
  }
}

mergeOpenings().catch(console.error);
