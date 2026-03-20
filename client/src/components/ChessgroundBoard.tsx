import { useEffect, useRef } from 'react';
import { Chessground as ChessgroundAPI } from 'chessground';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';
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
}

export const ChessgroundBoard: React.FC<ChessgroundBoardProps> = ({
  fen,
  orientation = 'white',
  onMove,
  lastMove,
  legalMoves,
  check,
  turnColor = 'white',
  boardSize = 400,
}) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | null>(null);

  useEffect(() => {
    if (!boardRef.current) return;

    // Convert legalMoves to Map if it's a plain object
    let destsMap: Map<string, string[]> | undefined;
    if (legalMoves) {
      if (legalMoves instanceof Map) {
        destsMap = legalMoves;
      } else {
        destsMap = new Map(Object.entries(legalMoves));
      }
    }

    const config: Config = {
      fen,
      orientation,
      turnColor,
      check: check ? true : false,
      lastMove: lastMove || undefined,
      movable: {
        free: false,
        color: turnColor,
        dests: destsMap,
        events: {
          after: (from, to) => {
            if (onMove) {
              const result = onMove(from, to);
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

    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = null;
      }
    };
  }, [fen, orientation, onMove, lastMove, legalMoves, check, turnColor]);

  return (
    <div
      ref={boardRef}
      style={{
        width: `${boardSize}px`,
        height: `${boardSize}px`,
      }}
      className="cg-wrap"
    />
  );
};
