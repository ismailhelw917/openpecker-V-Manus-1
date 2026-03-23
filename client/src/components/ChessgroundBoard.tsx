import { useEffect, useRef, useMemo } from 'react';
import { Chessground as ChessgroundAPI } from 'chessground';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';
import { Chess } from 'chess.js';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

// Theme color map — light square, dark square
const THEME_COLORS: Record<string, { light: string; dark: string }> = {
  brown:   { light: '#f0d9b5', dark: '#b58863' },
  classic: { light: '#f0d9b5', dark: '#b58863' },
  green:   { light: '#ffffcc', dark: '#7cb342' },
  blue:    { light: '#e8f4f8', dark: '#2c5aa0' },
  purple:  { light: '#f0e6ff', dark: '#6b4c9a' },
};

interface ChessgroundBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string) => boolean | Promise<boolean>;
  lastMove?: [string, string] | null;
  legalMoves?: Map<string, string[]>;
  check?: string | null;
  turnColor?: 'white' | 'black';
  boardSize?: number;
  theme?: 'brown' | 'classic' | 'blue' | 'green' | 'purple';
  interactive?: boolean;
}

function computeDestsFromFen(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  try {
    const chess = new Chess(fen);
    const moves = chess.moves({ verbose: true });
    for (const move of moves) {
      const existing = dests.get(move.from);
      if (existing) existing.push(move.to);
      else dests.set(move.from, [move.to]);
    }
  } catch (e) {
    console.error('Failed to compute legal moves from FEN:', e);
  }
  return dests;
}

function turnColorFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function isInCheck(fen: string): boolean {
  try { return new Chess(fen).isCheck(); } catch { return false; }
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
  theme = 'brown',
  interactive = true,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  const derivedTurnColor = turnColor || turnColorFromFen(fen);

  const destsMap = useMemo(() => {
    if (!interactive) return new Map<string, string[]>();
    if (legalMoves) {
      if (legalMoves instanceof Map) return legalMoves;
      return new Map(Object.entries(legalMoves));
    }
    return computeDestsFromFen(fen);
  }, [fen, legalMoves, interactive]);

  const inCheck = check !== undefined ? !!check : isInCheck(fen);

  // Apply theme colors via CSS custom properties on the wrapper
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const colors = THEME_COLORS[theme] || THEME_COLORS.brown;
    // Override chessground square colors
    el.style.setProperty('--cg-light', colors.light);
    el.style.setProperty('--cg-dark', colors.dark);
    // Directly patch all square elements for immediate effect
    const squares = el.querySelectorAll<HTMLElement>('cg-board square');
    squares.forEach((sq) => {
      const cls = sq.className;
      if (cls.includes('light')) sq.style.background = colors.light;
      else if (cls.includes('dark')) sq.style.background = colors.dark;
    });
  }, [theme, boardSize]);

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
                  if (!isValid && cgRef.current) cgRef.current.set({ fen });
                });
              } else if (!result && cgRef.current) {
                cgRef.current.set({ fen });
              }
            }
          },
        },
      },
      drawable: { enabled: true, visible: true },
      coordinates: true,
      animation: { enabled: true, duration: 200 },
    };

    if (!cgRef.current) {
      cgRef.current = ChessgroundAPI(boardRef.current, config);
    } else {
      cgRef.current.set(config);
    }

    // Re-apply theme colors after board renders
    const el = wrapperRef.current;
    if (el) {
      const colors = THEME_COLORS[theme] || THEME_COLORS.brown;
      requestAnimationFrame(() => {
        const squares = el.querySelectorAll<HTMLElement>('cg-board square');
        squares.forEach((sq) => {
          if (sq.className.includes('light')) sq.style.background = colors.light;
          else if (sq.className.includes('dark')) sq.style.background = colors.dark;
        });
      });
    }
  }, [fen, orientation, lastMove, destsMap, inCheck, derivedTurnColor, interactive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cgRef.current) { cgRef.current.destroy(); cgRef.current = null; }
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ width: `${boardSize}px`, height: `${boardSize}px` }}
    >
      <div
        ref={boardRef}
        style={{
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          touchAction: 'none',
        }}
        className="cg-wrap"
      />
    </div>
  );
};
