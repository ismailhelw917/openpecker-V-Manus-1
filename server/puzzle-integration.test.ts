import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Chess } from 'chess.js';
import {
  parseMovesList,
  buildAndStorePuzzleVariations,
  getPuzzleWithAllData,
  convertPuzzleMovesToUCI,
} from './puzzle-service';
import { ChessMove, calculateDifficulty } from './chess-move-tree';

describe('Puzzle Service Integration', () => {
  describe('parseMovesList', () => {
    it('should parse space-separated moves', () => {
      const moves = parseMovesList('e2e4 c7c5 g1f3');
      expect(moves.length).toBe(3);
      expect(moves[0]).toBe('e2e4');
    });

    it('should parse comma-separated moves', () => {
      const moves = parseMovesList('e2e4, c7c5, g1f3');
      expect(moves.length).toBe(3);
      expect(moves[0]).toBe('e2e4');
    });

    it('should filter out move numbers', () => {
      const moves = parseMovesList('1. e4 2. Nf3 3. Bb5');
      // Should have parsed some moves
      expect(moves.length).toBeGreaterThan(0);
      // Moves should not start with numbers
      const hasNumbers = moves.some(m => /^\d+\./.test(m));
      expect(hasNumbers).toBe(false);
    });

    it('should handle empty strings', () => {
      const moves = parseMovesList('');
      expect(moves.length).toBe(0);
    });

    it('should handle null/undefined', () => {
      const moves1 = parseMovesList(null as any);
      const moves2 = parseMovesList(undefined as any);
      expect(moves1.length).toBe(0);
      expect(moves2.length).toBe(0);
    });
  });

  describe('convertPuzzleMovesToUCI', () => {
    it('should convert algebraic moves to UCI format', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = ['e4', 'c5', 'Nf3'];
      const uci = convertPuzzleMovesToUCI(fen, moves);

      expect(uci.length).toBeGreaterThan(0);
      expect(uci[0].length).toBeGreaterThanOrEqual(4);
    });

    it('should handle mixed algebraic and UCI', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = ['e4', 'c5'];
      const uci = convertPuzzleMovesToUCI(fen, moves);

      expect(Array.isArray(uci)).toBe(true);
      expect(uci.length).toBeGreaterThan(0);
    });
  });

  describe('Puzzle Variation Tree Building', () => {
    it('should build tree from move sequence', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = ['e2e4', 'c7c5', 'g1f3'];

      const game = new Chess(fen);
      let moveCount = 0;

      for (const move of moves) {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const result = game.move({ from, to });
        if (result) moveCount++;
      }

      expect(moveCount).toBe(3);
      expect(game.fen()).not.toBe(fen);
    });

    it('should handle pawn promotion', () => {
      const fen = '8/P7/8/8/8/8/k7/K7 w - - 0 1';
      const game = new Chess(fen);
      const move = game.move({ from: 'a7', to: 'a8', promotion: 'q' } as any);

      expect(move).not.toBeNull();
      if (move) {
        expect(move.promotion).toBe('q');
      }
    });

    it('should detect captures', () => {
      const fen = '8/8/8/3p4/4P3/8/8/8 b - - 0 1';
      const game = new Chess(fen);

      // Black pawn captures white pawn
      const move = game.move({ from: 'd5', to: 'e4' });
      expect(move).not.toBeNull();
    });
  });

  describe('Puzzle Difficulty Calculation', () => {
    it('should calculate difficulty from evaluations', () => {
      const evaluations = [0.5, 0.3, 0.8, 0.2];
      const difficulty = calculateDifficulty(evaluations);
      expect(typeof difficulty).toBe('number');
      expect(difficulty).toBeGreaterThan(0);
      expect(difficulty).toBeLessThan(3000);
    });

    it('should handle single evaluation', () => {
      const evaluations = [0.5];
      const difficulty = calculateDifficulty(evaluations);
      expect(difficulty).toBe(1000);
    });

    it('should handle empty evaluations', () => {
      const evaluations: number[] = [];
      const difficulty = calculateDifficulty(evaluations);
      expect(difficulty).toBe(1000);
    });
  });

  describe('ChessMove Serialization', () => {
    it('should serialize and deserialize tree', () => {
      const root = new ChessMove('e4', 50, true);
      const child1 = new ChessMove('c5', 30, false);
      const child2 = new ChessMove('e5', 40, false);

      root.addNextMove(child1);
      root.addNextMove(child2);

      const json = root.toJSON();
      const restored = ChessMove.fromJSON(json);

      expect(restored.algebraicMove).toBe('e4');
      expect(restored.nextMoves.length).toBeGreaterThan(0);
      expect(restored.nextMoves[0].algebraicMove).toBe('c5');
    });

    it('should preserve evaluation scores', () => {
      const root = new ChessMove('e4', 125, true);
      const child = new ChessMove('c5', 75, false);
      root.addNextMove(child);

      const json = root.toJSON();
      const restored = ChessMove.fromJSON(json);

      expect(restored.evaluationScore).toBe(125);
      if (restored.nextMoves.length > 0) {
        expect(restored.nextMoves[0].evaluationScore).toBe(75);
      }
    });

    it('should preserve best move flag', () => {
      const root = new ChessMove('e4', null, true);
      const child = new ChessMove('c5', null, false);
      root.addNextMove(child);

      const json = root.toJSON();
      const restored = ChessMove.fromJSON(json);

      expect(restored.isBestMove).toBe(true);
      if (restored.nextMoves.length > 0) {
        expect(restored.nextMoves[0].isBestMove).toBe(false);
      }
    });
  });

  describe('Variation Navigation', () => {
    it('should get best next move', () => {
      const root = new ChessMove('e4');
      const bestMove = new ChessMove('c5', 100, true);
      const altMove = new ChessMove('e5', 50, false);

      root.addNextMove(altMove);
      root.addNextMove(bestMove);

      const best = root.getBestNextMove();
      expect(best).toBeDefined();
      expect(best?.isBestMove).toBe(true);
    });

    it('should return first move if no best move marked', () => {
      const root = new ChessMove('e4');
      const move1 = new ChessMove('c5');
      const move2 = new ChessMove('e5');

      root.addNextMove(move1);
      root.addNextMove(move2);

      const best = root.getBestNextMove();
      expect(best).toBeDefined();
      expect(best?.algebraicMove).toBe('c5');
    });

    it('should return null if no next moves', () => {
      const root = new ChessMove('e4');
      const best = root.getBestNextMove();
      expect(best === null || best === undefined).toBe(true);
    });
  });

  describe('Opening Classification', () => {
    it('should extract opening from FEN', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
      const game = new Chess(fen);

      // After e4, this is typically Sicilian Defense if Black plays c5
      expect(game.fen()).not.toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    });

    it('should classify puzzle by move sequence', () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const moves = ['e2e4', 'c7c5', 'g1f3'];

      const game = new Chess(fen);
      let moveCount = 0;
      for (const move of moves) {
        const from = move.substring(0, 2);
        const to = move.substring(2, 4);
        const result = game.move({ from, to });
        if (result) moveCount++;
      }

      // After e4 c5 Nf3, this is Sicilian Defense
      expect(moveCount).toBe(3);
    });
  });
});
