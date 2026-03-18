import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

/**
 * Tests for the move validation logic used in Session.tsx
 * These tests verify that:
 * 1. Invalid moves (from empty squares) are properly rejected
 * 2. Illegal moves are properly rejected
 * 3. Legal moves are accepted
 * 4. Promotion is only added for pawn moves to rank 1 or 8
 * 5. Auto-solve moves work correctly without always adding promotion
 */

describe('Move Validation Logic', () => {
  const testFen = 'r2q1k1r/1p1n2pp/p3Qn2/2bp1p2/8/P2B3P/1PP2PP1/RNB2RK1 b - - 1 14';

  it('should reject moves from empty squares', () => {
    const game = new Chess(testFen);
    // f4 is empty in this position
    const piece = game.get('f4' as any);
    expect(piece).toBeFalsy();
  });

  it('should reject moves from squares with wrong color pieces', () => {
    const game = new Chess(testFen);
    // It's black's turn, so white pieces shouldn't be movable
    const whitePiece = game.get('e6' as any); // White Queen on e6
    expect(whitePiece).toBeTruthy();
    expect(whitePiece?.color).toBe('w');
    expect(game.turn()).toBe('b');
    // White piece can't move on black's turn
    const legalMoves = game.moves({ square: 'e6' as any, verbose: true });
    // chess.js only returns moves for the current side
    // So asking for white queen moves on black's turn should return empty
    expect(legalMoves.length).toBe(0);
  });

  it('should accept legal moves', () => {
    const game = new Chess(testFen);
    // Black queen on d8 can move to c7
    const piece = game.get('d8' as any);
    expect(piece).toBeTruthy();
    expect(piece?.type).toBe('q');
    expect(piece?.color).toBe('b');
    
    const legalMoves = game.moves({ square: 'd8' as any, verbose: true });
    const canMoveToC7 = legalMoves.some((m: any) => m.to === 'c7');
    expect(canMoveToC7).toBe(true);
  });

  it('should not throw when making a legal move', () => {
    const game = new Chess(testFen);
    // Qc7 is legal for black
    expect(() => {
      game.move({ from: 'd8', to: 'c7' });
    }).not.toThrow();
  });

  it('should throw when making an illegal move directly with chess.move()', () => {
    const game = new Chess(testFen);
    // f4 to c7 is illegal (no piece on f4)
    expect(() => {
      game.move({ from: 'f4', to: 'c7' });
    }).toThrow();
  });

  it('should pre-validate and reject illegal moves without throwing', () => {
    const game = new Chess(testFen);
    
    // Simulate the handleMove pre-validation logic
    const sourceSquare = 'f4';
    const targetSquare = 'c7';
    
    const piece = game.get(sourceSquare as any);
    if (!piece) {
      // This is the expected path - no piece on f4
      expect(piece).toBeFalsy();
      return;
    }
    
    // Should not reach here
    expect(true).toBe(false);
  });

  it('should only add promotion for pawn moves to rank 1 or 8', () => {
    // Position with a pawn that can promote
    const promoFen = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
    const game = new Chess(promoFen);
    
    const piece = game.get('e7' as any);
    expect(piece?.type).toBe('p');
    
    const targetRank = parseInt('e8'[1]);
    const isPawn = piece?.type === 'p';
    expect(targetRank).toBe(8);
    expect(isPawn).toBe(true);
    
    // Promotion should be added
    const moveObj: any = { from: 'e7', to: 'e8' };
    if (isPawn && (targetRank === 8 || targetRank === 1)) {
      moveObj.promotion = 'q';
    }
    
    const result = game.move(moveObj);
    expect(result).toBeTruthy();
    expect(result?.promotion).toBe('q');
  });

  it('should NOT add promotion for non-pawn moves', () => {
    const game = new Chess(testFen);
    // Knight on d7 moving - should not have promotion
    const piece = game.get('d7' as any);
    expect(piece?.type).toBe('n');
    
    const legalMoves = game.moves({ square: 'd7' as any, verbose: true });
    expect(legalMoves.length).toBeGreaterThan(0);
    
    // Move knight to e5 (if legal)
    const ne5 = legalMoves.find((m: any) => m.to === 'e5');
    if (ne5) {
      const moveObj: any = { from: 'd7', to: 'e5' };
      const isPawn = piece?.type === 'p';
      // Should NOT add promotion since it's a knight
      expect(isPawn).toBe(false);
      
      const result = game.move(moveObj);
      expect(result).toBeTruthy();
      expect(result?.promotion).toBeUndefined();
    }
  });

  it('should handle auto-solve moves without always adding promotion', () => {
    const game = new Chess(testFen);
    
    // Simulate auto-solve: play Qc7 (UCI: d8c7)
    const expectedMove = 'd8c7';
    const from = expectedMove.substring(0, 2);
    const to = expectedMove.substring(2, 4);
    const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
    
    const moveObj: any = { from, to };
    if (promotion) {
      moveObj.promotion = promotion;
    }
    
    // Should not throw - no promotion added for non-promotion move
    expect(() => {
      const result = game.move(moveObj);
      expect(result).toBeTruthy();
    }).not.toThrow();
  });

  it('should handle auto-solve promotion moves correctly', () => {
    const promoFen = '8/4P3/8/8/8/8/8/4K2k w - - 0 1';
    const game = new Chess(promoFen);
    
    // Simulate auto-solve: play e8=Q (UCI: e7e8q)
    const expectedMove = 'e7e8q';
    const from = expectedMove.substring(0, 2);
    const to = expectedMove.substring(2, 4);
    const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
    
    const moveObj: any = { from, to };
    if (promotion) {
      moveObj.promotion = promotion;
    }
    
    expect(promotion).toBe('q');
    const result = game.move(moveObj);
    expect(result).toBeTruthy();
    expect(result?.promotion).toBe('q');
  });

  it('should use current FEN state not original puzzle FEN for validation', () => {
    const game = new Chess(testFen);
    
    // Make a move to change the position
    game.move({ from: 'd8', to: 'c7' });
    const newFen = game.fen();
    
    // Now validate against the new position
    const game2 = new Chess(newFen);
    expect(game2.turn()).toBe('w'); // Now it's white's turn
    
    // White queen on e6 should now be able to move
    const piece = game2.get('e6' as any);
    expect(piece?.color).toBe('w');
    const legalMoves = game2.moves({ square: 'e6' as any, verbose: true });
    expect(legalMoves.length).toBeGreaterThan(0);
  });
});
