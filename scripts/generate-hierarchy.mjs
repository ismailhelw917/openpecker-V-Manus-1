#!/usr/bin/env node
/**
 * Build-time script to generate hierarchy.json from database
 * Normalizes opening names and creates 2-level hierarchy: Opening → Variation
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '../client/public/hierarchy.json');

// Mapping of abbreviated names to proper full names
const OPENING_NAME_MAP = {
  'Alekhine': "Alekhine's Defence",
  'Amar': 'Amar Opening',
  'Amazon': 'Amazon Attack',
  'Anderssens': "Anderssen's Opening",
  'Australian': 'Australian Opening',
  'Barnes': "Barnes Opening",
  'Benko': 'Benko Gambit',
  'Benoni': 'Benoni Defence',
  'Bird': "Bird's Opening",
  'Bishops': 'Bishops Opening',
  'Blackmar-Diemer': 'Blackmar-Diemer Gambit',
  'Blumenfeld': 'Blumenfeld Gambit',
  'Bogo-Indian': 'Bogo-Indian Defence',
  'Borg': 'Borg Opening',
  'Canard': 'Canard Opening',
  'Caro-Kann': 'Caro-Kann Defence',
  'Carr': 'Carr Opening',
  'Catalan': 'Catalan Opening',
  'Center': 'Center Game',
  'Clemenz': 'Clemenz Opening',
  'Crab': 'Crab Opening',
  'Creepy': 'Creepy Opening',
  'Czech': 'Czech Defence',
  'Danish': 'Danish Gambit',
  'Duras': 'Duras Opening',
  'Dutch': 'Dutch Defence',
  'East': 'East Indian Defence',
  'Elephant': 'Elephant Gambit',
  'English': 'English Opening',
  'Englund': 'Englund Gambit',
  'Four': 'Four Knights Game',
  'French': 'French Defence',
  'Fried': 'Fried Liver Attack',
  'Gedults': 'Gedults Opening',
  'Giuoco': 'Giuoco Piano',
  'Goldsmith': 'Goldsmith Game',
  'Grob': "Grob's Attack",
  'Grunfeld': 'Grunfeld Defence',
  'Guatemala': 'Guatemala Opening',
  'Gunderam': 'Gunderam Opening',
  'Hippopotamus': 'Hippopotamus Defence',
  'Horwitz': 'Horwitz Defence',
  'Hungarian': 'Hungarian Opening',
  'Indian': 'Indian Defence',
  'Italian': 'Italian Game',
  'Kadas': 'Kadas Opening',
  'Kangaroo': 'Kangaroo Opening',
  'Kings': "King's Indian Defence",
  'Lasker': "Lasker's Opening",
  'Latvian': 'Latvian Gambit',
  'Lemming': 'Lemming Defence',
  'Lion': 'Lion Opening',
  'London': 'London System',
  'Mexican': 'Mexican Opening',
  'Mieses': "Mieses' Opening",
  'Mikenas': "Mikenas' Opening",
  'Modern': 'Modern Defence',
  'Neo-Grunfeld': 'Neo-Grunfeld Defence',
  'Nimzo-Indian': 'Nimzo-Indian Defence',
  'Nimzo-Larsen': 'Nimzo-Larsen Attack',
  'Nimzowitsch': 'Nimzowitsch Defence',
  'Old': 'Old Indian Defence',
  'Owen': "Owen's Defence",
  'Paleface': 'Paleface Opening',
  'Petrovs': "Petrov's Defence",
  'Philidor': "Philidor's Defence",
  'Pirc': "Pirc's Defence",
  'Polish': 'Polish Opening',
  'Ponziani': 'Ponziani Opening',
  'Portuguese': 'Portuguese Opening',
  'Pseudo': 'Pseudo-Benoni',
  'Pterodactyl': 'Pterodactyl Defence',
  'Queens': "Queen's Gambit",
  'Rapport-Jobava': 'Rapport-Jobava System',
  'Rat': 'Rat Defence',
  'Reti': 'Reti Opening',
  'Richter-Veresov': 'Richter-Veresov Attack',
  'Robatsch': 'Robatsch Defence',
  'Rubinstein': "Rubinstein's Opening",
  'Russian': 'Russian Game',
  'Ruy': 'Ruy López',
  'Saragossa': 'Saragossa Opening',
  'Scandinavian': 'Scandinavian Defence',
  'Scotch': 'Scotch Game',
  'Semi-Slav': 'Semi-Slav Defence',
  'Sicilian': 'Sicilian Defence',
  'Slav': 'Slav Defence',
  'Sodium': 'Sodium Attack',
  'St': 'St. George Defence',
  'Tarrasch': 'Tarrasch Defence',
  'Three': 'Three Knights Game',
  'Torre': 'Torre Attack',
  'Trompowsky': 'Trompowsky Attack',
  'Unclassified': 'Unclassified',
  'Valencia': 'Valencia Opening',
  'Van': "Van't Kruijs Opening",
  'Vant': "Van't Kruijs Opening",
  'Vienna': 'Vienna Game',
  'Wade': 'Wade Defence',
  'Ware': 'Ware Opening',
  'Yusupov-Rubinstein': 'Yusupov-Rubinstein System',
  'Zukertort': "Zukertort's Opening",
};

function normalizeOpeningName(name) {
  return OPENING_NAME_MAP[name] || name;
}

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

    // Calculate total puzzles per opening
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

    // Build 2-level hierarchy: Opening → Variation
    // Group by opening, then list variations
    const hierarchyMap = {};
    
    filteredRows.forEach(row => {
      const normalizedOpening = normalizeOpeningName(row.openingName);
      
      if (!hierarchyMap[normalizedOpening]) {
        hierarchyMap[normalizedOpening] = {
          opening: normalizedOpening,
          variations: []
        };
      }
      
      hierarchyMap[normalizedOpening].variations.push({
        variation: row.openingVariation,
        puzzleCount: parseInt(row.puzzleCount, 10)
      });
    });

    // Convert to array and sort
    const hierarchy = Object.values(hierarchyMap)
      .map(item => ({
        opening: item.opening,
        puzzleCount: item.variations.reduce((sum, v) => sum + v.puzzleCount, 0),
        variations: item.variations.sort((a, b) => b.puzzleCount - a.puzzleCount)
      }))
      .sort((a, b) => b.puzzleCount - a.puzzleCount);

    // Write to file
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(hierarchy, null, 2));

    const fileSize = fs.statSync(OUTPUT_PATH).size;
    console.log(`[GenerateHierarchy] Written to ${OUTPUT_PATH} (${(fileSize / 1024).toFixed(2)}KB)`);
    console.log(`[GenerateHierarchy] Total openings: ${hierarchy.length}`);
    console.log(`[GenerateHierarchy] Total variations: ${hierarchy.reduce((sum, h) => sum + h.variations.length, 0)}`);
    
    // Log sample items
    console.log('[GenerateHierarchy] Sample items:');
    hierarchy.slice(0, 5).forEach(item => {
      console.log(`  - ${item.opening} (${item.puzzleCount} puzzles, ${item.variations.length} variations)`);
      item.variations.slice(0, 3).forEach(v => {
        console.log(`    • ${v.variation} (${v.puzzleCount} puzzles)`);
      });
    });
    
    console.log('[GenerateHierarchy] Done!');
  } catch (error) {
    console.error('[GenerateHierarchy] Error:', error);
    process.exit(1);
  }
}

generateHierarchy();
