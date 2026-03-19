import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTER_API_KEY = process.env.COUNTER_API_KEY || 'ut_RDvVPl9tOkYq9NfLPSNz8lZmOSI6pUTI0iXa7pAb';
const COUNTER_API_URL = 'https://api.counter.dev/v1/events';

/**
 * Upload puzzle batch to Counter API
 */
async function uploadPuzzleBatch(puzzles, batchNumber) {
  try {
    const payload = {
      key: COUNTER_API_KEY,
      event: 'puzzle_batch_upload',
      category: `batch_${batchNumber}`,
      value: puzzles.length,
      metadata: {
        puzzleCount: puzzles.length,
        batchNumber,
        puzzles: puzzles.map(p => ({
          id: p.id,
          rating: p.rating,
          opening: p.opening,
          themes: p.themes,
        })),
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch(COUNTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COUNTER_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      console.log(`✅ Batch ${batchNumber}: Uploaded ${puzzles.length} puzzles to Counter API`);
      return true;
    } else {
      console.error(`❌ Batch ${batchNumber}: Failed to upload (${response.status})`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Batch ${batchNumber}: Error uploading to Counter API:`, error.message);
    return false;
  }
}

/**
 * Parse Lichess puzzle CSV and upload to Counter API
 */
async function uploadPuzzlesToCounterAPI(filePath, batchSize = 100) {
  console.log(`📥 Reading puzzles from: ${filePath}`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  let batchNumber = 0;
  let batch = [];
  let totalUploaded = 0;

  return new Promise((resolve, reject) => {
    rl.on('line', async (line) => {
      lineCount++;
      
      if (lineCount === 1) return; // Skip header
      
      try {
        // Parse CSV line - handle quoted fields
        const fields = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            fields.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        fields.push(current.trim().replace(/^"|"$/g, ''));
        
        const [puzzleId, fen, moves, rating, ratingDev, popularity, themes, gameUrl] = fields;
        
        if (!fen || !moves) return;

        batch.push({
          id: puzzleId,
          fen,
          moves,
          rating: parseInt(rating) || 1500,
          themes: themes || '',
          opening: null,
        });

        // Upload batch when size reached
        if (batch.length >= batchSize) {
          batchNumber++;
          const success = await uploadPuzzleBatch(batch, batchNumber);
          if (success) {
            totalUploaded += batch.length;
          }
          console.log(`📊 Progress: ${totalUploaded} puzzles uploaded (line ${lineCount})`);
          batch = [];
        }
      } catch (error) {
        console.error(`Error parsing line ${lineCount}:`, error.message);
      }
    });

    rl.on('end', async () => {
      // Upload remaining batch
      if (batch.length > 0) {
        batchNumber++;
        const success = await uploadPuzzleBatch(batch, batchNumber);
        if (success) {
          totalUploaded += batch.length;
        }
      }
      
      console.log(`\n📊 Counter API Upload Complete:`);
      console.log(`   Total puzzles uploaded: ${totalUploaded}`);
      console.log(`   Total batches: ${batchNumber}`);
      console.log(`   Lines processed: ${lineCount - 1}`);
      
      resolve({ totalUploaded, batchNumber });
    });

    rl.on('error', reject);
  });
}

/**
 * Main function
 */
async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    console.error('Usage: node upload-puzzles-counter.mjs <file-path>');
    console.error('Example: node upload-puzzles-counter.mjs puzzles-sample.csv');
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`🚀 Starting Counter API puzzle upload...`);
  console.log(`   File: ${filePath}`);
  console.log(`   Batch size: 100 puzzles per upload`);

  try {
    const result = await uploadPuzzlesToCounterAPI(filePath);
    console.log(`\n✅ Upload completed successfully!`);
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    process.exit(1);
  }
}

main();
