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

/**
 * Chessground renders the board as a background-image SVG on the <cg-board> element.
 * The SVG uses opacity=0 for light squares (shows background-color) and a colored
 * rect for dark squares. We override both:
 *   1. background-color → light square color
 *   2. background-image → new SVG with the correct dark square color
 *
 * We inject a <style> tag with !important so it always beats chessground.brown.css.
 */
function buildBoardSVG(darkColor: string): string {
  // Encode the dark color as a fill in the SVG pattern
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 8 8" shape-rendering="crispEdges"><g id="a"><g id="b"><g id="c"><g id="d"><rect width="1" height="1" id="e" fill="none"/><use x="1" y="1" href="#e"/><rect y="1" width="1" height="1" id="f" fill="${darkColor}"/><use x="1" y="-1" href="#f"/></g><use x="2" href="#c"/></g><use x="4" href="#b"/></g><use y="2" href="#a"/></g><use y="4" href="#a"/></svg>`;
  return `url('data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}')`;
}

let themeStyleEl: HTMLStyleElement | null = null;

function applyGlobalTheme(theme: string) {
  const colors = THEME_COLORS[theme] || THEME_COLORS.brown;
  if (!themeStyleEl) {
    themeStyleEl = document.createElement('style');
    themeStyleEl.id = 'cg-theme-override';
    document.head.appendChild(themeStyleEl);
  }
  const bgImage = buildBoardSVG(colors.dark);
  themeStyleEl.textContent = `
    cg-board {
      background-color: ${colors.light} !important;
      background-image: ${bgImage} !important;
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

  // Apply theme by overriding cg-board background — runs on every theme change
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
      // Apply theme immediately after board init
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
