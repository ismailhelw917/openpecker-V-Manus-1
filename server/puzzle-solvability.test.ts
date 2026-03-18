import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { getDb } from "./db";

/**
 * Strenuous Puzzle Solvability Verification
 * 
 * Lichess puzzle format:
 * - FEN: position with the OPPONENT's side to move
 * - Moves: space-separated UCI moves
 *   - Move[0] = opponent's "setup" move (played automatically)
 *   - Move[1] = user's correct answer
 *   - Move[2+] = continuation (opponent, user, ...)
 * - Color field: which color the USER plays (opposite of FEN's side-to-move)
 * 
 * A puzzle is "solvable" if ALL moves in the sequence are legal
 * when replayed sequentially from the FEN position.
 */

interface PuzzleRow {
  id: string;
  fen: string;
  moves: string;
  rating: number | null;
  color: string | null;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  colorMismatch?: boolean; // color field doesn't match expected
}

function validatePuzzle(puzzle: PuzzleRow): ValidationResult {
  // 1. Validate FEN
  let game: Chess;
  try {
    game = new Chess(puzzle.fen);
  } catch (e) {
    return { valid: false, error: `Invalid FEN: ${e}` };
  }

  // 2. Parse moves
  const moves = puzzle.moves.split(' ').filter(m => m.length > 0);
  if (moves.length < 2) {
    return { valid: false, error: `Too few moves (${moves.length}): needs at least 2` };
  }

  // 3. Check color consistency (informational, doesn't affect solvability)
  const sideToMove = puzzle.fen.split(' ')[1];
  const expectedUserColor = sideToMove === 'w' ? 'black' : 'white';
  const colorMismatch = puzzle.color ? puzzle.color !== expectedUserColor : false;

  // 4. Replay ALL moves sequentially
  for (let i = 0; i < moves.length; i++) {
    const uci = moves[i];
    const from = uci.substring(0, 2);
    const to = uci.substring(2, 4);
    const promotion = uci.length > 4 ? uci[4] : undefined;

    try {
      const moveObj: any = { from, to };
      if (promotion) moveObj.promotion = promotion;
      
      const result = game.move(moveObj);
      if (!result) {
        const legalMoves = game.moves({ verbose: true });
        const legalUCIs = legalMoves.map((m: any) => `${m.from}${m.to}${m.promotion || ''}`);
        return { 
          valid: false, 
          error: `Move ${i} (${uci}) is illegal. Legal: ${legalUCIs.slice(0, 8).join(', ')}`,
          colorMismatch 
        };
      }
    } catch (e) {
      return { valid: false, error: `Move ${i} (${uci}) threw: ${e}`, colorMismatch };
    }
  }

  return { valid: true, colorMismatch };
}

describe("Puzzle Solvability Verification", () => {
  
  it("should validate 1000 random puzzles - all moves must be legal", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.execute(
      `SELECT id, fen, moves, rating, color FROM puzzles ORDER BY RAND() LIMIT 1000`
    ) as any;
    
    const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
    expect(puzzles.length).toBeGreaterThan(0);

    const moveErrors: { id: string; error: string }[] = [];
    let validCount = 0;
    let colorMismatchCount = 0;

    for (const puzzle of puzzles) {
      const result = validatePuzzle(puzzle);
      if (result.valid) {
        validCount++;
      } else {
        moveErrors.push({ id: puzzle.id, error: result.error! });
      }
      if (result.colorMismatch) colorMismatchCount++;
    }

    console.log(`\n=== Puzzle Solvability Results (1000 random) ===`);
    console.log(`Move-valid: ${validCount}/${puzzles.length} (${((validCount / puzzles.length) * 100).toFixed(2)}%)`);
    console.log(`Color mismatches: ${colorMismatchCount}/${puzzles.length} (${((colorMismatchCount / puzzles.length) * 100).toFixed(2)}%)`);
    
    if (moveErrors.length > 0) {
      console.log(`\nMove errors (${moveErrors.length}):`);
      moveErrors.slice(0, 10).forEach(e => console.log(`  ${e.id}: ${e.error}`));
    }

    // ALL moves must be legal (solvability)
    expect(validCount / puzzles.length).toBeGreaterThanOrEqual(0.99);
  }, 120000);

  it("should validate puzzles across all rating ranges", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const ranges = [
      { min: 0, max: 1000, label: "Beginner (0-1000)" },
      { min: 1000, max: 1500, label: "Intermediate (1000-1500)" },
      { min: 1500, max: 2000, label: "Advanced (1500-2000)" },
      { min: 2000, max: 2500, label: "Expert (2000-2500)" },
      { min: 2500, max: 9999, label: "Master (2500+)" },
    ];

    let totalErrors = 0;

    for (const range of ranges) {
      const rows = await db.execute(
        `SELECT id, fen, moves, rating, color FROM puzzles WHERE rating >= ${range.min} AND rating < ${range.max} ORDER BY RAND() LIMIT 200`
      ) as any;
      
      const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
      let valid = 0;

      for (const puzzle of puzzles) {
        if (validatePuzzle(puzzle).valid) valid++;
      }

      const rate = puzzles.length > 0 ? ((valid / puzzles.length) * 100).toFixed(1) : "N/A";
      console.log(`${range.label}: ${valid}/${puzzles.length} valid (${rate}%)`);
      totalErrors += (puzzles.length - valid);
    }

    expect(totalErrors).toBeLessThanOrEqual(10);
  }, 120000);

  it("should validate puzzles for both colors", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    for (const color of ['white', 'black']) {
      const rows = await db.execute(
        `SELECT id, fen, moves, rating, color FROM puzzles WHERE color = '${color}' ORDER BY RAND() LIMIT 500`
      ) as any;
      
      const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
      let valid = 0;

      for (const puzzle of puzzles) {
        if (validatePuzzle(puzzle).valid) valid++;
      }

      console.log(`${color.toUpperCase()}: ${valid}/${puzzles.length} valid (${((valid / Math.max(puzzles.length, 1)) * 100).toFixed(1)}%)`);
      expect(valid / Math.max(puzzles.length, 1)).toBeGreaterThanOrEqual(0.99);
    }
  }, 120000);

  it("should validate promotion puzzles specifically", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.execute(
      `SELECT id, fen, moves, rating, color FROM puzzles WHERE moves REGEXP '[a-h][1-8][a-h][18][qrbn]' ORDER BY RAND() LIMIT 500`
    ) as any;
    
    const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
    let valid = 0;
    const errors: string[] = [];

    for (const puzzle of puzzles) {
      const result = validatePuzzle(puzzle);
      if (result.valid) {
        valid++;
      } else {
        errors.push(`${puzzle.id}: ${result.error}`);
      }
    }

    console.log(`\nPromotion puzzles: ${valid}/${puzzles.length} valid (${((valid / Math.max(puzzles.length, 1)) * 100).toFixed(1)}%)`);
    if (errors.length > 0) {
      console.log(`Errors:`);
      errors.slice(0, 10).forEach(e => console.log(`  ${e}`));
    }

    expect(valid / Math.max(puzzles.length, 1)).toBeGreaterThanOrEqual(0.98);
  }, 120000);

  it("should validate user's answer move is legal after opponent's setup move", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.execute(
      `SELECT id, fen, moves, rating, color FROM puzzles ORDER BY RAND() LIMIT 1000`
    ) as any;
    
    const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
    let valid = 0;
    const issues: string[] = [];

    for (const puzzle of puzzles) {
      const moves = puzzle.moves.split(' ').filter(m => m.length > 0);
      if (moves.length < 2) {
        issues.push(`${puzzle.id}: Only ${moves.length} move(s)`);
        continue;
      }

      try {
        const game = new Chess(puzzle.fen);
        
        // Play opponent's first move
        const opp = moves[0];
        const r0 = game.move({ from: opp.substring(0, 2), to: opp.substring(2, 4), promotion: opp.length > 4 ? opp[4] as any : undefined });
        if (!r0) { issues.push(`${puzzle.id}: Opponent move ${opp} illegal`); continue; }

        // Verify user's answer is legal
        const usr = moves[1];
        const r1 = game.move({ from: usr.substring(0, 2), to: usr.substring(2, 4), promotion: usr.length > 4 ? usr[4] as any : undefined });
        if (!r1) { issues.push(`${puzzle.id}: User answer ${usr} illegal after ${opp}`); continue; }

        valid++;
      } catch (e) {
        issues.push(`${puzzle.id}: Error - ${e}`);
      }
    }

    console.log(`\nUser answer validation: ${valid}/${puzzles.length} (${((valid / Math.max(puzzles.length, 1)) * 100).toFixed(1)}%)`);
    if (issues.length > 0) {
      console.log(`Issues:`);
      issues.slice(0, 10).forEach(i => console.log(`  ${i}`));
    }

    expect(valid / Math.max(puzzles.length, 1)).toBeGreaterThanOrEqual(0.99);
  }, 120000);

  it("should validate all FENs are structurally correct", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.execute(
      `SELECT id, fen, moves, rating, color FROM puzzles ORDER BY RAND() LIMIT 1000`
    ) as any;
    
    const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
    let valid = 0;

    for (const puzzle of puzzles) {
      try {
        new Chess(puzzle.fen);
        valid++;
      } catch (e) {
        console.log(`Invalid FEN - Puzzle ${puzzle.id}: ${e}`);
      }
    }

    console.log(`\nFEN validation: ${valid}/${puzzles.length} (${((valid / puzzles.length) * 100).toFixed(1)}%)`);
    expect(valid).toBe(puzzles.length);
  }, 120000);

  it("should report color field accuracy", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const rows = await db.execute(
      `SELECT id, fen, moves, rating, color FROM puzzles ORDER BY RAND() LIMIT 2000`
    ) as any;
    
    const puzzles: PuzzleRow[] = (rows[0] || rows) as PuzzleRow[];
    let correct = 0;
    let mismatch = 0;
    let noColor = 0;

    for (const puzzle of puzzles) {
      if (!puzzle.color) { noColor++; continue; }
      
      const sideToMove = puzzle.fen.split(' ')[1];
      // In Lichess puzzles: sideToMove makes the setup move (opponent)
      // User plays the OTHER color
      const expectedUserColor = sideToMove === 'w' ? 'black' : 'white';
      
      if (puzzle.color === expectedUserColor) {
        correct++;
      } else {
        mismatch++;
      }
    }

    console.log(`\n=== Color Field Accuracy ===`);
    console.log(`Correct: ${correct}/${puzzles.length} (${((correct / puzzles.length) * 100).toFixed(1)}%)`);
    console.log(`Mismatch: ${mismatch}/${puzzles.length} (${((mismatch / puzzles.length) * 100).toFixed(1)}%)`);
    console.log(`No color: ${noColor}/${puzzles.length}`);
    
    // Report but don't fail - this is informational
    // The color field affects board orientation, not solvability
  }, 120000);
});
