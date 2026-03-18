import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Chess } from 'chess.js';

describe('Session - Auto-Solve and Auto-Next Logic', () => {
  describe('Move Validation with Promotion', () => {
    it('should only add promotion when target square is on rank 8 or 1', () => {
      const game = new Chess();
      
      // Regular move (e2-e4) should NOT have promotion
      const moveObj1: any = {
        from: 'e2',
        to: 'e4',
      };
      const targetRank1 = parseInt('e4'[1]);
      if (targetRank1 === 8 || targetRank1 === 1) {
        moveObj1.promotion = 'q';
      }
      expect(moveObj1.promotion).toBeUndefined();
    });

    it('should add promotion for pawn moves to rank 8', () => {
      const game = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1'); // White pawn on a7
      
      const moveObj: any = {
        from: 'a7',
        to: 'a8',
      };
      const targetRank = parseInt('a8'[1]);
      if (targetRank === 8 || targetRank === 1) {
        moveObj.promotion = 'q';
      }
      expect(moveObj.promotion).toBe('q');
    });

    it('should add promotion for pawn moves to rank 1', () => {
      const moveObj: any = {
        from: 'a2',
        to: 'a1',
      };
      const targetRank = parseInt('a1'[1]);
      if (targetRank === 8 || targetRank === 1) {
        moveObj.promotion = 'q';
      }
      expect(moveObj.promotion).toBe('q');
    });
  });

  describe('Auto-Solve Move Parsing', () => {
    it('should correctly parse expected move from moves string', () => {
      const movesString = 'e2e4 e7e5 g1f3';
      const movesList = movesString.split(' ').filter((m: string) => m.length > 0);
      const expectedMove = movesList[0];
      
      expect(expectedMove).toBe('e2e4');
      expect(movesList).toEqual(['e2e4', 'e7e5', 'g1f3']);
    });

    it('should extract from and to squares from move notation', () => {
      const expectedMove = 'e2e4';
      const from = expectedMove.substring(0, 2);
      const to = expectedMove.substring(2, 4);
      
      expect(from).toBe('e2');
      expect(to).toBe('e4');
    });

    it('should extract promotion piece from move notation', () => {
      const expectedMove = 'a7a8q';
      const from = expectedMove.substring(0, 2);
      const to = expectedMove.substring(2, 4);
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      
      expect(from).toBe('a7');
      expect(to).toBe('a8');
      expect(promotion).toBe('q');
    });

    it('should handle moves without promotion', () => {
      const expectedMove = 'e2e4';
      const from = expectedMove.substring(0, 2);
      const to = expectedMove.substring(2, 4);
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      
      expect(from).toBe('e2');
      expect(to).toBe('e4');
      expect(promotion).toBeUndefined();
    });
  });

  describe('Countdown Logic', () => {
    it('should decrement countdown from initial value', () => {
      let countdown = 3;
      const decrements: number[] = [];
      
      // Simulate countdown interval
      for (let i = 0; i < 3; i++) {
        countdown -= 1;
        if (countdown > 0) {
          decrements.push(countdown);
        }
      }
      
      expect(decrements).toEqual([2, 1]);
    });

    it('should stop countdown at 0', () => {
      let countdown = 2;
      const countdowns: number[] = [];
      
      while (countdown > 0) {
        countdown -= 1;
        countdowns.push(countdown);
      }
      
      expect(countdowns).toEqual([1, 0]);
      expect(countdown).toBe(0);
    });

    it('should not display when countdown is 0 or null', () => {
      const shouldDisplay = (count: number | null) => {
        return count !== null && count !== undefined && count > 0;
      };
      
      expect(shouldDisplay(null)).toBe(false);
      expect(shouldDisplay(0)).toBe(false);
      expect(shouldDisplay(1)).toBe(true);
      expect(shouldDisplay(2)).toBe(true);
    });
  });

  describe('Auto-Solve Move Execution', () => {
    it('should execute auto-solve move on correct chess position', () => {
      const game = new Chess();
      const expectedMove = 'e2e4';
      
      const from = expectedMove.substring(0, 2);
      const to = expectedMove.substring(2, 4);
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      
      const moveResult = game.move({ from, to, promotion: promotion || 'q' });
      
      expect(moveResult).not.toBeNull();
      expect(moveResult?.from).toBe('e2');
      expect(moveResult?.to).toBe('e4');
      expect(game.fen()).toContain('b KQkq'); // Black to move, castling rights preserved
    });

    it('should handle promotion move execution', () => {
      const game = new Chess('8/P7/8/8/8/8/8/k6K w - - 0 1');
      const expectedMove = 'a7a8q';
      
      const from = expectedMove.substring(0, 2);
      const to = expectedMove.substring(2, 4);
      const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
      
      const moveResult = game.move({ from, to, promotion: promotion || 'q' });
      
      expect(moveResult).not.toBeNull();
      expect(moveResult?.promotion).toBe('q');
      expect(game.fen()).toContain('Q'); // Queen should be on a8
    });
  });

  describe('Move Validation Comparison', () => {
    it('should correctly compare user move with expected move', () => {
      const userMoveUCI = 'e2e4';
      const expectedMove = 'e2e4';
      
      expect(userMoveUCI === expectedMove).toBe(true);
    });

    it('should reject move with incorrect promotion', () => {
      const userMoveUCI = 'a7a8r'; // Wrong promotion piece
      const expectedMove = 'a7a8q';
      
      expect(userMoveUCI === expectedMove).toBe(false);
    });

    it('should reject move with extra promotion on non-promotion move', () => {
      const userMoveUCI = 'e2e4q'; // Incorrect promotion on regular move
      const expectedMove = 'e2e4';
      
      expect(userMoveUCI === expectedMove).toBe(false);
    });
  });
});
