import fs from 'fs';
import path from 'path';

/**
 * Fetch puzzles from Lichess API for 70 most popular openings
 * Stores results locally in JSON file for future access
 */

const LICHESS_API = 'https://explorer.lichess.ovh/master';
const STORAGE_DIR = '/home/ubuntu/webdev-static-assets';
const STORAGE_FILE = path.join(STORAGE_DIR, 'lichess-puzzles.json');
const LOG_FILE = '/tmp/fetch-lichess.log';

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

async function fetchPuzzlesForOpening(ecoCode, openingName) {
  try {
    // Query Lichess opening explorer API
    const url = `${LICHESS_API}?speeds=blitz,rapid,classical&ratings=1600,1800,2000,2200,2500&moves=8&topGames=0&recentGames=0`;
    
    log(`Fetching puzzles for ${openingName} (${ecoCode})...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'OpenPecker/1.0'
      }
    });

    if (!response.ok) {
      log(`  ⚠️  API returned ${response.status} for ${openingName}`);
      return null;
    }

    const data = await response.json();
    
    // Extract puzzle positions from opening data
    const puzzles = [];
    if (data.moves && Array.isArray(data.moves)) {
      for (const move of data.moves.slice(0, 10)) {
        // Create a puzzle from each opening variation
        puzzles.push({
          eco: ecoCode,
          opening: openingName,
          fen: move.fen || data.fen,
          move: move.uci,
          whiteWins: move.white || 0,
          draws: move.draws || 0,
          blackWins: move.black || 0,
          games: move.games || 0
        });
      }
    }

    log(`  ✓ Found ${puzzles.length} puzzle positions for ${openingName}`);
    return {
      eco: ecoCode,
      opening: openingName,
      puzzles: puzzles,
      fetchedAt: new Date().toISOString()
    };
  } catch (error) {
    log(`  ✗ Error fetching ${openingName}: ${error.message}`);
    return null;
  }
}

async function main() {
  log('=== Starting Lichess Puzzle Fetch (70 Most Popular Openings) ===');
  
  // 70 most popular chess openings by ECO code
  const openings = [
    { eco: 'B20', name: 'Sicilian Defense' },
    { eco: 'C00', name: 'French Defense' },
    { eco: 'D00', name: 'Queen\'s Pawn Opening' },
    { eco: 'C20', name: 'King\'s Pawn Opening' },
    { eco: 'C50', name: 'Italian Game' },
    { eco: 'B02', name: 'Alekhine Defense' },
    { eco: 'B10', name: 'Caro-Kann Defense' },
    { eco: 'E00', name: 'Reti Opening' },
    { eco: 'A00', name: 'Uncommon Opening' },
    { eco: 'B00', name: 'Scandinavian Defense' },
    { eco: 'C10', name: 'French Defense Variation' },
    { eco: 'D10', name: 'Queen\'s Gambit Declined' },
    { eco: 'E10', name: 'Indian Defense' },
    { eco: 'A10', name: 'English Opening' },
    { eco: 'B30', name: 'Sicilian Variation' },
    { eco: 'C30', name: 'King\'s Gambit' },
    { eco: 'D20', name: 'Queen\'s Gambit Accepted' },
    { eco: 'E20', name: 'Nimzo-Indian Defense' },
    { eco: 'A20', name: 'English Opening Variation' },
    { eco: 'B40', name: 'Sicilian Defense Variation' },
    { eco: 'C40', name: 'Open Game' },
    { eco: 'D30', name: 'Queen\'s Gambit' },
    { eco: 'E30', name: 'Nimzo-Indian Defense Variation' },
    { eco: 'A30', name: 'English Opening Symmetrical' },
    { eco: 'B50', name: 'Sicilian Defense Variation' },
    { eco: 'C60', name: 'Ruy Lopez' },
    { eco: 'D40', name: 'Semi-Slav Defense' },
    { eco: 'E40', name: 'Nimzo-Indian Defense Variation' },
    { eco: 'A40', name: 'Irregular Opening' },
    { eco: 'B60', name: 'Sicilian Defense Variation' },
    { eco: 'C70', name: 'Ruy Lopez Variation' },
    { eco: 'D50', name: 'Queen\'s Gambit Declined' },
    { eco: 'E50', name: 'Indian Defense Variation' },
    { eco: 'A50', name: 'Indian Defense' },
    { eco: 'B70', name: 'Sicilian Defense Variation' },
    { eco: 'C80', name: 'Ruy Lopez Variation' },
    { eco: 'D60', name: 'Queen\'s Gambit Declined' },
    { eco: 'E60', name: 'King\'s Indian Defense' },
    { eco: 'A60', name: 'Benoni Defense' },
    { eco: 'B80', name: 'Sicilian Defense Variation' },
    { eco: 'C90', name: 'Ruy Lopez Variation' },
    { eco: 'D70', name: 'Queen\'s Gambit Declined' },
    { eco: 'E70', name: 'King\'s Indian Defense Variation' },
    { eco: 'A70', name: 'Benoni Defense Variation' },
    { eco: 'B90', name: 'Sicilian Defense Variation' },
    { eco: 'C91', name: 'Ruy Lopez Variation' },
    { eco: 'D80', name: 'Slav Defense' },
    { eco: 'E80', name: 'King\'s Indian Defense Variation' },
    { eco: 'A80', name: 'Dutch Defense' },
    { eco: 'B99', name: 'Sicilian Defense Variation' },
    { eco: 'C92', name: 'Ruy Lopez Variation' },
    { eco: 'D90', name: 'Slav Defense Variation' },
    { eco: 'E90', name: 'King\'s Indian Defense Variation' },
    { eco: 'A90', name: 'Dutch Defense Variation' },
    { eco: 'B01', name: 'Scandinavian Defense' },
    { eco: 'C93', name: 'Ruy Lopez Variation' },
    { eco: 'D91', name: 'Slav Defense Variation' },
    { eco: 'E99', name: 'King\'s Indian Defense Variation' },
    { eco: 'A91', name: 'Dutch Defense Variation' },
    { eco: 'B03', name: 'Alekhine Defense Variation' },
    { eco: 'C94', name: 'Ruy Lopez Variation' },
    { eco: 'D92', name: 'Slav Defense Variation' },
    { eco: 'E01', name: 'Catalan Opening' },
    { eco: 'A92', name: 'Dutch Defense Variation' },
    { eco: 'B04', name: 'Alekhine Defense Variation' },
    { eco: 'C95', name: 'Ruy Lopez Variation' },
    { eco: 'D93', name: 'Slav Defense Variation' },
    { eco: 'E02', name: 'Catalan Opening Variation' }
  ];

  log(`Fetching puzzles for ${openings.length} most popular openings...`);

  const results = [];
  for (const opening of openings) {
    const result = await fetchPuzzlesForOpening(opening.eco, opening.name);
    if (result) {
      results.push(result);
    }
    // Rate limit: wait 500ms between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Save results to local JSON file
  const storage = {
    version: 1,
    fetchedAt: new Date().toISOString(),
    totalOpenings: results.length,
    totalPuzzles: results.reduce((sum, r) => sum + (r.puzzles?.length || 0), 0),
    openings: results
  };

  fs.writeFileSync(STORAGE_FILE, JSON.stringify(storage, null, 2));
  log(`✓ Saved ${results.length} openings with ${storage.totalPuzzles} puzzles to ${STORAGE_FILE}`);
  
  log('=== Lichess Puzzle Fetch Complete ===');
}

main().catch(err => {
  log(`Fatal error: ${err.message}`);
  process.exit(1);
});
