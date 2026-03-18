import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Chess } from "chess.js";
import { ChevronLeft } from "lucide-react";
import { CustomChessboard } from "@/components/CustomChessboard";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;
  const { user } = useAuth();

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [targetCycles, setTargetCycles] = useState(3);
  const [boardSize, setBoardSize] = useState(400);
  const [captureSquare, setCaptureSquare] = useState<string | null>(null);

  // Chess game instance - kept as ref to avoid re-renders
  const gameRef = useRef(new Chess());
  const [gameFen, setGameFen] = useState(gameRef.current.fen());

  // Puzzle generation counter - increments on each puzzle change to cancel stale timeouts
  const puzzleGenRef = useRef(0);
  // Track all active timeouts so we can cancel them
  const activeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Safe setTimeout that auto-cancels if puzzle generation has changed
  const safePuzzleTimeout = useCallback((fn: () => void, delay: number) => {
    const gen = puzzleGenRef.current;
    const id = setTimeout(() => {
      if (puzzleGenRef.current === gen) {
        fn();
      }
      activeTimeoutsRef.current = activeTimeoutsRef.current.filter(t => t !== id);
    }, delay);
    activeTimeoutsRef.current.push(id);
    return id;
  }, []);

  // Cancel all pending puzzle-related timeouts
  const cancelAllPuzzleTimeouts = useCallback(() => {
    activeTimeoutsRef.current.forEach(id => clearTimeout(id));
    activeTimeoutsRef.current = [];
  }, []);

  // Track which move in the puzzle sequence the user needs to play
  // In Lichess format: moves[0]=setup, moves[1]=user, moves[2]=opponent, moves[3]=user, etc.
  // userMoveIndex tracks the index into movesList that the user needs to play next
  const [userMoveIndex, setUserMoveIndex] = useState(1);

  // Calculate responsive board size
  useEffect(() => {
    const calculateBoardSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (width < 640) {
        const mobileSize = Math.min(width - 32, height - 280);
        setBoardSize(Math.max(mobileSize, 250));
      } else {
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
  const utils = trpc.useUtils();
  const completeCycleMutation = trpc.cycles.complete.useMutation({
    onSuccess: () => {
      utils.stats.getUserStats.invalidate();
      utils.stats.getLeaderboard.invalidate();
      utils.trainingSets.getById.invalidate({ id: sessionId });
    },
  });

  // Update training set mutation
  const updateTrainingSetMutation = trpc.trainingSets.update.useMutation({
    onSuccess: () => {
      utils.trainingSets.getById.invalidate({ id: sessionId });
    },
  });

  // Record individual puzzle attempt mutation
  const recordAttemptMutation = trpc.attempts.record.useMutation({
    onSuccess: () => {
      utils.stats.getSummary.invalidate();
      utils.stats.getUserStats.invalidate();
    },
  });

  // Track puzzle start time
  const [puzzleStartTime, setPuzzleStartTime] = useState<number>(Date.now());

  // Helper to record a puzzle attempt
  const recordPuzzleAttempt = useCallback((isCorrect: boolean, timeMs: number) => {
    const deviceId = getOrCreateDeviceId();
    const currentPuzzle = puzzles[currentPuzzleIndex];
    recordAttemptMutation.mutate({
      userId: user?.id,
      deviceId,
      trainingSetId: sessionId,
      cycleNumber: currentCycle,
      puzzleId: currentPuzzle?.id || `puzzle-${currentPuzzleIndex}`,
      isCorrect,
      timeMs,
      attemptNumber: 1,
    });
    updateTrainingSetMutation.mutate({
      id: sessionId,
      lastPlayedAt: new Date(),
      totalAttempts: (getTrainingSet.data?.totalAttempts || 0) + 1,
    });
  }, [puzzles, currentPuzzleIndex, user, sessionId, currentCycle, getTrainingSet.data?.totalAttempts]);

  // Session timer
  useEffect(() => {
    if (isLoading || !puzzles.length) return;

    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, puzzles.length]);

  // Parse moves list from puzzle data
  const parseMovesList = useCallback((puzzle: any): string[] => {
    if (!puzzle?.moves) return [];
    if (Array.isArray(puzzle.moves)) return puzzle.moves;
    if (typeof puzzle.moves === 'string') {
      return puzzle.moves.split(' ').filter((m: string) => m.length > 0);
    }
    return [];
  }, []);

  // Play a UCI move on the game instance
  const playUCIMove = useCallback((game: Chess, uciMove: string): boolean => {
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;

    try {
      const moveObj: any = { from, to };
      if (promotion) moveObj.promotion = promotion;
      const result = game.move(moveObj);
      return !!result;
    } catch {
      return false;
    }
  }, []);

  // Initialize a puzzle: load FEN, play setup move, update board
  const initializePuzzle = useCallback((puzzle: any) => {
    if (!puzzle?.fen) return;

    // Cancel all pending timeouts from previous puzzle and increment generation
    cancelAllPuzzleTimeouts();
    puzzleGenRef.current += 1;

    const movesList = parseMovesList(puzzle);
    const game = new Chess(puzzle.fen);

    // Play the setup move (movesList[0]) - this is the opponent's move that creates the puzzle
    if (movesList.length > 0) {
      const setupPlayed = playUCIMove(game, movesList[0]);
      if (!setupPlayed) {
        console.error('Failed to play setup move:', movesList[0], 'on FEN:', puzzle.fen);
      }
    }

    // Update game state
    gameRef.current = game;
    setGameFen(game.fen());
    setUserMoveIndex(1); // User needs to play movesList[1]
    setSolved(false);
    setIsAutoSolving(false);
    setAutoSolveMove(null);
    setShowCorrectCheckmark(false);
    setShowWrongX(false);
    setCaptureSquare(null);
    setPuzzleStartTime(Date.now());

    console.log('Puzzle initialized:', {
      id: puzzle.id,
      originalFen: puzzle.fen,
      setupMove: movesList[0],
      puzzleFen: game.fen(),
      userTurn: game.turn(),
      expectedUserMove: movesList[1],
      totalMoves: movesList.length,
    });
  }, [parseMovesList, playUCIMove, cancelAllPuzzleTimeouts]);

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

      // Initialize first puzzle
      initializePuzzle(puzzleList[0]);

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading puzzles:", error);
      setIsLoading(false);
    }
  }, [getTrainingSet.data]);

  // Advance to next puzzle
  const advanceToNextPuzzle = useCallback(() => {
    if (currentPuzzleIndex < puzzles.length - 1) {
      const nextIndex = currentPuzzleIndex + 1;
      setCurrentPuzzleIndex(nextIndex);
      initializePuzzle(puzzles[nextIndex]);
    } else {
      // Cycle completed
      if (currentCycle < targetCycles) {
        // Start next cycle
        const nextCycle = currentCycle + 1;
        setCurrentCycle(nextCycle);
        setCurrentPuzzleIndex(0);
        setCorrectCount(0);
        initializePuzzle(puzzles[0]);
      } else {
        // All cycles completed - record final cycle
        const accuracy = (correctCount / puzzles.length) * 100;
        completeCycleMutation.mutate({
          userId: user?.id,
          deviceId: getOrCreateDeviceId(),
          trainingSetId: sessionId,
          cycleNumber: currentCycle,
          totalPuzzles: puzzles.length,
          correctCount,
          totalTimeMs: sessionTime * 1000,
        });

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
  }, [currentPuzzleIndex, puzzles, currentCycle, targetCycles, correctCount, sessionTime, sessionId, user, initializePuzzle]);

  // Play opponent's response move after user's correct move
  const playOpponentResponse = useCallback((movesList: string[], nextMoveIndex: number) => {
    if (nextMoveIndex >= movesList.length) {
      // No more moves - puzzle is complete (user got it right)
      return true; // puzzle solved
    }

    // Play opponent's response move with animation
    const opponentMove = movesList[nextMoveIndex];
    const from = opponentMove.substring(0, 2);
    const to = opponentMove.substring(2, 4);

    setAutoSolveMove({ from, to });

    safePuzzleTimeout(() => {
      const game = gameRef.current;
      playUCIMove(game, opponentMove);
      setGameFen(game.fen());
      setAutoSolveMove(null);
      setUserMoveIndex(nextMoveIndex + 1); // User needs to play the next move
    }, 600);

    return false; // puzzle not yet complete
  }, [playUCIMove, safePuzzleTimeout]);

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

  // Determine board orientation: the user plays the side whose turn it is AFTER the setup move
  // Since we've already played the setup move, game.turn() gives us the user's color
  const boardOrientation = gameRef.current.turn() === 'w' ? 'white' : 'black';

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved || isAutoSolving) return false;

    const currentPuzzle = puzzles[currentPuzzleIndex];
    if (!currentPuzzle) return false;

    const movesList = parseMovesList(currentPuzzle);
    const expectedMove = movesList[userMoveIndex];

    if (!expectedMove) {
      console.log('No expected move at index:', userMoveIndex);
      return false;
    }

    try {
      const game = gameRef.current;

      // Pre-validate: check if source square has a piece
      const piece = game.get(sourceSquare as any);
      if (!piece) {
        console.log('No piece on source square:', sourceSquare);
        return false;
      }

      // Pre-validate: check if the move is legal
      const legalMoves = game.moves({ square: sourceSquare as any, verbose: true });
      const isLegal = legalMoves.some((m: any) => m.to === targetSquare);
      if (!isLegal) {
        console.log('Illegal move:', sourceSquare, '->', targetSquare);
        return false;
      }

      // Build move object
      const moveObj: any = { from: sourceSquare, to: targetSquare };
      const targetRank = parseInt(targetSquare[1]);
      if (piece.type === 'p' && (targetRank === 8 || targetRank === 1)) {
        moveObj.promotion = "q";
      }

      const result = game.move(moveObj);
      if (!result) {
        console.log('Move rejected by engine');
        return false;
      }

      // Build UCI string for comparison
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;
      console.log('Move validation:', { userMoveIndex, expectedMove, moveUCI, totalMoves: movesList.length });

      if (expectedMove === moveUCI) {
        // Correct move!
        setGameFen(game.fen());

        // Check if there are more moves in the sequence
        const nextOpponentMoveIndex = userMoveIndex + 1;

        if (nextOpponentMoveIndex >= movesList.length) {
          // Puzzle fully solved - no more moves
          const puzzleTimeMs = Date.now() - puzzleStartTime;
          recordPuzzleAttempt(true, puzzleTimeMs);
          setCorrectCount(prev => prev + 1);
          setShowCorrectCheckmark(true);
          setSolved(true);
          safePuzzleTimeout(() => setShowCorrectCheckmark(false), 1000);
          safePuzzleTimeout(() => advanceToNextPuzzle(), 1500);
        } else {
          // Play opponent's response, then wait for user's next move
          const puzzleDone = playOpponentResponse(movesList, nextOpponentMoveIndex);

          if (puzzleDone) {
            // All moves played
            const puzzleTimeMs = Date.now() - puzzleStartTime;
            recordPuzzleAttempt(true, puzzleTimeMs);
            setCorrectCount(prev => prev + 1);
            setShowCorrectCheckmark(true);
            setSolved(true);
            safePuzzleTimeout(() => setShowCorrectCheckmark(false), 1000);
            safePuzzleTimeout(() => advanceToNextPuzzle(), 1500);
          } else {
            // Check if user has more moves after opponent response
            const nextUserMoveIndex = nextOpponentMoveIndex + 1;
            if (nextUserMoveIndex >= movesList.length) {
              // Opponent's response was the last move - puzzle solved
              safePuzzleTimeout(() => {
                const puzzleTimeMs = Date.now() - puzzleStartTime;
                recordPuzzleAttempt(true, puzzleTimeMs);
                setCorrectCount(prev => prev + 1);
                setShowCorrectCheckmark(true);
                setSolved(true);
                safePuzzleTimeout(() => setShowCorrectCheckmark(false), 1000);
                safePuzzleTimeout(() => advanceToNextPuzzle(), 1500);
              }, 700);
            }
            // Otherwise, user needs to play nextUserMoveIndex (set by playOpponentResponse)
          }
        }
      } else {
        // Wrong move - undo it
        game.undo();
        setGameFen(game.fen());

        // Record incorrect attempt
        const puzzleTimeMs = Date.now() - puzzleStartTime;
        recordPuzzleAttempt(false, puzzleTimeMs);

        // Show wrong X watermark
        setShowWrongX(true);
        safePuzzleTimeout(() => setShowWrongX(false), 1000);

        // Show capture animation
        setCaptureSquare(targetSquare);

        // Auto-solve: show the correct solution
        safePuzzleTimeout(() => {
          setCaptureSquare(null);

          // Reset to puzzle start position (after setup move)
          const solveGame = new Chess(currentPuzzle.fen);
          if (movesList.length > 0) {
            playUCIMove(solveGame, movesList[0]); // Play setup move
          }
          gameRef.current = solveGame;
          setGameFen(solveGame.fen());

          // Auto-solve: play remaining moves with animation
          safePuzzleTimeout(() => {
            setIsAutoSolving(true);
            let solveIndex = 1; // Start from user's first move

            const playNextSolveMove = () => {
              if (solveIndex >= movesList.length) {
                setIsAutoSolving(false);
                setAutoSolveMove(null);

                // Auto-advance after showing solution
                safePuzzleTimeout(() => advanceToNextPuzzle(), 1500);
                return;
              }

              const move = movesList[solveIndex];
              const from = move.substring(0, 2);
              const to = move.substring(2, 4);

              setAutoSolveMove({ from, to });

              const delayPerMove = Math.max(400, 2000 / (movesList.length - 1));
              safePuzzleTimeout(() => {
                playUCIMove(solveGame, move);
                setGameFen(solveGame.fen());
                setAutoSolveMove(null);
                solveIndex++;

                safePuzzleTimeout(playNextSolveMove, delayPerMove * 0.3);
              }, delayPerMove * 0.7);
            };

            playNextSolveMove();
          }, 300);
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
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-teal-900/30 flex-shrink-0 bg-slate-900/50 min-h-[4rem] sm:h-20">
        <button
          onClick={() => setLocation("/sets")}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="text-center flex-1 px-2 sm:px-4 min-w-0">
          {currentPuzzle?.openingName && (
            <p className="text-[10px] sm:text-xs text-teal-300 mb-1 sm:mb-2 font-semibold truncate">{currentPuzzle.openingName}</p>
          )}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-1">
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
      <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
        <div style={{ width: boardSize, height: boardSize }} className="relative">
          <CustomChessboard
            game={new Chess(gameFen)}
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
      <div className="h-14 sm:h-20 border-t border-teal-900/30 bg-slate-900/50 flex-shrink-0" />
    </div>
  );
}
