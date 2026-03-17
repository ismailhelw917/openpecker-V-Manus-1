import fs from "fs";
import readline from "readline";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const BATCH_SIZE = 5000;
const CSV_FILE = "/home/ubuntu/upload/lichess_db_puzzle(1).csv";

function formatOpeningName(tags) {
  if (!tags) return "Unknown";
  const parts = tags.split(" ");
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function extractThemes(themeStr) {
  if (!themeStr) return [];
  return themeStr.split(" ").filter((t) => t.length > 0);
}

async function importPuzzles() {
  let connection;
  try {
    connection = await mysql.createConnection(DB_URL);
    console.log("✓ Connected to database");

    const fileStream = fs.createReadStream(CSV_FILE);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let batch = [];
    let lineCount = 0;
    let insertedCount = 0;
    let startTime = Date.now();

    for await (const line of rl) {
      lineCount++;

      // Skip header
      if (lineCount === 1) continue;

      // Parse CSV line
      const parts = line.split(",");
      if (parts.length < 6) continue;

      const [puzzleId, fen, moves, rating, ratingDeviation, popularity, nbPlays, themes, gameUrl, openingTags, openingEco] = parts;

      const puzzle = {
        id: puzzleId.trim(),
        fen: fen.trim(),
        moves: moves.trim(),
        rating: parseInt(rating) || 1500,
        themes: extractThemes(themes),
        color: fen.includes(" w ") ? "white" : "black",
        openingName: formatOpeningName(openingTags),
        openingEco: openingEco?.trim() || null,
      };

      batch.push(puzzle);

      // Insert when batch is full
      if (batch.length >= BATCH_SIZE) {
        await insertBatch(connection, batch);
        insertedCount += batch.length;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (insertedCount / (elapsed / 60)).toFixed(0);
        console.log(`✓ Inserted ${insertedCount} puzzles (Line ${lineCount}, ${rate} puzzles/min, ${elapsed}s elapsed)`);
        batch = [];
      }
    }

    // Insert remaining puzzles
    if (batch.length > 0) {
      await insertBatch(connection, batch);
      insertedCount += batch.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✓ Inserted ${insertedCount} puzzles (Final batch, ${elapsed}s elapsed)`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Import complete! Total: ${insertedCount} puzzles in ${totalTime}s`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

async function insertBatch(connection, batch) {
  // Escape single quotes in strings
  const values = batch
    .map(
      (p) =>
        `('${p.id}', '${p.fen.replace(/'/g, "\\'")}', '${p.moves}', ${p.rating}, '${JSON.stringify(p.themes).replace(/'/g, "\\'")}', '${p.color}')`
    )
    .join(",");

  const sql = `
    INSERT INTO puzzles (id, fen, moves, rating, themes, color)
    VALUES ${values}
    ON DUPLICATE KEY UPDATE
      fen = VALUES(fen),
      moves = VALUES(moves),
      rating = VALUES(rating),
      themes = VALUES(themes),
      color = VALUES(color)
  `;

  try {
    await connection.execute(sql);
  } catch (error) {
    console.error("Batch insert error:", error.message);
    throw error;
  }
}

importPuzzles();
