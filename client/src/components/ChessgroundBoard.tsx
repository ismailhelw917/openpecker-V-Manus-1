import { useEffect, useRef, useMemo } from 'react';
import { Chessground as ChessgroundAPI } from 'chessground';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';
import { Chess } from 'chess.js';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

interface ChessgroundBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string) => boolean | Promise<boolean>;
  lastMove?: [string, string] | null;
  legalMoves?: Map<string, string[]>;
  check?: string | null;
  turnColor?: 'white' | 'black';
  boardSize?: number;
  theme?: 'brown' | 'blue' | 'green';
  interactive?: boolean;
}

/**
 * Compute legal move destinations from a FEN string using chess.js.
 * Returns a Map<square, square[]> that Chessground uses for `movable.dests`.
 */
function computeDestsFromFen(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    for (const move of moves) {
      const existing = dests.get(move.from);
      if (existing) {
        existing.push(move.to);
      } else {
        dests.set(move.from, [move.to]);
      }
    }
  } catch (e) {
    console.error('Failed to compute legal moves from FEN:', e);
  }
  return dests;
}

/**
 * Determine the turn color from a FEN string.
 */
function turnColorFromFen(fen: string): 'white' | 'black' {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'black' : 'white';
}

/**
 * Determine if the king is in check from a FEN string.
 */
function isInCheck(fen: string): boolean {
  try {
    const chess = new Chess(fen);
    return chess.isCheck();
  } catch {
    return false;
  }
}

export const ChessgroundBoard: React.FC<ChessgroundBoardProps> = ({
  fen,
  orientation = 'white',
  onMove,
  lastMove,
  legalMoves,
  check,
  turnColor,
  boardSize = 400,
  interactive = true,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);

  // Keep onMove ref up to date without triggering re-renders
  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Derive turn color from FEN if not explicitly provided
  const derivedTurnColor = turnColor || turnColorFromFen(fen);

  // Compute legal moves from FEN if not explicitly provided
  const destsMap = useMemo(() => {
    if (!interactive) return new Map<string, string[]>();
    if (legalMoves) {
      if (legalMoves instanceof Map) return legalMoves;
      return new Map(Object.entries(legalMoves));
    }
    return computeDestsFromFen(fen);
  }, [fen, legalMoves, interactive]);

  // Determine check state
  const inCheck = check !== undefined ? (check ? true : false) : isInCheck(fen);

  useEffect(() => {
    if (!boardRef.current) return;

    const config: Config = {
      fen,
      orientation,
      turnColor: derivedTurnColor,
      check: inCheck,
      lastMove: (lastMove || undefined) as any,
      movable: {
        free: false,
        color: interactive ? derivedTurnColor : undefined,
        dests: interactive ? (destsMap as any) : undefined,
        events: {
          after: (from, to) => {
            if (onMoveRef.current) {
              const result = onMoveRef.current(from, to);
              if (result instanceof Promise) {
                result.then((isValid) => {
                  if (!isValid && cgRef.current) {
                    cgRef.current.set({ fen });
                  }
                });
              } else if (!result && cgRef.current) {
                cgRef.current.set({ fen });
              }
            }
          },
        },
      },
      drawable: {
        enabled: true,
        visible: true,
      },
      coordinates: true,
      animation: {
        enabled: true,
        duration: 200,
      },
    };

    if (!cgRef.current) {
      cgRef.current = ChessgroundAPI(boardRef.current, config);
    } else {
      cgRef.current.set(config);
    }
  }, [fen, orientation, lastMove, destsMap, inCheck, derivedTurnColor, interactive]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={boardRef}
      style={{
        width: `${boardSize}px`,
        height: `${boardSize}px`,
        touchAction: 'none', // Critical for mobile drag support
      }}
      className="cg-wrap"
    />
  );
};
