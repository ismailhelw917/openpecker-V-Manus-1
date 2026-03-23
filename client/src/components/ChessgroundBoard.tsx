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
  blue:    { light: '#dce9f5', dark: '#4a7fc1' },
  purple:  { light: '#ede0f5', dark: '#7c5aa0' },
};

/**
 * Chessground uses background-image (SVG) on cg-board for square colors.
 * The most reliable override is a CSS repeating-linear-gradient checkerboard
 * which doesn't depend on SVG encoding at all.
 *
 * A standard 8×8 board has squares of size (100/8)% = 12.5%.
 * The checkerboard repeating gradient tiles a 2×2 square pattern (25%×25%),
 * with alternating light/dark cells.
 */
function buildCheckerboardCSS(light: string, dark: string): string {
  return `repeating-conic-gradient(${light} 0% 25%, ${dark} 0% 50%) 0 0 / 25% 25%`;
}

let themeStyleEl: HTMLStyleElement | null = null;

function applyGlobalTheme(theme: string) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.brown;
  if (!themeStyleEl) {
    themeStyleEl = document.createElement('style');
    themeStyleEl.id = 'cg-theme-override';
    document.head.appendChild(themeStyleEl);
  }
  const bg = buildCheckerboardCSS(colors.light, colors.dark);
  themeStyleEl.textContent = `
    cg-board {
      background: ${bg} !important;
    }
  `;
}

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

  // Apply theme via global style — runs on every theme change
  useEffect(() => {
    applyGlobalTheme(theme);
  }, [theme]);

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
      applyGlobalTheme(theme);
    } else {
      cgRef.current.set(config);
    }
  }, [fen, orientation, lastMove, destsMap, inCheck, derivedTurnColor, interactive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cgRef.current) { cgRef.current.destroy(); cgRef.current = null; }
    };
  }, []);

  return (
    <div style={{ width: `${boardSize}px`, height: `${boardSize}px` }}>
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
