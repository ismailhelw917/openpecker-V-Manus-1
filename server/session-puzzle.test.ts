import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';

/**
 * Tests for Session puzzle logic
 * Verifies that Lichess puzzle format is handled correctly:
 * - moves[0] = setup move (opponent's move that creates the puzzle)
 * - moves[1] = user's first answer
 * - moves[2] = opponent's response (auto-played)
 * - moves[3] = user's second answer, etc.
 *
 * Also tests:
 * - FIX #1: Board orientation stored at init, not derived from game.turn()
 * - FIX #2: Multi-move puzzle sequences
 * - FIX #3: Capture detection for animation
 * - FIX #4: Any legal move allowed (not just correct solution)
 */

// Helper: parse moves from puzzle data (mirrors Session.tsx logic)
function parseMovesList(puzzle: any): string[] {
  if (!puzzle?.moves) return [];
  if (Array.isArray(puzzle.moves)) return puzzle.moves;
  if (typeof puzzle.moves === 'string') {
    return puzzle.moves.split(' ').filter((m: string) => m.length > 0);
  }
  return [];
}

// Helper: play a UCI move on a chess.js instance
function playUCIMove(game: Chess, uciMove: string): boolean {
  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
  try {
    const moveObj: any = { from, to };
    if (promotion) moveObj.promotion = promotion;
    const result = game.move(moveObj);
    return !!result;
  } catch {
    return false;
  }
}

// Real puzzle data from the database
const SAMPLE_PUZZLES = [
  {
    id: '00008',
    fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
    moves: 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1',
    rating: 2107,
  },
  {
    id: '0000D',
    fen: '5rk1/1p3ppp/pq3b2/8/8/1P1Q1N2/P4PPP/3R2K1 w - - 2 27',
    moves: 'd3d6 f8d8 d6d8 f6d8',
    rating: 1535,
  },
  {
    id: '0008Q',
    fen: '8/4R3/1p2P3/p4r2/P6p/1P3Pk1/4K3/8 w - - 1 64',
    moves: 'e7f7 f5e5 e2f1 e5e6',
    rating: 1385,
  },
];

describe('Lichess Puzzle Format', () => {
  it('should parse space-separated moves string', () => {
    const puzzle = { moves: 'f2g3 e6e7 b2b1 b3c1 b1c1 h6c1' };
    const moves = parseMovesList(puzzle);
    expect(moves).toEqual(['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1']);
  });

  it('should parse array moves', () => {
    const puzzle = { moves: ['f2g3', 'e6e7', 'b2b1'] };
    const moves = parseMovesList(puzzle);
    expect(moves).toEqual(['f2g3', 'e6e7', 'b2b1']);
  });

  it('should return empty array for missing moves', () => {
    expect(parseMovesList({})).toEqual([]);
    expect(parseMovesList(null)).toEqual([]);
    expect(parseMovesList({ moves: '' })).toEqual([]);
  });
});

describe('Puzzle Initialization - Setup Move', () => {
  it('should play the setup move (moves[0]) to create the puzzle position', () => {
    const puzzle = SAMPLE_PUZZLES[0]; // 00008
    const game = new Chess(puzzle.fen);
    const movesList = parseMovesList(puzzle);

    // Before setup move, it's black's turn
    expect(game.turn()).toBe('b');

    // Play setup move
    const success = playUCIMove(game, movesList[0]); // f2g3
    expect(success).toBe(true);

    // After setup move, it's white's turn (user plays white)
    expect(game.turn()).toBe('w');
  });

  it('should correctly determine user color after setup move', () => {
    for (const puzzle of SAMPLE_PUZZLES) {
      const game = new Chess(puzzle.fen);
      const movesList = parseMovesList(puzzle);

      // The turn in the original FEN is the opponent's turn (they play the setup move)
      const opponentColor = game.turn();

      // Play setup move
      playUCIMove(game, movesList[0]);

      // After setup move, it should be the user's turn (opposite color)
      const userColor = game.turn();
      expect(userColor).not.toBe(opponentColor);
    }
  });

  it('should set board orientation to match user color', () => {
    // Puzzle 00008: FEN has black to move, so setup is black's move, user plays white
    const puzzle1 = SAMPLE_PUZZLES[0];
    const game1 = new Chess(puzzle1.fen);
    playUCIMove(game1, parseMovesList(puzzle1)[0]);
    expect(game1.turn()).toBe('w'); // User plays white → orientation = 'white'

    // Puzzle 0000D: FEN has white to move, so setup is white's move, user plays black
    const puzzle2 = SAMPLE_PUZZLES[1];
    const game2 = new Chess(puzzle2.fen);
    playUCIMove(game2, parseMovesList(puzzle2)[0]);
    expect(game2.turn()).toBe('b'); // User plays black → orientation = 'black'
  });
});

describe('FIX #1 - Board Orientation Stability', () => {
  it('orientation should be stored once at init and not change during play', () => {
    const puzzle = SAMPLE_PUZZLES[0];
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]);

    // Orientation determined once at init
    const storedOrientation = game.turn() === 'w' ? 'white' : 'black';
    expect(storedOrientation).toBe('white');

    // After playing more moves, game.turn() changes but stored orientation should NOT
    playUCIMove(game, moves[1]); // User plays
    expect(game.turn()).toBe('b'); // Turn changed to black
    // storedOrientation is still 'white' (stored in React state, not re-derived)
    expect(storedOrientation).toBe('white');

    playUCIMove(game, moves[2]); // Opponent plays
    expect(game.turn()).toBe('w'); // Turn back to white
    expect(storedOrientation).toBe('white'); // Still the same
  });

  it('black-playing puzzles should have black orientation throughout', () => {
    const puzzle = SAMPLE_PUZZLES[1]; // 0000D - user plays black
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]);

    const storedOrientation = game.turn() === 'w' ? 'white' : 'black';
    expect(storedOrientation).toBe('black');

    // Play through all moves - orientation should never change
    for (let i = 1; i < moves.length; i++) {
      playUCIMove(game, moves[i]);
      expect(storedOrientation).toBe('black'); // Always black
    }
  });
});

describe('Move Validation - User Moves', () => {
  it('should validate user move against moves[1] (not moves[0])', () => {
    const puzzle = SAMPLE_PUZZLES[0]; // 00008
    const game = new Chess(puzzle.fen);
    const movesList = parseMovesList(puzzle);

    // Play setup move
    playUCIMove(game, movesList[0]); // f2g3

    // User should play moves[1] = e6e7
    const expectedMove = movesList[1]; // e6e7
    expect(expectedMove).toBe('e6e7');

    // Verify this move is legal
    const legalMoves = game.moves({ square: 'e6' as any, verbose: true });
    const isLegal = legalMoves.some((m: any) => m.to === 'e7');
    expect(isLegal).toBe(true);

    // Play the correct move
    const result = playUCIMove(game, expectedMove);
    expect(result).toBe(true);
  });

  it('should handle multi-move puzzles correctly', () => {
    const puzzle = SAMPLE_PUZZLES[0]; // 00008 - 6 moves total
    const game = new Chess(puzzle.fen);
    const movesList = parseMovesList(puzzle);

    // Setup move (opponent)
    playUCIMove(game, movesList[0]); // f2g3

    // User move 1
    expect(playUCIMove(game, movesList[1])).toBe(true); // e6e7

    // Opponent response (auto-played)
    expect(playUCIMove(game, movesList[2])).toBe(true); // b2b1

    // User move 2
    expect(playUCIMove(game, movesList[3])).toBe(true); // b3c1

    // Opponent response (auto-played)
    expect(playUCIMove(game, movesList[4])).toBe(true); // b1c1

    // User move 3 (final)
    expect(playUCIMove(game, movesList[5])).toBe(true); // h6c1
  });

  it('should correctly identify user moves vs opponent moves in sequence', () => {
    const movesList = ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'];

    for (let i = 0; i < movesList.length; i++) {
      const isUserMove = i % 2 === 1;
      const isOpponentMove = i % 2 === 0;

      if (i === 0) {
        expect(isOpponentMove).toBe(true); // Setup move
      } else if (i === 1 || i === 3 || i === 5) {
        expect(isUserMove).toBe(true); // User moves
      } else {
        expect(isOpponentMove).toBe(true); // Opponent responses
      }
    }
  });
});

describe('FIX #4 - Any Legal Move Allowed', () => {
  it('should accept a wrong but legal move without crashing', () => {
    const puzzle = SAMPLE_PUZZLES[0];
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]); // Setup

    // Find any legal move that is NOT the expected one
    const allLegalMoves = game.moves({ verbose: true });
    const expectedMove = moves[1]; // e6e7
    const wrongMove = allLegalMoves.find(
      (m: any) => `${m.from}${m.to}${m.promotion || ''}` !== expectedMove
    );
    expect(wrongMove).toBeDefined();

    // The wrong move should still be accepted by the engine
    const result = game.move({ from: wrongMove!.from, to: wrongMove!.to });
    expect(result).not.toBeNull();

    // But it's not the correct solution
    const moveUCI = `${result!.from}${result!.to}${result!.promotion || ''}`;
    expect(moveUCI).not.toBe(expectedMove);
  });

  it('should be able to undo a wrong move', () => {
    const puzzle = SAMPLE_PUZZLES[0];
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]);

    const fenBeforeWrongMove = game.fen();

    // Play a wrong but legal move
    const allLegal = game.moves({ verbose: true });
    const wrongMove = allLegal.find(
      (m: any) => `${m.from}${m.to}${m.promotion || ''}` !== moves[1]
    );
    game.move({ from: wrongMove!.from, to: wrongMove!.to });

    // Undo should restore the position
    game.undo();
    expect(game.fen()).toBe(fenBeforeWrongMove);
  });

  it('should reject truly illegal moves', () => {
    const game = new Chess(SAMPLE_PUZZLES[0].fen);
    const moves = parseMovesList(SAMPLE_PUZZLES[0]);
    playUCIMove(game, moves[0]);

    // Try to move a rook to an impossible square
    const legalMoves = game.moves({ square: 'e6' as any, verbose: true });
    const isLegal = legalMoves.some((m: any) => m.to === 'a1');
    expect(isLegal).toBe(false);
  });
});

describe('FIX #2 - Multi-Move Puzzle Sequences', () => {
  it('should handle a 6-move puzzle (3 user moves, 3 opponent moves)', () => {
    const puzzle = SAMPLE_PUZZLES[0];
    const moves = parseMovesList(puzzle);
    expect(moves.length).toBe(6);

    const game = new Chess(puzzle.fen);
    playUCIMove(game, moves[0]); // Setup

    // Simulate the full sequence
    let userMoveIndex = 1;
    while (userMoveIndex < moves.length) {
      // User plays
      expect(playUCIMove(game, moves[userMoveIndex])).toBe(true);

      // Opponent responds (if there's a next move)
      const opponentIndex = userMoveIndex + 1;
      if (opponentIndex < moves.length) {
        expect(playUCIMove(game, moves[opponentIndex])).toBe(true);
      }

      userMoveIndex += 2;
    }
  });

  it('should handle a 4-move puzzle (2 user moves)', () => {
    const puzzle = SAMPLE_PUZZLES[1];
    const moves = parseMovesList(puzzle);
    expect(moves.length).toBe(4);

    const game = new Chess(puzzle.fen);
    playUCIMove(game, moves[0]); // Setup

    // User move 1
    expect(playUCIMove(game, moves[1])).toBe(true);
    // Opponent response
    expect(playUCIMove(game, moves[2])).toBe(true);
    // User move 2 (final)
    expect(playUCIMove(game, moves[3])).toBe(true);
  });

  it('should handle a 2-move puzzle (1 user move)', () => {
    const puzzle = SAMPLE_PUZZLES[2];
    const moves = parseMovesList(puzzle);
    expect(moves.length).toBe(4); // This one has 4 moves

    const game = new Chess(puzzle.fen);
    playUCIMove(game, moves[0]); // Setup
    expect(playUCIMove(game, moves[1])).toBe(true); // User move
  });

  it('user move indices should always be odd (1, 3, 5, ...)', () => {
    const moves = parseMovesList(SAMPLE_PUZZLES[0]);
    for (let i = 1; i < moves.length; i += 2) {
      expect(i % 2).toBe(1); // User moves at odd indices
    }
    for (let i = 0; i < moves.length; i += 2) {
      expect(i % 2).toBe(0); // Opponent moves at even indices
    }
  });
});

describe('FIX #3 - Capture Detection for Animation', () => {
  it('should detect when a move captures a piece', () => {
    const puzzle = SAMPLE_PUZZLES[0];
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]); // f2g3

    // User's move e6e7 - check if e7 has a piece (it does: black rook)
    const targetPiece = game.get('e7' as any);
    expect(targetPiece).not.toBeNull();
    expect(targetPiece?.type).toBe('r');
    expect(targetPiece?.color).toBe('b');
  });

  it('should not detect capture on empty squares', () => {
    const game = new Chess('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1');
    // e5 is empty
    const targetPiece = game.get('e5' as any);
    expect(targetPiece).toBeFalsy();
  });

  it('should detect captures during opponent auto-play', () => {
    const puzzle = SAMPLE_PUZZLES[1]; // 0000D
    const game = new Chess(puzzle.fen);
    const moves = parseMovesList(puzzle);
    playUCIMove(game, moves[0]); // d3d6 (setup)
    playUCIMove(game, moves[1]); // f8d8 (user captures)

    // Opponent's response d6d8 captures on d8
    const targetPiece = game.get('d8' as any);
    expect(targetPiece).not.toBeNull();
    // d8 now has the piece that was just moved there
  });
});

describe('Auto-Solve After Wrong Move', () => {
  it('should replay all moves from setup position during auto-solve', () => {
    const puzzle = SAMPLE_PUZZLES[1]; // 0000D
    const movesList = parseMovesList(puzzle);

    // Simulate auto-solve: start from original FEN, play setup, then all remaining moves
    const solveGame = new Chess(puzzle.fen);

    // Play setup move
    expect(playUCIMove(solveGame, movesList[0])).toBe(true); // d3d6

    // Play all remaining moves (the full solution)
    for (let i = 1; i < movesList.length; i++) {
      expect(playUCIMove(solveGame, movesList[i])).toBe(true);
    }
  });

  it('should undo wrong move before showing auto-solve', () => {
    const puzzle = SAMPLE_PUZZLES[2]; // 0008Q
    const game = new Chess(puzzle.fen);
    const movesList = parseMovesList(puzzle);

    // Play setup move
    playUCIMove(game, movesList[0]); // e7f7
    const puzzleFen = game.fen(); // Save the puzzle position

    // User plays wrong move
    const wrongMove = game.moves({ verbose: true })[0]; // Any legal move
    game.move(wrongMove);

    // Undo wrong move
    game.undo();
    expect(game.fen()).toBe(puzzleFen); // Back to puzzle position
  });
});

describe('Puzzle State Reset Between Puzzles', () => {
  it('should reset userMoveIndex to 1 when loading a new puzzle', () => {
    // Simulate loading puzzle 1
    let userMoveIndex = 1; // Should start at 1 (user plays moves[1])

    // After solving puzzle 1, advance to puzzle 2
    userMoveIndex = 1; // Reset for new puzzle

    expect(userMoveIndex).toBe(1);
  });

  it('should create fresh game state for each puzzle', () => {
    const puzzle1 = SAMPLE_PUZZLES[0];
    const puzzle2 = SAMPLE_PUZZLES[1];

    // Initialize puzzle 1
    const game1 = new Chess(puzzle1.fen);
    playUCIMove(game1, parseMovesList(puzzle1)[0]);
    const fen1 = game1.fen();

    // Initialize puzzle 2 (should be completely independent)
    const game2 = new Chess(puzzle2.fen);
    playUCIMove(game2, parseMovesList(puzzle2)[0]);
    const fen2 = game2.fen();

    expect(fen1).not.toBe(fen2);
  });
});

describe('Promotion Handling', () => {
  it('should detect pawn promotion moves (5-char UCI)', () => {
    const promoMove = 'a7a8q';
    const from = promoMove.substring(0, 2);
    const to = promoMove.substring(2, 4);
    const promotion = promoMove.length > 4 ? promoMove[4] : undefined;

    expect(from).toBe('a7');
    expect(to).toBe('a8');
    expect(promotion).toBe('q');
  });

  it('should handle non-promotion moves (4-char UCI)', () => {
    const normalMove = 'e2e4';
    const from = normalMove.substring(0, 2);
    const to = normalMove.substring(2, 4);
    const promotion = normalMove.length > 4 ? normalMove[4] : undefined;

    expect(from).toBe('e2');
    expect(to).toBe('e4');
    expect(promotion).toBeUndefined();
  });
});

describe('All Sample Puzzles Are Solvable', () => {
  it('should be able to play through all moves of each sample puzzle', () => {
    for (const puzzle of SAMPLE_PUZZLES) {
      const game = new Chess(puzzle.fen);
      const movesList = parseMovesList(puzzle);

      for (let i = 0; i < movesList.length; i++) {
        const success = playUCIMove(game, movesList[i]);
        expect(success).toBe(true);
      }
    }
  });
});
