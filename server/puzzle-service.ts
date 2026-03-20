import { Chess } from 'chess.js';
import { ChessMove, calculateDifficulty } from './chess-move-tree';
import { buildMoveTree, flattenMoveTree, getAllVariations, algebraicToUCI } from './pgn-parser';
import { getPuzzleById, updatePuzzleVariations, updatePuzzleDifficulty } from './db';

/**
 * Load a puzzle and build its ChessMove variation tree
 */
export async function loadPuzzleWithVariations(puzzleId: string) {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle not found: ${puzzleId}`);
  }

  // Parse moves from algebraic notation
  const moves = parseMovesList(puzzle.moves);
  
  // Build variation tree
  const variationTree = buildMoveTree(puzzle.fen, moves);
  
  return {
    puzzle,
    variationTree,
    mainLine: variationTree ? flattenMoveTree(variationTree) : [],
    allVariations: variationTree ? getAllVariations(variationTree) : [],
  };
}

/**
 * Parse a moves string (comma or space-separated algebraic notation)
 */
export function parseMovesList(movesString: string): string[] {
  if (!movesString) return [];
  
  // Split by comma or space
  const moves = movesString.split(/[,\s]+/).filter(m => m.length > 0);
  
  // Filter out move numbers (e.g., "1.", "2.")
  return moves.filter(m => !/^\d+\./.test(m));
}

/**
 * Analyze puzzle difficulty using Stockfish
 * Returns difficulty score and stores it in database
 */
export async function analyzePuzzleDifficulty(
  puzzleId: string,
  analyzeFunction: (fen: string) => Promise<{ score: number; mate: number | null }>
): Promise<number> {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle not found: ${puzzleId}`);
  }

  const moves = parseMovesList(puzzle.moves);
  const game = new Chess(puzzle.fen);
  const evaluations: number[] = [];

  // Evaluate position before each move
  for (const move of moves) {
    try {
      const result = await analyzeFunction(game.fen());
      evaluations.push(result.score);
      
      // Make the move
      const moveResult = game.move(move, { sloppy: true });
      if (!moveResult) {
        console.warn(`Invalid move: ${move} in puzzle ${puzzleId}`);
        break;
      }
    } catch (error) {
      console.error(`Error analyzing position in puzzle ${puzzleId}:`, error);
      break;
    }
  }

  // Calculate difficulty
  const difficulty = calculateDifficulty(evaluations);
  
  // Store in database
  await updatePuzzleDifficulty(puzzleId, difficulty);
  
  return difficulty;
}

/**
 * Build and store variation tree for a puzzle
 */
export async function buildAndStorePuzzleVariations(puzzleId: string): Promise<void> {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    throw new Error(`Puzzle not found: ${puzzleId}`);
  }

  const moves = parseMovesList(puzzle.moves);
  const variationTree = buildMoveTree(puzzle.fen, moves);
  
  if (variationTree) {
    // Store as JSON
    const variationsJson = JSON.stringify(variationTree.toJSON());
    await updatePuzzleVariations(puzzleId, variationsJson);
  }
}

/**
 * Get puzzle with all variation data
 */
export async function getPuzzleWithAllData(puzzleId: string) {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) {
    return null;
  }

  const moves = parseMovesList(puzzle.moves);
  const variationTree = buildMoveTree(puzzle.fen, moves);
  
  return {
    id: puzzle.id,
    fen: puzzle.fen,
    moves: moves,
    moveCount: moves.length,
    rating: puzzle.rating,
    difficulty: puzzle.difficulty,
    opening: puzzle.openingName,
    themes: puzzle.themes,
    color: puzzle.color,
    variationTree,
    mainLine: variationTree ? flattenMoveTree(variationTree) : [],
    allVariations: variationTree ? getAllVariations(variationTree) : [],
    numAttempts: puzzle.numAttempts || 0,
    numSolved: puzzle.numSolved || 0,
    successRate: puzzle.numAttempts ? (puzzle.numSolved || 0) / puzzle.numAttempts : 0,
  };
}

/**
 * Batch analyze puzzles for difficulty
 */
export async function batchAnalyzePuzzleDifficulty(
  puzzleIds: string[],
  analyzeFunction: (fen: string) => Promise<{ score: number; mate: number | null }>,
  onProgress?: (completed: number, total: number) => void
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  
  for (let i = 0; i < puzzleIds.length; i++) {
    try {
      const difficulty = await analyzePuzzleDifficulty(puzzleIds[i], analyzeFunction);
      results.set(puzzleIds[i], difficulty);
    } catch (error) {
      console.error(`Failed to analyze puzzle ${puzzleIds[i]}:`, error);
    }
    
    if (onProgress) {
      onProgress(i + 1, puzzleIds.length);
    }
  }
  
  return results;
}

/**
 * Batch build and store variations for puzzles
 */
export async function batchBuildVariations(
  puzzleIds: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < puzzleIds.length; i++) {
    try {
      await buildAndStorePuzzleVariations(puzzleIds[i]);
    } catch (error) {
      console.error(`Failed to build variations for puzzle ${puzzleIds[i]}:`, error);
    }
    
    if (onProgress) {
      onProgress(i + 1, puzzleIds.length);
    }
  }
}

/**
 * Convert puzzle moves to UCI format for Stockfish
 */
export function convertPuzzleMovesToUCI(fen: string, moves: string[]): string[] {
  return algebraicToUCI(fen, moves);
}
