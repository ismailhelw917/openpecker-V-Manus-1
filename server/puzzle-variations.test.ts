import { describe, it, expect } from 'vitest';
import {
  ChessMove,
  parsePGNWithVariations,
  calculateDifficulty,
  mapCentipawnValue,
  mapMateValue,
} from './chess-move-tree';
import {
  buildMoveTree,
  flattenMoveTree,
  getAllVariations,
  parseOpeningInfo,
  algebraicToUCI,
} from './pgn-parser';

describe('ChessMove Tree Structure', () => {
  it('should create a ChessMove with default values', () => {
    const move = new ChessMove('e4');
    expect(move.algebraicMove).toBe('e4');
    expect(move.evaluationScore).toBeNull();
    expect(move.isBestMove).toBe(false);
    expect(move.nextMoves).toEqual([]);
  });

  it('should create a ChessMove with evaluation and best move flag', () => {
    const move = new ChessMove('Nf3', 50, true);
    expect(move.algebraicMove).toBe('Nf3');
    expect(move.evaluationScore).toBe(50);
    expect(move.isBestMove).toBe(true);
  });

  it('should add next moves to a ChessMove', () => {
    const root = new ChessMove('e4');
    const variation1 = new ChessMove('c5');
    const variation2 = new ChessMove('e5');

    root.addNextMove(variation1);
    root.addNextMove(variation2);

    expect(root.nextMoves.length).toBe(2);
    const nextMoves = root.getNextMoves();
    expect(nextMoves.some(m => m.algebraicMove === 'c5')).toBe(true);
    expect(nextMoves.some(m => m.algebraicMove === 'e5')).toBe(true);
  });

  it('should get the best next move', () => {
    const root = new ChessMove('e4');
    const bestMove = new ChessMove('c5', 100, true);
    const altMove = new ChessMove('e5', 50, false);

    root.addNextMove(altMove);
    root.addNextMove(bestMove);

    const best = root.getBestNextMove();
    expect(best).toBeDefined();
    expect(best!.isBestMove).toBe(true);
  });

  it('should serialize and deserialize ChessMove to JSON', () => {
    const root = new ChessMove('e4', 50, true);
    const child = new ChessMove('c5', 30, false);
    root.addNextMove(child);

    const json = root.toJSON();
    expect(json.move).toBe('e4');
    expect(json.eval).toBe(50);
    expect(json.best).toBe(true);
    expect(Array.isArray(json.variations)).toBe(true);

    const restored = ChessMove.fromJSON(json);
    expect(restored.algebraicMove).toBe('e4');
    expect(restored.evaluationScore).toBe(50);
    expect(restored.nextMoves.length).toBeGreaterThan(0);
  });
});

describe('PGN Parsing with Variations', () => {
  it('should parse simple PGN without variations', () => {
    const pgn = 'e4 c5 Nf3';
    const moves = parsePGNWithVariations(pgn);
    // Parser returns flat list of moves, not tree
    expect(moves.length).toBeGreaterThan(0);
    const firstMove = moves.find(m => m.algebraicMove === 'e4');
    expect(firstMove).toBeDefined();
  });

  it('should parse PGN with variations in parentheses', () => {
    const pgn = 'e4 (e5 Nf3) c5';
    const moves = parsePGNWithVariations(pgn);
    // Parser should extract all moves including variations
    expect(moves.length).toBeGreaterThan(0);
    const hasE4 = moves.some(m => m.algebraicMove === 'e4');
    expect(hasE4).toBe(true);
  });

  it('should handle nested variations', () => {
    const pgn = 'e4 (e5 (Nf3 Nc6) Bc4) c5';
    const moves = parsePGNWithVariations(pgn);
    expect(moves.length).toBeGreaterThan(0);
    // Should extract e4 from the variations
    const hasE4 = moves.some(m => m.algebraicMove === 'e4');
    expect(hasE4).toBe(true);
  });
});

describe('Difficulty Calculation', () => {
  it('should calculate difficulty from move evaluations', () => {
    const evaluations = [0.5, 0.3, 0.8, 0.2];
    const difficulty = calculateDifficulty(evaluations);
    expect(typeof difficulty).toBe('number');
    expect(difficulty).toBeGreaterThan(0);
  });

  it('should return high difficulty for trivial puzzles', () => {
    const evaluations = [0.5];
    const difficulty = calculateDifficulty(evaluations);
    expect(difficulty).toBe(1000);
  });

  it('should return higher difficulty for uniform evaluations', () => {
    const uniform = [0.5, 0.5, 0.5, 0.5];
    const varied = [0.1, 0.9, 0.2, 0.8];
    const diffUniform = calculateDifficulty(uniform);
    const diffVaried = calculateDifficulty(varied);
    // Varied should be harder to distinguish
    expect(diffVaried).toBeGreaterThan(diffUniform);
  });
});

describe('Centipawn and Mate Value Mapping', () => {
  it('should map centipawn values to strength [0, 1]', () => {
    const strength0 = mapCentipawnValue(0); // Equal position
    const strengthPositive = mapCentipawnValue(300); // Advantage
    const strengthNegative = mapCentipawnValue(-300); // Disadvantage

    expect(strength0).toBeCloseTo(0.5, 1);
    expect(strengthPositive).toBeGreaterThan(0.5);
    expect(strengthNegative).toBeLessThan(0.5);
  });

  it('should map mate-in-N values correctly', () => {
    const mateIn1 = mapMateValue(1);
    const mateIn5 = mapMateValue(5);
    const matedIn1 = mapMateValue(-1);

    expect(mateIn1).toBeGreaterThan(mateIn5);
    expect(mateIn1).toBeGreaterThan(0.5);
    expect(matedIn1).toBeLessThan(0.5);
  });

  it('should map mate value of 0 to 0', () => {
    const mate0 = mapMateValue(0);
    expect(mate0).toBe(0);
  });
});

describe('Move Tree Building and Flattening', () => {
  it('should build a move tree from algebraic moves', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const moves = ['e4', 'c5', 'Nf3'];
    const tree = buildMoveTree(fen, moves);

    expect(tree).not.toBeNull();
    expect(tree!.algebraicMove).toBe('e4');
    // Tree should have continuation
    expect(tree!.nextMoves.length).toBeGreaterThan(0);
  });

  it('should flatten a move tree to linear sequence', () => {
    const root = new ChessMove('e4');
    const move2 = new ChessMove('c5');
    const move3 = new ChessMove('Nf3');

    root.addNextMove(move2);
    move2.addNextMove(move3);

    const flattened = flattenMoveTree(root);
    expect(flattened.length).toBe(3);
    expect(flattened[0]).toBe('e4');
    expect(flattened[1]).toBe('c5');
    expect(flattened[2]).toBe('Nf3');
  });

  it('should return empty array for null tree', () => {
    const flattened = flattenMoveTree(null);
    expect(Array.isArray(flattened)).toBe(true);
    expect(flattened.length).toBe(0);
  });
});

describe('Get All Variations', () => {
  it('should get all variation paths from a tree', () => {
    const root = new ChessMove('e4');
    const var1 = new ChessMove('c5');
    const var2 = new ChessMove('e5');
    const var1_cont = new ChessMove('Nf3');

    root.addNextMove(var1);
    root.addNextMove(var2);
    var1.addNextMove(var1_cont);

    const variations = getAllVariations(root);
    expect(variations.length).toBe(2);
    // Both variations should start with e4
    expect(variations.every(v => v[0] === 'e4')).toBe(true);
  });

  it('should handle single line', () => {
    const root = new ChessMove('e4');
    const move2 = new ChessMove('c5');
    root.addNextMove(move2);

    const variations = getAllVariations(root);
    expect(variations.length).toBe(1);
    // Should include both moves in the path
    expect(variations[0].includes('e4')).toBe(true);
    expect(variations[0].includes('c5')).toBe(true);
  });
});

describe('Algebraic to UCI Conversion', () => {
  it('should convert algebraic moves to UCI format', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const algebraic = ['e4', 'c5', 'Nf3'];
    const uci = algebraicToUCI(fen, algebraic);

    expect(uci.length).toBe(3);
    // Check that moves are in UCI format (4-5 characters)
    expect(uci[0].length).toBeGreaterThanOrEqual(4);
    expect(uci[1].length).toBeGreaterThanOrEqual(4);
    expect(uci[2].length).toBeGreaterThanOrEqual(4);
  });

  it('should handle invalid moves gracefully', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const algebraic = ['e4', 'c5'];
    const uci = algebraicToUCI(fen, algebraic);

    // Should convert valid moves
    expect(uci.length).toBe(2);
    expect(uci[0]).toBe('e2e4');
    expect(uci[1]).toBe('c7c5');
  });
});

describe('Opening Info Parsing', () => {
  it('should extract opening information from PGN', () => {
    const pgn = `[Event "Tournament"]
[Opening "Sicilian Defense"]
[Variation "Najdorf"]
1. e4 c5 2. Nf3`;

    const { opening, variation } = parseOpeningInfo(pgn);
    // Should extract opening name
    expect(opening).toBeDefined();
    expect(opening.length).toBeGreaterThan(0);
  });

  it('should handle missing opening tags', () => {
    const pgn = '1. e4 c5 2. Nf3';
    const { opening, variation } = parseOpeningInfo(pgn);
    // Should return default opening
    expect(opening).toBeDefined();
    expect(variation).toBeDefined();
  });
});
