import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Chess } from "chess.js";
import { ChevronLeft } from "lucide-react";
import { CustomChessboard } from "@/components/CustomChessboard";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;
  const { user } = useAuth();

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [targetCycles, setTargetCycles] = useState(3);
  const [boardSize, setBoardSize] = useState(400);
  const [captureSquare, setCaptureSquare] = useState<string | null>(null);
  
  // Calculate responsive board size
  useEffect(() => {
    const calculateBoardSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // For mobile (< 640px width), use 90% of viewport width minus padding
      if (width < 640) {
        const mobileSize = Math.min(width - 32, height - 280);
        setBoardSize(Math.max(mobileSize, 250));
      } else {
        // For desktop, use fixed size
        setBoardSize(400);
      }
    };
    
    calculateBoardSize();
    window.addEventListener("resize", calculateBoardSize);
    return () => window.removeEventListener("resize", calculateBoardSize);
  }, []);
  const [autoSolveMove, setAutoSolveMove] = useState<{ from: string; to: string } | null>(null);
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [boardTheme, setBoardTheme] = useState<'classic' | 'green' | 'blue' | 'purple'>(() => {
    const saved = localStorage.getItem('board-theme');
    return (saved as 'classic' | 'green' | 'blue' | 'purple') || 'classic';
  });
  const [sessionTime, setSessionTime] = useState(0);
  const [showCorrectCheckmark, setShowCorrectCheckmark] = useState(false);
  const [showWrongX, setShowWrongX] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0); // Track which move in the sequence

  // Board theme definitions
  const themeColors = {
    classic: { light: '#f0d9b5', dark: '#b58863' },
    green: { light: '#ffffcc', dark: '#7cb342' },
    blue: { light: '#e8f4f8', dark: '#2c5aa0' },
    purple: { light: '#f0e6ff', dark: '#6b4c9a' },
  };

  const getTrainingSet = trpc.trainingSets.getById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

  // Cycle recording mutation
  const completeCycleMutation = trpc.cycles.complete.useMutation();
  
  // Update training set mutation
  const updateTrainingSetMutation = trpc.trainingSets.update.useMutation();

  // Session timer
  useEffect(() => {
    if (isLoading || !puzzles.length) return;
    
    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isLoading, puzzles.length]);

  // Calculate board size on mount and resize
  useEffect(() => {
    const calculateBoardSize = () => {
      const headerHeight = 80;
      const footerHeight = 80;
      const padding = 16;
      const availableHeight = window.innerHeight - headerHeight - footerHeight - padding;
      const availableWidth = window.innerWidth - padding;
      const size = Math.min(availableHeight, availableWidth, 600);
      setBoardSize(Math.max(300, size));
    };

    calculateBoardSize();
    window.addEventListener("resize", calculateBoardSize);
    return () => window.removeEventListener("resize", calculateBoardSize);
  }, []);

  // Load puzzles from training set
  useEffect(() => {
    if (!getTrainingSet.data) return;

    try {
      let puzzleList = [];

      if (getTrainingSet.data.puzzlesJson) {
        const jsonData = typeof getTrainingSet.data.puzzlesJson === "string"
          ? JSON.parse(getTrainingSet.data.puzzlesJson)
          : getTrainingSet.data.puzzlesJson;
        puzzleList = Array.isArray(jsonData) ? jsonData : [];
      }

      if (!Array.isArray(puzzleList) || puzzleList.length === 0) {
        console.error("No puzzles in training set");
        setIsLoading(false);
        return;
      }

      setPuzzles(puzzleList);
      setCurrentPuzzleIndex(0);
      setCorrectCount(0);
      setSolved(false);
      setCurrentCycle(1);
      setTargetCycles(getTrainingSet.data.targetCycles || 3);
      
      // Load first puzzle FEN
      const firstPuzzle = puzzleList[0];
      if (firstPuzzle?.fen) {
        setFen(firstPuzzle.fen);
        console.log("Loaded puzzle FEN:", firstPuzzle.fen);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading puzzles:", error);
      setIsLoading(false);
    }
  }, [getTrainingSet.data]);

  if (!match) return null;

  if (isLoading || getTrainingSet.isLoading) {
    return (
      <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading puzzles...</p>
        </div>
      </div>
    );
  }

  if (!puzzles || puzzles.length === 0) {
    return (
      <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-20">
        <div className="bg-red-900/30 border border-red-900/50 p-6 text-center rounded-lg max-w-md">
          <p className="text-red-400 font-bold mb-4">No puzzles found</p>
          <button
            onClick={() => setLocation("/train")}
            className="px-4 py-2 bg-amber-500 text-slate-900 rounded font-bold hover:bg-amber-400"
          >
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentPuzzleIndex];
  const progress = ((currentPuzzleIndex + 1) / puzzles.length) * 100;
  
  // Determine board orientation based on whose turn it is
  const gameForOrientation = new Chess(currentPuzzle?.fen || fen);
  const isWhiteTurn = gameForOrientation.turn() === 'w';
  // Board should show the player's perspective - if it's white's turn, show from white's side, etc.
  const boardOrientation = isWhiteTurn ? 'white' : 'black';
  console.log('Turn detection:', { turn: gameForOrientation.turn(), isWhiteTurn, boardOrientation });

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved) return false;
    if (!currentPuzzle?.fen) return false;

    try {
      // Use the current puzzle's FEN directly to avoid race conditions
      const game = new Chess(currentPuzzle.fen);
      
      let result = null;
      try {
        // Only add promotion if the move is to the 8th or 1st rank (pawn promotion)
        const moveObj: any = {
          from: sourceSquare,
          to: targetSquare,
        };
        
        // Check if target square is on promotion rank (8th for white, 1st for black)
        const targetRank = parseInt(targetSquare[1]);
        if (targetRank === 8 || targetRank === 1) {
          moveObj.promotion = "q";
        }
        
        result = game.move(moveObj);
      } catch (e) {
        console.error("Move error:", e);
        return false;
      }

      // If move is illegal, return false silently (no error toast)
      if (!result) {
        console.log('Illegal move attempted:', { from: sourceSquare, to: targetSquare, fen: currentPuzzle.fen });
        return false;
      }

      // Update the displayed FEN after successful move
      setFen(game.fen());

      // Check if move is correct
      // Parse moves - could be array or space-separated string
      let movesList: string[] = [];
      if (Array.isArray(currentPuzzle.moves)) {
        movesList = currentPuzzle.moves;
      } else if (typeof currentPuzzle.moves === 'string') {
        movesList = currentPuzzle.moves.split(' ').filter((m: string) => m.length > 0);
      }
      
      const expectedMove = movesList[currentMoveIndex];
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;
      console.log('Move validation:', { currentMoveIndex, expectedMove, moveUCI, totalMoves: movesList.length, puzzleId: currentPuzzle.id });

      if (expectedMove === moveUCI) {
        setCorrectCount((prev) => prev + 1);
        setShowCorrectCheckmark(true);
        setSolved(true);
        
        // Hide checkmark after 1 second
        setTimeout(() => setShowCorrectCheckmark(false), 1000);
        
        // Start countdown for auto-next
        let countdown = 1;
        setAutoNextCountdown(countdown);
        const countdownInterval = setInterval(() => {
          countdown -= 1;
          if (countdown > 0) {
            setAutoNextCountdown(countdown);
          } else {
            setAutoNextCountdown(null);
            clearInterval(countdownInterval);
          }
        }, 500);

        // Auto-advance after 1.5 seconds
        setTimeout(() => {
          clearInterval(countdownInterval);
          setAutoNextCountdown(null);
          
          if (currentPuzzleIndex < puzzles.length - 1) {
            const nextIndex = currentPuzzleIndex + 1;
            setCurrentPuzzleIndex(nextIndex);
            setSolved(false);
            setCaptureSquare(null);
            
            const nextPuzzle = puzzles[nextIndex];
            if (nextPuzzle?.fen) {
              setFen(nextPuzzle.fen);
            }
          } else {
            // Cycle completed - increment cycle or finish session
            if (currentCycle < targetCycles) {
              setCurrentCycle(currentCycle + 1);
              setCurrentPuzzleIndex(0);
              setCorrectCount(0);
              
              const firstPuzzle = puzzles[0];
              if (firstPuzzle?.fen) {
                setFen(firstPuzzle.fen);
              }
            } else {
              // All cycles completed - record final cycle
              const accuracy = (correctCount / puzzles.length) * 100;
              completeCycleMutation.mutate({
                userId: user?.id,
                deviceId: localStorage.getItem('openpecker-device-id') || '',
                trainingSetId: sessionId,
                cycleNumber: currentCycle,
                totalPuzzles: puzzles.length,
                correctCount,
                totalTimeMs: sessionTime * 1000,
              });
              
              // Update training set with session stats
              updateTrainingSetMutation.mutate({
                id: sessionId,
                bestAccuracy: accuracy,
                lastPlayedAt: new Date(),
                cyclesCompleted: currentCycle,
                totalAttempts: puzzles.length,
              });
              
              setTimeout(() => setLocation("/sets"), 1000);
            }
          }
        }, 1500);
      } else {
        // Show wrong X watermark
        setShowWrongX(true);
        setTimeout(() => setShowWrongX(false), 1000);
        
        // Show capture animation on wrong move
        setCaptureSquare(targetSquare);
        
        // Reset board after animation and show auto-solve
        setTimeout(() => {
          setFen(currentPuzzle.fen);
          setCaptureSquare(null);
          
          // Auto-solve after 0.5 seconds - play entire solution sequence
          setTimeout(() => {
            const game = new Chess(currentPuzzle.fen);
            let movesList: string[] = [];
            if (Array.isArray(currentPuzzle.moves)) {
              movesList = currentPuzzle.moves;
            } else if (typeof currentPuzzle.moves === 'string') {
              movesList = currentPuzzle.moves.split(' ').filter((m: string) => m.length > 0);
            }
            
            if (movesList.length === 0) return;
            
            try {
              setIsAutoSolving(true);
              let moveIndex = 0;
              
              // Function to play moves sequentially with animation
              const playNextMove = () => {
                if (moveIndex >= movesList.length) {
                  // All moves played - don't count as correct or solved
                  setIsAutoSolving(false);
                  setAutoSolveMove(null);
                  // Don't set setSolved(true) - user didn't solve it correctly
                  
                  // Start countdown for auto-next
                  let countdown = 1;
                  setAutoNextCountdown(countdown);
                  const countdownInterval = setInterval(() => {
                    countdown -= 1;
                    if (countdown > 0) {
                      setAutoNextCountdown(countdown);
                    } else {
                      setAutoNextCountdown(null);
                      clearInterval(countdownInterval);
                    }
                  }, 500);
                  
                  // Auto-advance after 1.5 seconds
                  setTimeout(() => {
                    clearInterval(countdownInterval);
                    setAutoNextCountdown(null);
                    
                    if (currentPuzzleIndex < puzzles.length - 1) {
                      const nextIndex = currentPuzzleIndex + 1;
                      setCurrentPuzzleIndex(nextIndex);
                      setSolved(false);
                      setCaptureSquare(null);
                      
                      const nextPuzzle = puzzles[nextIndex];
                      if (nextPuzzle?.fen) {
                        setFen(nextPuzzle.fen);
                      }
                    } else {
                      // Record cycle completion
                      completeCycleMutation.mutate({
                        userId: user?.id,
                        deviceId: localStorage.getItem('openpecker-device-id') || '',
                        trainingSetId: sessionId,
                        cycleNumber: currentCycle,
                        totalPuzzles: puzzles.length,
                        correctCount,
                        totalTimeMs: sessionTime * 1000,
                      });
                      setTimeout(() => setLocation("/sets"), 1000);
                    }
                  }, 1500);
                  return;
                }
                
                const expectedMove = movesList[moveIndex];
                const from = expectedMove.substring(0, 2);
                const to = expectedMove.substring(2, 4);
                const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
                
                try {
                  const moveResult = game.move({ from, to, promotion: promotion || 'q' });
                  if (moveResult) {
                    // Show animation for this move
                    setAutoSolveMove({ from, to });
                    
                    // Play move after animation (total 2s / number of moves)
                    const delayPerMove = 2000 / movesList.length;
                    setTimeout(() => {
                      setFen(game.fen());
                      setAutoSolveMove(null);
                      moveIndex++;
                      
                      // Play next move
                      setTimeout(playNextMove, delayPerMove * 0.3);
                    }, delayPerMove * 0.7);
                  } else {
                    console.error("Failed to play move:", expectedMove);
                    setIsAutoSolving(false);
                  }
                } catch (e) {
                  console.error("Error playing move:", e);
                  setIsAutoSolving(false);
                }
              };
              
              // Start playing moves
              playNextMove();
            } catch (e) {
              console.error("Error auto-solving:", e);
              setIsAutoSolving(false);
            }
          }, 500);
        }, 600);
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-teal-900/30 flex-shrink-0 bg-slate-900/50 h-20">
        <button
          onClick={() => setLocation("/sets")}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center flex-1 px-4">
          <div className="flex items-center justify-center gap-4 mb-1">
            <div>
              <p className="text-xs text-slate-400">Time</p>
              <p className="text-sm font-bold text-amber-400">{formatTime(sessionTime)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Cycles</p>
              <p className="text-sm font-bold text-amber-400">{currentCycle}/{targetCycles}</p>
            </div>
          </div>
          <div className="w-40 h-0.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-amber-400 font-bold">{correctCount}/{puzzles.length}</p>
          <p className="text-slate-400 text-xs">Correct</p>
        </div>
      </div>

      {/* Board Container - Centered */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div style={{ width: boardSize, height: boardSize }} className="relative">
          <CustomChessboard
            game={new Chess(fen)}
            onPieceDrop={handleMove}
            boardColors={themeColors[boardTheme]}
            captureSquare={captureSquare}
            orientation={boardOrientation}
            autoSolveMove={autoSolveMove}
            autoNextCountdown={autoNextCountdown}
            isAutoSolving={isAutoSolving}
          />
          
          {/* Green Checkmark Watermark for Correct Solutions */}
          {showCorrectCheckmark && !isAutoSolving && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-green-400 opacity-80 animate-pulse">
                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          )}
          
          {/* Red X Watermark for Wrong Moves */}
          {showWrongX && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-red-500 opacity-80 animate-pulse">
                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="h-20 border-t border-teal-900/30 bg-slate-900/50 flex-shrink-0" />

      {/* Status Message removed */}
    </div>
  );
}
