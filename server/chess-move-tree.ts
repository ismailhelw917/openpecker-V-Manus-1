/**
 * ChessMove - Represents a single move in a chess puzzle with support for variations
 * Implements a tree structure where each move can have multiple next moves (variations)
 */
export class ChessMove {
  algebraicMove: string;
  nextMoves: ChessMove[] = [];
  evaluationScore: number | null = null;
  isBestMove: boolean = false;
  moveIndex: number = 0;

  constructor(algebraicMove: string, evaluationScore?: number, isBestMove?: boolean) {
    this.algebraicMove = algebraicMove;
    this.evaluationScore = evaluationScore ?? null;
    this.isBestMove = isBestMove ?? false;
  }

  /**
   * Add a next move (variation) to this move
   */
  addNextMove(move: ChessMove): void {
    this.nextMoves.push(move);
  }

  /**
   * Get all next moves
   */
  getNextMoves(): ChessMove[] {
    return this.nextMoves;
  }

  /**
   * Get the best next move (if marked)
   */
  getBestNextMove(): ChessMove | null {
    return this.nextMoves.find(m => m.isBestMove) || (this.nextMoves.length > 0 ? this.nextMoves[0] : null);
  }

  /**
   * Convert to JSON for storage
   */
  toJSON(): Record<string, any> {
    return {
      move: this.algebraicMove,
      eval: this.evaluationScore,
      best: this.isBestMove,
      variations: this.nextMoves.map(m => m.toJSON()),
    };
  }

  /**
   * Create from JSON
   */
  static fromJSON(data: Record<string, any>): ChessMove {
    const move = new ChessMove(data.move, data.eval, data.best);
    if (data.variations && Array.isArray(data.variations)) {
      move.nextMoves = data.variations.map((v: Record<string, any>) => ChessMove.fromJSON(v));
    }
    return move;
  }

  __repr__(): string {
    return `ChessMove(move='${this.algebraicMove}', eval=${this.evaluationScore}, variations=${this.nextMoves.length})`;
  }
}

/**
 * Parse PGN notation with variations into a ChessMove tree
 * Handles variations enclosed in parentheses
 * 
 * Example: "e4 (e5 Nf3) c5" becomes a tree with e4 as root, 
 * with two variations: e5->Nf3 and c5
 */
export function parsePGNWithVariations(pgn: string): ChessMove[] {
  const moves: ChessMove[] = [];
  let currentMoves = moves;
  const stack: ChessMove[][] = [];
  
  // Tokenize the PGN string
  const tokens = pgn.match(/\S+/g) || [];
  
  for (const token of tokens) {
    if (token === '(') {
      // Start a variation
      if (currentMoves.length > 0) {
        const lastMove = currentMoves[currentMoves.length - 1];
        stack.push(currentMoves);
        currentMoves = lastMove.nextMoves;
      }
    } else if (token === ')') {
      // End a variation
      if (stack.length > 0) {
        currentMoves = stack.pop()!;
      }
    } else if (!/^\d+\./.test(token)) {
      // It's a move (not a move number like "1.")
      const move = new ChessMove(token);
      currentMoves.push(move);
    }
  }
  
  return moves;
}

/**
 * Calculate difficulty of a puzzle based on move evaluations
 * Uses harmonic mean of differences between adjacent move strengths
 */
export function calculateDifficulty(moveEvaluations: number[]): number {
  if (moveEvaluations.length < 2) {
    return 1000; // Default difficulty for trivial puzzles
  }

  // Calculate differences between adjacent moves
  const adjacentDiffs: number[] = [];
  for (let i = 0; i < moveEvaluations.length - 1; i++) {
    const diff = Math.abs(moveEvaluations[i] - moveEvaluations[i + 1]);
    if (diff > 0) {
      adjacentDiffs.push(diff);
    }
  }

  if (adjacentDiffs.length === 0) {
    return 1000; // All moves have same strength
  }

  // Calculate harmonic mean
  const harmonicMean = adjacentDiffs.length / adjacentDiffs.reduce((sum, d) => sum + 1 / d, 0);

  // Map to difficulty scale (0-2000+)
  // Higher harmonic mean = easier to distinguish moves = lower difficulty
  // Lower harmonic mean = harder to distinguish moves = higher difficulty
  const difficultyRaw = (1 - harmonicMean) * 2000;

  // Apply exponential bounds for better difficulty distribution
  if (difficultyRaw < 500) {
    return 500 + (difficultyRaw / 500) * 500; // Beginner [500, 1000)
  } else if (difficultyRaw < 1000) {
    return 1000 + ((difficultyRaw - 500) / 500) * 500; // Easy [1000, 1500)
  } else if (difficultyRaw < 1500) {
    return 1500 + ((difficultyRaw - 1000) / 500) * 500; // Medium [1500, 2000)
  } else {
    return 2000 + ((difficultyRaw - 1500) / 500) * 500; // Hard [2000+)
  }
}

/**
 * Map Stockfish centipawn evaluation to normalized strength [0, 1]
 * where 1 = strong advantage, 0 = disadvantage
 */
export function mapCentipawnValue(centipawns: number): number {
  // Sigmoid function: 1 / (1 + e^(-x/k))
  // k = 600 is a common scaling factor for chess evaluations
  return 1 / (1 + Math.pow(2, -centipawns / 600));
}

/**
 * Map mate-in-N values to normalized strength
 * Mate in 1 = very strong (close to 1.0)
 * Mate in many = less strong (closer to 0.5)
 */
export function mapMateValue(mateInN: number): number {
  if (mateInN > 0) {
    // Mate for the side to move
    return 1.5 - 0.5 / (1 + Math.pow(2, -mateInN + 1));
  } else if (mateInN < 0) {
    // Mate for the opponent
    return -0.5 + 0.5 / (1 + Math.pow(2, mateInN + 1));
  }
  return 0.0;
}
