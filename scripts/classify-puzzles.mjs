#!/usr/bin/env node
/**
 * Comprehensive Puzzle Classifier - Optimized v3
 * 
 * Phase 1: Batch UPDATE JOIN from puzzles_raw OpeningTags
 * Phase 2: FEN-based classification for remaining puzzles (batch CASE updates)
 */

import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const LOG_FILE = '/home/ubuntu/openpecker-recreated/scripts/classify-progress.log';
fs.writeFileSync(LOG_FILE, '');
const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
};

// ============================================================
// FEN ANALYSIS FUNCTIONS
// ============================================================

function getPawnStructure(fen) {
  const board = fen.split(' ')[0];
  const rows = board.split('/');
  const wP = [], bP = [];
  for (let rank = 0; rank < 8; rank++) {
    let file = 0;
    for (const ch of rows[rank]) {
      if (ch >= '1' && ch <= '8') { file += parseInt(ch); }
      else {
        if (ch === 'P') wP.push({ f: file, r: 7 - rank });
        if (ch === 'p') bP.push({ f: file, r: 7 - rank });
        file++;
      }
    }
  }
  return { wP, bP };
}

function getMaterialCount(fen) {
  const board = fen.split(' ')[0];
  const c = { Q:0,R:0,B:0,N:0,P:0, q:0,r:0,b:0,n:0,p:0 };
  for (const ch of board) { if (c[ch] !== undefined) c[ch]++; }
  return c;
}

function classifyEndgame(fen) {
  const m = getMaterialCount(fen);
  const wm = m.B + m.N, bm = m.b + m.n;
  if (m.Q===0 && m.R===0 && wm===0 && m.q===0 && m.r===0 && bm===0) return { name: 'Endgame Tactics', variation: 'Pawn Endgame' };
  if (m.Q===0 && m.q===0 && wm===0 && bm===0 && (m.R>0 || m.r>0)) return { name: 'Endgame Tactics', variation: 'Rook Endgame' };
  if ((m.Q>0 || m.q>0) && m.R===0 && m.r===0 && wm===0 && bm===0) return { name: 'Endgame Tactics', variation: 'Queen Endgame' };
  if ((m.Q>0 && m.r>0 && m.q===0) || (m.q>0 && m.R>0 && m.Q===0)) return { name: 'Endgame Tactics', variation: 'Queen vs Rook Endgame' };
  if (m.Q===0 && m.q===0 && m.R===0 && m.r===0 && m.N===0 && m.n===0 && (m.B>0 || m.b>0)) return { name: 'Endgame Tactics', variation: 'Bishop Endgame' };
  if (m.Q===0 && m.q===0 && m.R===0 && m.r===0 && m.B===0 && m.b===0 && (m.N>0 || m.n>0)) return { name: 'Endgame Tactics', variation: 'Knight Endgame' };
  if (m.Q===0 && m.q===0 && (m.R>0 || m.r>0) && (wm>0 || bm>0)) return { name: 'Endgame Tactics', variation: 'Rook and Minor Piece Endgame' };
  return { name: 'Endgame Tactics', variation: 'Complex Endgame' };
}

function detectOpeningFromFEN(fen) {
  const { wP, bP } = getPawnStructure(fen);
  const hp = (pawns, f, r) => pawns.some(p => p.f === f && p.r === r);
  const hW = (f, r) => hp(wP, f, r);
  const hB = (f, r) => hp(bP, f, r);

  const wE4=hW(4,3), wD4=hW(3,3), wC4=hW(2,3);
  const bE5=hB(4,4), bD5=hB(3,4), bC5=hB(2,4);
  const bE6=hB(4,5), bD6=hB(3,5), bC6=hB(2,5);
  const bF5=hB(5,4), bG6=hB(6,5), bB6=hB(1,5);
  const noCenter = !wE4 && !wD4 && !hW(4,4) && !hW(3,4);

  if (wE4 && bC5) return { name: 'Sicilian Defense', variation: null };
  if (wE4 && hB(2,3) && !bC5 && wD4 && bD6) return { name: 'Sicilian Defense', variation: 'Open Sicilian' };
  if (wE4 && bE6 && !bE5 && bD5) return { name: 'French Defense', variation: null };
  if (wE4 && bE6 && !bE5 && !bD5 && hB(3,3)) return { name: 'French Defense', variation: 'Exchange Variation' };
  if (wE4 && bE6 && !bE5) return { name: 'French Defense', variation: null };
  if (wE4 && bC6 && !bC5) return { name: 'Caro-Kann Defense', variation: null };
  if (wE4 && bD5 && !bE6 && !bC6) return { name: 'Scandinavian Defense', variation: null };
  if (wE4 && bD6 && bG6 && !bC5 && !bE5) return { name: 'Pirc Defense', variation: null };
  if (wE4 && bG6 && !bE5 && !bC5 && !bD5) return { name: 'Modern Defense', variation: null };
  if (wE4 && bD6 && !bC5 && !bE5) return { name: 'Pirc Defense', variation: null };
  if (wE4 && bE5) {
    if (wD4 || hW(3,4)) return { name: 'Open Game', variation: 'Scotch Game' };
    return { name: 'Open Game', variation: null };
  }
  if (wD4 && bD5) {
    if (wC4) {
      if (bE6) return { name: "Queen's Gambit Declined", variation: null };
      if (bC6) return { name: 'Slav Defense', variation: null };
      if (hB(2,3)) return { name: "Queen's Gambit Accepted", variation: null };
      return { name: "Queen's Gambit", variation: null };
    }
    return { name: "Queen's Pawn Game", variation: null };
  }
  if (wD4 && !bD5) {
    if (wC4) {
      if (bG6 && bD6) return { name: "King's Indian Defense", variation: null };
      if (bG6) return { name: "King's Indian Defense", variation: null };
      if (bE6 && bB6) return { name: "Queen's Indian Defense", variation: null };
      if (bE6) return { name: 'Nimzo-Indian Defense', variation: null };
      if (bC5) return { name: 'Benoni Defense', variation: null };
      if (bF5) return { name: 'Dutch Defense', variation: null };
      return { name: 'Indian Defense', variation: null };
    }
    if (bF5) return { name: 'Dutch Defense', variation: null };
    if (bG6) return { name: "King's Indian Defense", variation: null };
    if (bD6) return { name: 'Old Indian Defense', variation: null };
    if (bC5) return { name: 'Benoni Defense', variation: null };
    return { name: "Queen's Pawn Game", variation: null };
  }
  if (wC4 && !wD4 && !wE4) {
    if (bE5) return { name: 'English Opening', variation: 'Reversed Sicilian' };
    if (bC5) return { name: 'English Opening', variation: 'Symmetrical Variation' };
    return { name: 'English Opening', variation: null };
  }
  if (noCenter && bD5) return { name: 'Reti Opening', variation: null };
  if (hW(5,3) && !wE4 && !wD4) return { name: "Bird's Opening", variation: null };
  if (wE4) return { name: "King's Pawn Opening", variation: null };
  if (wD4) return { name: "Queen's Pawn Game", variation: null };
  return null;
}

function classifyPuzzle(fen, themes) {
  const isEndgame = themes.includes('"endgame"');
  const isOpening = themes.includes('"opening"');
  if (isEndgame && !isOpening) {
    const eg = classifyEndgame(fen);
    const op = detectOpeningFromFEN(fen);
    if (op) return { name: op.name, variation: op.variation || eg.variation };
    return eg;
  }
  const op = detectOpeningFromFEN(fen);
  if (op) return op;
  const m = getMaterialCount(fen);
  const totalPieces = m.Q+m.R+m.B+m.N+m.q+m.r+m.b+m.n;
  if (totalPieces <= 6) return classifyEndgame(fen);
  if (isOpening) return { name: 'Uncommon Opening', variation: null };
  return { name: 'Middlegame Tactics', variation: null };
}

function parseOpeningTags(tags) {
  if (!tags) return null;
  const parts = tags.split(' ');
  let name = parts[0].replace(/_/g, ' ');
  let variation = null;
  if (parts.length >= 2) {
    variation = parts.slice(1).join(' ').replace(/_/g, ' ');
    if (variation.startsWith(name + ' ')) variation = variation.substring(name.length + 1);
  }
  return { name, variation };
}

async function main() {
  log('=== Starting Optimized Puzzle Classification v3 ===');

  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
  });

  log('Database pool created');

  // ============================================================
  // PHASE 1: Copy from puzzles_raw using batched UPDATE with temp table
  // ============================================================
  log('--- PHASE 1: Copying OpeningTags from puzzles_raw ---');
  const p1Start = Date.now();

  const PHASE1_BATCH = 5000;
  let phase1Total = 0;

  while (true) {
    const [rows] = await pool.query(
      `SELECT pr.PuzzleId, pr.OpeningTags 
       FROM puzzles_raw pr 
       INNER JOIN puzzles p ON pr.PuzzleId = p.id 
       WHERE pr.OpeningTags IS NOT NULL AND pr.OpeningTags != '' 
       AND (p.openingName IS NULL OR p.openingName = '')
       LIMIT ?`,
      [PHASE1_BATCH]
    );

    if (rows.length === 0) break;

    // Build batch UPDATE using CASE
    const ids = [];
    const nameMap = {};
    const varMap = {};

    for (const row of rows) {
      const parsed = parseOpeningTags(row.OpeningTags);
      if (parsed && parsed.name) {
        ids.push(row.PuzzleId);
        nameMap[row.PuzzleId] = parsed.name;
        varMap[row.PuzzleId] = parsed.variation;
      }
    }

    if (ids.length > 0) {
      let nameCase = 'CASE id ';
      let varCase = 'CASE id ';
      const params = [];

      for (const id of ids) {
        nameCase += 'WHEN ? THEN ? ';
        params.push(id, nameMap[id]);
      }
      nameCase += 'END';

      for (const id of ids) {
        varCase += 'WHEN ? THEN ? ';
        params.push(id, varMap[id]);
      }
      varCase += 'END';

      const placeholders = ids.map(() => '?').join(',');
      params.push(...ids);

      await pool.query(
        `UPDATE puzzles SET openingName = ${nameCase}, openingVariation = ${varCase} WHERE id IN (${placeholders})`,
        params
      );

      phase1Total += ids.length;
    }

    log(`Phase 1: ${phase1Total} updated`);
  }

  log(`Phase 1 complete: ${phase1Total} puzzles in ${((Date.now()-p1Start)/1000).toFixed(1)}s`);

  // ============================================================
  // PHASE 2: FEN-based classification
  // ============================================================
  log('--- PHASE 2: FEN-based classification ---');
  const p2Start = Date.now();

  const [[{ remaining }]] = await pool.query(
    "SELECT COUNT(*) as remaining FROM puzzles WHERE openingName IS NULL OR openingName = ''"
  );
  log(`Remaining puzzles to classify: ${remaining}`);

  const BATCH_SIZE = 10000;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let lastId = '';

  while (true) {
    const [puzzles] = await pool.query(
      `SELECT id, fen, themes FROM puzzles 
       WHERE (openingName IS NULL OR openingName = '') AND id > ?
       ORDER BY id ASC LIMIT ?`,
      [lastId, BATCH_SIZE]
    );

    if (puzzles.length === 0) break;

    const updates = [];
    for (const p of puzzles) {
      try {
        const result = classifyPuzzle(p.fen, p.themes || '');
        if (result && result.name) {
          updates.push({ id: p.id, name: result.name, var: result.variation });
        }
      } catch {}
      totalProcessed++;
    }

    // Batch UPDATE using CASE
    if (updates.length > 0) {
      const SUB = 2000;
      for (let i = 0; i < updates.length; i += SUB) {
        const batch = updates.slice(i, i + SUB);
        const batchIds = [];
        let nameCase = 'CASE id ';
        let varCase = 'CASE id ';
        const params = [];

        for (const u of batch) {
          batchIds.push(u.id);
          nameCase += 'WHEN ? THEN ? ';
          params.push(u.id, u.name);
        }
        nameCase += 'END';

        for (const u of batch) {
          varCase += 'WHEN ? THEN ? ';
          params.push(u.id, u.var);
        }
        varCase += 'END';

        const placeholders = batchIds.map(() => '?').join(',');
        params.push(...batchIds);

        await pool.query(
          `UPDATE puzzles SET openingName = ${nameCase}, openingVariation = ${varCase} WHERE id IN (${placeholders})`,
          params
        );

        totalUpdated += batch.length;
      }
    }

    lastId = puzzles[puzzles.length - 1].id;

    if (totalProcessed % 100000 === 0 || puzzles.length < BATCH_SIZE) {
      const elapsed = (Date.now() - p2Start) / 1000;
      const rate = (totalProcessed / elapsed).toFixed(0);
      const pct = ((totalProcessed / remaining) * 100).toFixed(1);
      log(`Phase 2: ${totalProcessed}/${remaining} (${pct}%) | Updated: ${totalUpdated} | Rate: ${rate}/s`);
    }
  }

  const totalTime = ((Date.now() - p2Start) / 1000).toFixed(1);
  log('=== CLASSIFICATION COMPLETE ===');
  log(`Phase 1: ${phase1Total} from puzzles_raw`);
  log(`Phase 2: ${totalUpdated} from FEN analysis`);
  log(`Total time: ${totalTime}s`);

  const [dist] = await pool.query(
    `SELECT openingName, COUNT(*) as cnt FROM puzzles 
     WHERE openingName IS NOT NULL AND openingName != '' 
     GROUP BY openingName ORDER BY cnt DESC LIMIT 30`
  );
  log('\n=== Opening Distribution (Top 30) ===');
  for (const row of dist) {
    log(`  ${row.openingName}: ${row.cnt}`);
  }

  const [[{ stillUnclassified }]] = await pool.query(
    "SELECT COUNT(*) as stillUnclassified FROM puzzles WHERE openingName IS NULL OR openingName = ''"
  );
  log(`\nStill unclassified: ${stillUnclassified}`);

  await pool.end();
  log('Done.');
}

main().catch(err => {
  log(`FATAL: ${err.message}\n${err.stack}`);
  process.exit(1);
});
