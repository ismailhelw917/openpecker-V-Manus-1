/**
 * UCI to Chessboard Converter
 * Converts UCI format moves to chessboard-compatible format
 */

/**
 * Convert UCI move to chessboard move object
 * @param uciMove - Move in UCI format (e.g., "e2e4", "e7e8q")
 * @returns Object with from/to squares and optional promotion
 */
export function uciToMove(uciMove: string): {
  from: string;
  to: string;
  promotion?: string;
} {
  if (!uciMove || uciMove.length < 4) {
    throw new Error('Invalid UCI move format');
  }

  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

  // Validate square notation (a-h, 1-8)
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    throw new Error('Invalid square in UCI move');
  }

  return {
    from,
    to,
    ...(promotion && { promotion }),
  };
}

/**
 * Convert chessboard move to UCI format
 * @param from - From square (e.g., "e2")
 * @param to - To square (e.g., "e4")
 * @param promotion - Optional promotion piece (q, r, b, n)
 * @returns UCI format move string
 */
export function moveToUCI(
  from: string,
  to: string,
  promotion?: string
): string {
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    throw new Error('Invalid square notation');
  }

  return `${from}${to}${promotion || ''}`;
}

/**
 * Parse square notation to coordinates
 * @param square - Square in notation (e.g., "e4")
 * @returns Object with file (0-7) and rank (0-7)
 */
export function squareToCoordinates(square: string): {
  file: number;
  rank: number;
} {
  if (!/^[a-h][1-8]$/.test(square)) {
    throw new Error('Invalid square notation');
  }

  const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
  const rank = parseInt(square[1]) - 1; // 0-7

  return { file, rank };
}

/**
 * Convert coordinates to square notation
 * @param file - File index (0-7)
 * @param rank - Rank index (0-7)
 * @returns Square in notation (e.g., "e4")
 */
export function coordinatesToSquare(file: number, rank: number): string {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) {
    throw new Error('Invalid coordinates');
  }

  return String.fromCharCode('a'.charCodeAt(0) + file) + (rank + 1);
}

/**
 * Get visual path for a move on the board
 * Useful for highlighting or animating moves
 * @param uciMove - Move in UCI format
 * @returns Object with from/to coordinates for animation
 */
export function getMoveVisualPath(uciMove: string): {
  fromCoords: { file: number; rank: number };
  toCoords: { file: number; rank: number };
  fromSquare: string;
  toSquare: string;
} {
  const move = uciToMove(uciMove);
  const fromCoords = squareToCoordinates(move.from);
  const toCoords = squareToCoordinates(move.to);

  return {
    fromCoords,
    toCoords,
    fromSquare: move.from,
    toSquare: move.to,
  };
}

/**
 * Validate UCI move format
 * @param uciMove - Move string to validate
 * @returns True if valid UCI format
 */
export function isValidUCI(uciMove: string): boolean {
  if (!uciMove || typeof uciMove !== 'string' || uciMove.length < 4) {
    return false;
  }

  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion = uciMove.length > 4 ? uciMove[4] : '';

  // Check square notation
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return false;
  }

  // Check promotion piece if present
  if (promotion && !/^[qrbn]$/.test(promotion)) {
    return false;
  }

  return true;
}

/**
 * Get square color (light or dark)
 * @param square - Square in notation (e.g., "e4")
 * @returns "light" or "dark"
 */
export function getSquareColor(square: string): 'light' | 'dark' {
  const coords = squareToCoordinates(square);
  return (coords.file + coords.rank) % 2 === 0 ? 'light' : 'dark';
}

/**
 * Get all squares between two squares (for drawing lines/paths)
 * @param fromSquare - Starting square
 * @param toSquare - Ending square
 * @returns Array of squares in the path
 */
export function getSquaresBetween(fromSquare: string, toSquare: string): string[] {
  const from = squareToCoordinates(fromSquare);
  const to = squareToCoordinates(toSquare);

  const squares: string[] = [];
  const fileStep = Math.sign(to.file - from.file);
  const rankStep = Math.sign(to.rank - from.rank);

  let file = from.file + fileStep;
  let rank = from.rank + rankStep;

  while (file !== to.file || rank !== to.rank) {
    squares.push(coordinatesToSquare(file, rank));
    file += fileStep;
    rank += rankStep;
  }

  return squares;
}
