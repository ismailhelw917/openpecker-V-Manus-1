import { Chess } from 'chess.js';
import { ChessMove, parsePGNWithVariations, calculateDifficulty, mapCentipawnValue, mapMateValue } from './chess-move-tree';

/**
 * Parse a PGN string with full variation support
 * Returns a tree structure of ChessMove objects
 */
export function parsePGNFull(pgn: string): ChessMove[] {
  // Remove comments and metadata
  const cleaned = pgn
    .replace(/\{[^}]*\}/g, '') // Remove comments in {}
    .replace(/\([^)]*\)/g, '') // Remove variations for now (we'll handle them separately)
    .replace(/\d+\./g, '') // Remove move numbers
    .trim();

  return parsePGNWithVariations(pgn);
}

/**
 * Analyze a puzzle and calculate its difficulty
 * Requires a Stockfish-compatible engine interface
 */
export async function analyzePuzzleDifficulty(
  fen: string,
  moves: string[],
  analyzeFunction: (fen: string) => Promise<{ score: number; mate: number | null }>
): Promise<number> {
  const game = new Chess(fen);
  const evaluations: number[] = [];

  for (const move of moves) {
    const result = await analyzeFunction(game.fen());
    
    // Convert evaluation to normalized strength
    let strength: number;
    if (result.mate !== null) {
      strength = mapMateValue(result.mate);
    } else {
      strength = mapCentipawnValue(result.score);
    }
    
    evaluations.push(strength);
    
    // Make the move
    const moveResult = game.move(move);
    if (!moveResult) {
      console.warn(`Invalid move: ${move} in position ${game.fen()}`);
      break;
    }
  }

  return calculateDifficulty(evaluations);
}

/**
 * Extract puzzle metadata from PGN tags
 */
export function extractPGNMetadata(pgn: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  
  // Match PGN tags like [Event "Name"]
  const tagRegex = /\[(\w+)\s+"([^"]+)"\]/g;
  let match;
  
  while ((match = tagRegex.exec(pgn)) !== null) {
    metadata[match[1]] = match[2];
  }
  
  return metadata;
}

/**
 * Parse opening name and variation from PGN tags
 */
export function parseOpeningInfo(pgn: string): { opening: string; variation: string } {
  const metadata = extractPGNMetadata(pgn);
  
  // Common PGN tags for opening info
  const opening = metadata['Opening'] || metadata['ECO'] || 'Unknown Opening';
  const variation = metadata['Variation'] || metadata['SubVariation'] || '';
  
  return { opening, variation };
}

/**
 * Convert algebraic moves to UCI format for a given position
 */
export function algebraicToUCI(fen: string, algebraicMoves: string[]): string[] {
  const game = new Chess(fen);
  const uciMoves: string[] = [];
  
  for (const algebraic of algebraicMoves) {
    const move = game.move(algebraic);
    if (move) {
      uciMoves.push(move.from + move.to + (move.promotion || ''));
    } else {
      console.warn(`Failed to convert algebraic move: ${algebraic}`);
    }
  }
  
  return uciMoves;
}

/**
 * Build a ChessMove tree from a sequence of moves with evaluations
 */
export function buildMoveTree(
  fen: string,
  moves: string[],
  evaluations: number[] = []
): ChessMove | null {
  if (moves.length === 0) return null;
  
  const game = new Chess(fen);
  let rootMove: ChessMove | null = null;
  let currentMove: ChessMove | null = null;
  
  for (let i = 0; i < moves.length; i++) {
    const algebraic = moves[i];
    const eval_score = evaluations[i] ?? null;
    const isBest = i === 0; // First move is considered best
    
    const move = new ChessMove(algebraic, eval_score, isBest);
    
    if (rootMove === null) {
      rootMove = move;
      currentMove = move;
    } else {
      currentMove!.addNextMove(move);
      currentMove = move;
    }
    
    // Make the move to advance the board state
    const moveResult = game.move(algebraic);
    if (!moveResult) {
      console.warn(`Invalid move in tree: ${algebraic}`);
      break;
    }
  }
  
  return rootMove;
}

/**
 * Flatten a ChessMove tree into a linear sequence
 */
export function flattenMoveTree(root: ChessMove | null): string[] {
  if (!root) return [];
  
  const moves: string[] = [];
  let current: ChessMove | null = root;
  
  while (current) {
    moves.push(current.algebraicMove);
    current = current.getBestNextMove();
  }
  
  return moves;
}

/**
 * Get all variations from a ChessMove tree
 */
export function getAllVariations(root: ChessMove | null): string[][] {
  if (!root) return [];
  
  const variations: string[][] = [];
  
  function traverse(move: ChessMove, path: string[]) {
    path.push(move.algebraicMove);
    
    if (move.nextMoves.length === 0) {
      variations.push([...path]);
    } else {
      for (const nextMove of move.nextMoves) {
        traverse(nextMove, path);
      }
    }
    
    path.pop();
  }
  
  traverse(root, []);
  return variations;
}
