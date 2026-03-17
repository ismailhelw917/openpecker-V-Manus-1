import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import csv from "csv-parser";

dotenv.config();

const CSV_FILE = "/home/ubuntu/upload/lichess_db_puzzle(1).csv";
const BATCH_SIZE = 1000;

async function importPuzzles() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  try {
    let batch = [];
    let lineCount = 0;
    let skippedCount = 0;

    console.log("Starting puzzle import with opening data using proper CSV parsing...");

    // Clear existing puzzles
    await conn.execute("DELETE FROM puzzles");
    console.log("Cleared existing puzzles");

    const stream = fs
      .createReadStream(CSV_FILE)
      .pipe(csv())
      .on("data", async (row) => {
        lineCount++;

        try {
          const puzzleId = row.PuzzleId?.trim();
          const fen = row.FEN?.trim();
          const moves = row.Moves?.trim();
          const rating = parseInt(row.Rating) || 1500;
          const themes = row.Themes?.trim() || "";
          const openingTags = row.OpeningTags?.trim() || "";

          // Skip if missing critical data
          if (!puzzleId || !fen || !moves) {
            skippedCount++;
            return;
          }

          // Parse opening tags - format is "OpeningName OpeningName_Variation"
          let openingName = null;
          let openingVariation = null;

          if (openingTags) {
            const tagParts = openingTags.split(" ");
            if (tagParts.length >= 1) {
              // First part is the opening name
              openingName = tagParts[0].replace(/_/g, " ");
            }
            if (tagParts.length >= 2) {
              // Second part is the variation
              openingVariation = tagParts[1].replace(/_/g, " ");
            }
          }

          // Determine color (white or black) based on FEN
          const fenParts = fen.split(" ");
          const color = fenParts.length > 1 && fenParts[1] === "b" ? "black" : "white";

          // Parse themes
          const themeArray = themes
            .split(" ")
            .filter((t) => t.length > 0)
            .map((t) => t.trim());

          // Parse moves - they're space-separated UCI moves
          const moveArray = moves
            .split(" ")
            .filter((m) => m.length > 0)
            .map((m) => m.trim());

          batch.push({
            id: puzzleId,
            fen,
            moves: JSON.stringify(moveArray),
            rating,
            themes: JSON.stringify(themeArray),
            color,
            openingName,
            openingVariation,
          });

          // Insert batch when it reaches BATCH_SIZE
          if (batch.length >= BATCH_SIZE) {
            await insertBatch(conn, batch);
            console.log(
              `Inserted ${lineCount} puzzles (batch of ${batch.length})`
            );
            batch = [];
          }

          // Stop at 50k for testing
          if (lineCount >= 50000) {
            stream.destroy();
          }
        } catch (error) {
          console.error("Error processing row:", error);
          skippedCount++;
        }
      })
      .on("end", async () => {
        // Insert remaining batch
        if (batch.length > 0) {
          await insertBatch(conn, batch);
          console.log(`Inserted final batch of ${batch.length} puzzles`);
        }

        console.log(`\nImport complete!`);
        console.log(`Total lines processed: ${lineCount}`);
        console.log(`Puzzles imported: ${lineCount - skippedCount}`);
        console.log(`Skipped: ${skippedCount}`);
        await conn.end();
      })
      .on("error", (error) => {
        console.error("CSV parsing error:", error);
      });
  } catch (error) {
    console.error("Import failed:", error);
    await conn.end();
    process.exit(1);
  }
}

async function insertBatch(conn, batch) {
  const values = batch
    .map(
      (p) =>
        `('${p.id}', '${p.fen.replace(/'/g, "\\'")}', '${p.moves.replace(/'/g, "\\'")}', ${p.rating}, '${p.themes.replace(/'/g, "\\'")}', '${p.color}', ${p.openingName ? `'${p.openingName.replace(/'/g, "\\'")}'` : "NULL"}, ${p.openingVariation ? `'${p.openingVariation.replace(/'/g, "\\'")}'` : "NULL"})`
    )
    .join(",");

  const sql = `
    INSERT INTO puzzles (id, fen, moves, rating, themes, color, openingName, openingVariation)
    VALUES ${values}
    ON DUPLICATE KEY UPDATE
      fen = VALUES(fen),
      moves = VALUES(moves),
      rating = VALUES(rating),
      themes = VALUES(themes),
      color = VALUES(color),
      openingName = VALUES(openingName),
      openingVariation = VALUES(openingVariation)
  `;

  try {
    await conn.execute(sql);
  } catch (error) {
    console.error("Error inserting batch:", error.message);
    throw error;
  }
}

importPuzzles().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
