import { useEffect, useRef } from 'react';
import { Chessground as ChessgroundAPI } from 'chessground';
import { Api } from 'chessground/dist/api';
import { Config } from 'chessground/dist/config';

interface ChessgroundBoardProps {
  fen: string;
  orientation?: 'white' | 'black';
  onMove?: (from: string, to: string) => boolean | Promise<boolean>;
  lastMove?: [string, string] | null;
  legalMoves?: Record<string, string[]>;
  check?: string | null;
  turnColor?: 'white' | 'black';
  boardSize?: number;
  theme?: 'brown' | 'blue' | 'green';
}

// Inject Chessground CSS styles
const injectChessgroundStyles = () => {
  if (document.getElementById('chessground-base-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'chessground-base-styles';
  style.textContent = `
    .cg-wrap {
      position: relative;
      display: inline-block;
      user-select: none;
      line-height: 0;
      font-size: 0;
    }
    
    cg-container {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
    }
    
    .cg-board {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      grid-template-columns: repeat(8, 1fr);
      grid-template-rows: repeat(8, 1fr);
      gap: 0;
      background: #d2b48c;
    }
    
    .cg-square {
      position: relative;
      width: 100%;
      height: 100%;
      background: #f0d9b5;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .cg-square.dark {
      background: #b58863;
    }
    
    .cg-square.light {
      background: #f0d9b5;
    }
    
    .cg-square.last-move {
      background: #baca44;
    }
    
    .cg-square.check {
      background: #f24d4d;
    }
    
    .cg-pieces {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-size: 0;
    }
    
    .cg-piece {
      position: absolute;
      width: 12.5%;
      height: 12.5%;
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center;
      pointer-events: auto;
      cursor: grab;
      display: block;
    }
    
    .cg-piece.dragging {
      opacity: 0.7;
      z-index: 10;
      cursor: grabbing;
    }
    
    /* White pieces */
    .cg-piece.wK { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11v3.107a7 7 0 0 0-5.5 6.846V22h11v-1.047a7 7 0 0 0-5.5-6.846V11M15 27h15v2H15z"/><path d="M11 27h23v2H11z"/><circle cx="22.5" cy="15.5" r="1.5"/></g></svg>'); }
    .cg-piece.wQ { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 26h27v2H9z"/><path d="M9 26h27v2H9z"/></g></svg>'); }
    .cg-piece.wR { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v2H9z"/><path d="M12 36h21v3H12z"/><path d="M11 14h23v3H11z"/><path d="M11 14h2v22h-2z"/><path d="M32 14h2v22h-2z"/></g></svg>'); }
    .cg-piece.wB { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36h27v2H9z"/><path d="M12 33h21v3H12z"/><path d="M22.5 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6M22.5 16a5 5 0 1 1 0 10 5 5 0 0 1 0-10"/></g></svg>'); }
    .cg-piece.wN { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 18c.6-6.5-12-5.4-5 7m5 9H10v-3h22z"/></g></svg>'); }
    .cg-piece.wP { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="white" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .888.3 1.713.732 2.359C11.06 16.237 8 24.5 8 24.5l15 2.5 15-2.5s-3.06-8.263-10.732-8.641A4.002 4.002 0 0 0 26.5 13c0-2.21-1.79-4-4-4z"/></g></svg>'); }
    
    /* Black pieces */
    .cg-piece.bK { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11v3.107a7 7 0 0 0-5.5 6.846V22h11v-1.047a7 7 0 0 0-5.5-6.846V11M15 27h15v2H15z"/><path d="M11 27h23v2H11z"/><circle cx="22.5" cy="15.5" r="1.5"/></g></svg>'); }
    .cg-piece.bQ { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11a4 4 0 1 1 0 8 4 4 0 0 1 0-8M9 26h27v2H9z"/><path d="M9 26h27v2H9z"/></g></svg>'); }
    .cg-piece.bR { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v2H9z"/><path d="M12 36h21v3H12z"/><path d="M11 14h23v3H11z"/><path d="M11 14h2v22h-2z"/><path d="M32 14h2v22h-2z"/></g></svg>'); }
    .cg-piece.bB { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36h27v2H9z"/><path d="M12 33h21v3H12z"/><path d="M22.5 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6M22.5 16a5 5 0 1 1 0 10 5 5 0 0 1 0-10"/></g></svg>'); }
    .cg-piece.bN { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 18c.6-6.5-12-5.4-5 7m5 9H10v-3h22z"/></g></svg>'); }
    .cg-piece.bP { background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><g fill="black" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .888.3 1.713.732 2.359C11.06 16.237 8 24.5 8 24.5l15 2.5 15-2.5s-3.06-8.263-10.732-8.641A4.002 4.002 0 0 0 26.5 13c0-2.21-1.79-4-4-4z"/></g></svg>'); }
  `;
  document.head.appendChild(style);
};

export const ChessgroundBoard: React.FC<ChessgroundBoardProps> = ({
  fen,
  orientation = 'white',
  onMove,
  lastMove,
  legalMoves = {},
  check,
  turnColor = 'white',
  boardSize = 400,
  theme = 'brown',
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  // Inject styles once
  useEffect(() => {
    injectChessgroundStyles();
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;

    // Initialize Chessground with proper configuration
    const config: Config = {
      fen,
      orientation,
      turnColor,
      check: check ? (check as 'white' | 'black') : undefined,
      lastMove,
      movable: {
        free: false,
        dests: legalMoves,
        events: {
          after: async (from, to) => {
            if (onMove) {
              const isValid = await onMove(from, to);
              if (!isValid) {
                // Revert the move if invalid
                cgRef.current?.set({ fen });
              }
            }
          },
        },
      },
      drawable: {
        enabled: true,
        visible: true,
      },
      coordinates: false,
      resizable: false,
      autoPieces: true,  // Enable automatic piece rendering
    };

    if (!cgRef.current) {
      cgRef.current = ChessgroundAPI(boardRef.current, config);
    } else {
      cgRef.current.set(config);
    }

    return () => {
      // Cleanup is handled by Chessground
    };
  }, [fen, orientation, onMove, lastMove, legalMoves, check, turnColor]);

  return (
    <div
      ref={boardRef}
      style={{
        width: `${boardSize}px`,
        height: `${boardSize}px`,
        display: 'inline-block',
      }}
      className="cg-wrap"
    />
  );
};
