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

const boardStyles = `
.cg-board-wrap {
  position: relative;
  display: inline-block;
  background: #d9d9d9;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.cg-board {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  gap: 0;
}

.cg-square {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
}

.cg-square.light {
  background: #f0d9b5;
}

.cg-square.dark {
  background: #b58863;
}

.cg-square.last-move {
  background: #baca44;
}

.cg-square.check {
  background: #f24d4d;
}

.cg-piece {
  position: absolute;
  width: 100%;
  height: 100%;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.cg-piece.dragging {
  opacity: 0.5;
  z-index: 10;
}
`;

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

  // Inject styles on mount
  useEffect(() => {
    const styleId = 'chessground-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = boardStyles;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!boardRef.current) return;

    // Initialize Chessground
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
      className="cg-board-wrap"
      style={{
        width: `${boardSize}px`,
        height: `${boardSize}px`,
      }}
    />
  );
};
