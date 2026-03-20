import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { DndContext, DragOverlay, useDraggable, useDroppable, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'motion/react';

interface CaptureAnimationData {
  piece: { type: string; color: string };
  from: string;
  to: string;
}

interface CustomChessboardProps {
  game: any;
  orientation?: 'white' | 'black';
  onSquareClick?: (square: string) => void;
  onPieceDrop?: (sourceSquare: string, targetSquare: string) => boolean | Promise<boolean>;
  boardColors?: { light: string; dark: string };
  optionSquares?: Record<string, any>;
  lastMove?: { from: string; to: string } | null;
  legalMoves?: string[];
  captureAnimation?: CaptureAnimationData | null;
  autoSolveMove?: { from: string; to: string } | null;
  autoNextCountdown?: number | null;
  isAutoSolving?: boolean;
}

const DraggablePiece = ({ piece, squareName }: { piece: any; squareName: string }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: squareName,
    data: { piece, squareName },
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <img
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        draggable="false"
        src={`https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/${piece.color}${piece.type.toUpperCase()}.svg`}
        alt={`${piece.color}${piece.type}`}
        className={`w-full h-full p-1 cursor-grab transition-all relative z-10 ${isDragging ? 'opacity-30 scale-90 brightness-75' : 'opacity-100 scale-100'}`}
        style={{ ...style, touchAction: 'none', filter: isDragging ? 'grayscale(100%)' : 'grayscale(0%)' }}
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (!img.dataset.fallback) {
            img.dataset.fallback = 'true';
            img.src = `https://chess1.org/assets/piece/cburnett/${piece.color}${piece.type.toUpperCase()}.svg`;
          }
        }}
        crossOrigin="anonymous"
        loading="eager"
      />
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-full animate-pulse" />
      )}
    </div>
  );
};

const DroppableSquare = ({ squareName, isDark, children, onDrop, boardColors }: { squareName: string; isDark: boolean; children: React.ReactNode; onDrop: (target: string) => void, boardColors: { light: string; dark: string } }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: squareName,
  });

  return (
    <div
      ref={setNodeRef}
      className={`relative w-full h-full flex items-center justify-center ${isOver ? 'ring-2 ring-yellow-400' : ''}`}
      style={{ backgroundColor: isDark ? boardColors.dark : boardColors.light }}
      onClick={() => onDrop(squareName)}
    >
      {children}
    </div>
  );
};

export const CustomChessboard: React.FC<CustomChessboardProps> = ({
  game,
  orientation = 'white',
  onSquareClick,
  onPieceDrop,
  boardColors = { light: '#f0d9b5', dark: '#b58863' },
  optionSquares = {},
  legalMoves: propLegalMoves,
  captureAnimation,
  autoSolveMove,
  autoNextCountdown,
  isAutoSolving,
}) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { distance: 5 } })
  );
  const board = useMemo(() => game.board(), [game]);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [activePiece, setActivePiece] = useState<any | null>(null);
  const [activeSquare, setActiveSquare] = useState<string | null>(null);

  const squares = useMemo(() => {
    const result = [];
    if (orientation === 'black') {
      for (let r = 7; r >= 0; r--) {
        for (let c = 7; c >= 0; c--) {
          result.push({ r, c });
        }
      }
    } else {
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          result.push({ r, c });
        }
      }
    }
    return result;
  }, [orientation]);

  const getSquareName = (r: number, c: number) => {
    // Chess.js board[r][c]: r=0 is rank 8, r=7 is rank 1
    if (orientation === 'black') {
      const file = String.fromCharCode(97 + (7 - c)); // h-a
      const rank = r + 1; // 1-8
      return `${file}${rank}`;
    }
    // White orientation: standard mapping
    const file = String.fromCharCode(97 + c); // a-h
    const rank = 8 - r; // 8-1
    return `${file}${rank}`;
  };

  const legalMoves = useMemo(() => {
    if (propLegalMoves) return propLegalMoves;
    const source = selectedSquare || activeSquare;
    if (!source) return [];
    return game.moves({ square: source as any, verbose: true }).map((m: any) => m.to);
  }, [game, selectedSquare, activeSquare, propLegalMoves]);

  const handleSquareClick = (squareName: string) => {
    const piece = game.get(squareName as any);
    const currentTurn = game.turn();
    
    if (selectedSquare) {
      const moves = game.moves({ square: selectedSquare as any, verbose: true });
      const move = moves.find((m: any) => m.to === squareName);
      
      if (move) {
        onPieceDrop?.(selectedSquare, squareName);
        setSelectedSquare(null);
      } else {
        // Only allow selecting pieces of the current player
        if (piece && piece.color === currentTurn) {
          setSelectedSquare(squareName);
        } else {
          setSelectedSquare(null);
        }
      }
    } else {
      // Only allow selecting pieces of the current player
      if (piece && piece.color === currentTurn) {
        setSelectedSquare(squareName);
      }
    }
  };

  const handleDragStart = (event: any) => {
    console.log('[CustomChessboard] handleDragStart triggered:', event.active.id);
    const piece = event.active.data.current.piece;
    const currentTurn = game.turn();
    
    // Prevent dragging pieces that don't belong to the current player
    if (piece.color !== currentTurn) {
      return;
    }
    
    setActivePiece(piece);
    setActiveSquare(event.active.id);
  };

  const handleDragEnd = async (event: any) => {
    console.log('[CustomChessboard] handleDragEnd triggered');
    const { active, over } = event;
    console.log('[CustomChessboard] active:', active?.id, 'over:', over?.id);
    
    // Safety check: ensure we have valid drag data
    if (!active?.data?.current?.piece || !over) {
      console.log('[CustomChessboard] Drag validation failed');
      return false;
    }
    
    const piece = active.data.current.piece;
    const currentTurn = game.turn();
    
    // Prevent moves from pieces that don't belong to the current player
    if (piece.color !== currentTurn) {
      return false;
    }
    
    // Don't process if dropped on same square
    if (active.id === over.id) {
      return false;
    }
    
    // Pre-validate: check if the piece actually exists on the source square
    const sourcePiece = game.get(active.id as any);
    if (!sourcePiece) {
      return false;
    }
    
    // Pre-validate: check if the move is legal
    const legalMoves = game.moves({ square: active.id as any, verbose: true });
    const isLegal = legalMoves.some((m: any) => m.to === over.id);
    if (!isLegal) {
      return false;
    }
    
    // Try the move - only clear state if it succeeds
    const result = await onPieceDrop?.(active.id, over.id);
    if (result) {
      setActivePiece(null);
      setActiveSquare(null);
    }
    // If move failed, keep piece visible and selected
    return result || false;
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-8 grid-rows-8 w-full aspect-square border border-border-dark/50 overflow-hidden">
        {squares.map(({ r, c }) => {
          const squareName = getSquareName(r, c);
          const piece = board[r][c];
          const isDark = (r + c) % 2 !== 0;

          return (
            <DroppableSquare key={squareName} squareName={squareName} isDark={isDark} onDrop={handleSquareClick} boardColors={boardColors}>
              {/* Capture explosion animation */}
              <AnimatePresence>
                {captureAnimation && captureAnimation.to === squareName && (
                  <motion.div
                    key={`capture-explosion-${squareName}`}
                    initial={{ scale: 0.5, opacity: 0.9 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-0 z-20 pointer-events-none"
                  >
                    <div className="w-full h-full rounded-full bg-red-500/60" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Captured piece fading out animation */}
              <AnimatePresence>
                {captureAnimation && captureAnimation.to === squareName && (
                  <motion.img
                    key={`captured-piece-${squareName}`}
                    src={`https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/${captureAnimation.piece.color}${captureAnimation.piece.type.toUpperCase()}.svg`}
                    alt="captured"
                    className="absolute inset-0 w-full h-full p-1 z-30 pointer-events-none"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 0.3, opacity: 0, y: -20, rotate: 45 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    crossOrigin="anonymous"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = 'true';
                        img.src = `https://chess1.org/assets/piece/cburnett/${captureAnimation.piece.color}${captureAnimation.piece.type.toUpperCase()}.svg`;
                      }
                    }}
                  />
                )}
              </AnimatePresence>

              {piece && <DraggablePiece piece={piece} squareName={squareName} />}
              {optionSquares[squareName] && <div className="absolute inset-0" style={optionSquares[squareName]} />}
              {selectedSquare === squareName && <div className="absolute inset-0 bg-yellow-400/50" />}
              {activeSquare === squareName && <div className="absolute inset-0 bg-yellow-400/50" />}
              {autoSolveMove && (autoSolveMove.from === squareName || autoSolveMove.to === squareName) && (
                <motion.div 
                  className="absolute inset-0 bg-green-400/50 rounded" 
                  initial={{ opacity: 0.3, scale: 0.8 }} 
                  animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.1, 0.8] }} 
                  transition={{ duration: 0.6, ease: "easeInOut" }} 
                />
              )}
              {legalMoves.includes(squareName) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className={`w-4 h-4 rounded-full ${piece ? 'bg-red-500/50' : 'bg-black/20'}`} />
                </div>
              )}
            </DroppableSquare>
          );
        })}
      </div>

      <DragOverlay>
        {activePiece ? (
          <div className="w-16 h-16 flex items-center justify-center">
            <img
              src={`https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/cburnett/${activePiece.color}${activePiece.type.toUpperCase()}.svg`}
              alt={`${activePiece.color}${activePiece.type}`}
              className="w-full h-full p-1 cursor-grabbing transition-none"
              draggable="false"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = 'true';
                  img.src = `https://chess1.org/assets/piece/cburnett/${activePiece.color}${activePiece.type.toUpperCase()}.svg`;
                }
              }}
              crossOrigin="anonymous"
              loading="eager"
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
