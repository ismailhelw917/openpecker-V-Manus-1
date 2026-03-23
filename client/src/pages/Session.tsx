import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Chess } from "chess.js";
import { ChevronLeft } from "lucide-react";
import { ChessgroundBoard } from "@/components/ChessgroundBoard";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { trackPuzzleSolved, trackCycleComplete, trackSessionStart, trackSessionEnd } from "@/lib/matomo";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;
  const { user } = useAuth();

  // ===== ALL useState HOOKS (must come first) =====
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [targetCycles, setTargetCycles] = useState(3);
  const [boardSize, setBoardSize] = useState(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 400;
    const h = typeof window !== 'undefined' ? window.innerHeight : 600;
    return Math.min(w - 32, h - 136, 500);
  });
  const [gameFen, setGameFen] = useState(() => new Chess().fen());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [userMoveIndex, setUserMoveIndex] = useState(1);
  const [autoSolveMove, setAutoSolveMove] = useState<{ from: string; to: string } | null>(null);
  const [isAutoSolving, setIsAutoSolving] = useState(false);
  const [boardTheme, setBoardTheme] = useState<'classic' | 'green' | 'blue' | 'purple'>(() => {
    const saved = localStorage.getItem('board-theme');
    return (saved as 'classic' | 'green' | 'blue' | 'purple') || 'classic';
  });
  const [sessionTime, setSessionTime] = useState(0);
  const [showCorrectCheckmark, setShowCorrectCheckmark] = useState(false);
  const [showWrongX, setShowWrongX] = useState(false);
  const [captureAnimation, setCaptureAnimation] = useState<{
    piece: { type: string; color: string };
    from: string;
    to: string;
  } | null>(null);
  const [puzzleStartTime, setPuzzleStartTime] = useState<number>(Date.now());


  // ===== ALL useRef HOOKS =====
  const gameRef = useRef(new Chess());
  const puzzleGenRef = useRef(0);
  const activeTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const boardContainerRef = useRef<HTMLDivElement>(null);

  // ===== ALL useCallback HOOKS =====
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

  const cancelAllPuzzleTimeouts = useCallback(() => {
    activeTimeoutsRef.current.forEach(id => clearTimeout(id));
    activeTimeoutsRef.current = [];
  }, []);

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
  const completeCycleMutation = trpc.cycles.create.useMutation({
    onSuccess: () => {
      utils.stats.getUserStats.invalidate();
      utils.stats.getLeaderboard.invalidate();
      utils.trainingSets.getById.invalidate({ id: sessionId });
    },
  });

  // Aggregate stats after cycle mutation
  const aggregateStatsMutation = trpc.stats.aggregateAfterCycle.useMutation({
    onSuccess: () => {
      utils.stats.getUserStats.invalidate();
      utils.stats.getSummary.invalidate();
      utils.stats.getLeaderboard.invalidate();
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

  // Track cumulative totalAttempts and totalTimeMs for the training set
  const totalAttemptsRef = useRef(0);
  const totalTimeMsRef = useRef(0);

  // Initialize refs from saved training set data
  useEffect(() => {
    if (getTrainingSet.data) {
      totalAttemptsRef.current = getTrainingSet.data.totalAttempts || 0;
      totalTimeMsRef.current = getTrainingSet.data.totalTimeMs || 0;
    }
  }, [getTrainingSet.data?.id]);

  const recordPuzzleAttempt = useCallback((isCorrect: boolean, timeMs: number) => {
    const deviceId = getOrCreateDeviceId();
    const currentPuzzle = puzzles[currentPuzzleIndex];
    recordAttemptMutation.mutate({
      userId: user?.id,
      deviceId,
      trainingSetId: sessionId,
      puzzleId: currentPuzzle?.id || `puzzle-${currentPuzzleIndex}`,
      isCorrect,
      timeMs,
    });

    // Increment cumulative stats on the training set
    totalAttemptsRef.current += 1;
    totalTimeMsRef.current += timeMs;

    updateTrainingSetMutation.mutate({
      id: sessionId,
      totalAttempts: totalAttemptsRef.current,
      totalTimeMs: totalTimeMsRef.current,
      lastPlayedAt: new Date(),
    });
  }, [puzzles, currentPuzzleIndex, user, sessionId, currentCycle]);

  // Keep boardTheme in sync if user changes it in Settings (same tab)
  useEffect(() => {
    const onStorage = () => {
      const saved = localStorage.getItem('board-theme');
      if (saved) setBoardTheme(saved as 'classic' | 'green' | 'blue' | 'purple');
    };
    window.addEventListener('storage', onStorage);
    // Also poll once on mount in case it changed before this component mounted
    onStorage();
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Session timer
  useEffect(() => {
    if (isLoading || !puzzles.length) return;

    const interval = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isLoading, puzzles.length]);

  // Helper: Convert algebraic notation to UCI format
  const convertAlgebraicToUCI = useCallback((algebraicMoves: string[], fen: string): string[] => {
    let game = new Chess(fen);
    const uciMoves: string[] = [];
    
    for (const move of algebraicMoves) {
      try {
        let moveObj = game.move(move, { strict: false });
        if (moveObj) {
          const uci = `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`;
          uciMoves.push(uci);
        } else {
          // If move fails, try flipping the turn (FEN side-to-move mismatch)
          const fenParts = fen.split(' ');
          const flippedTurn = fenParts[1] === 'w' ? 'b' : 'w';
          fenParts[1] = flippedTurn;
          const flippedFen = fenParts.join(' ');
          
          try {
            game = new Chess(flippedFen);
            moveObj = game.move(move, { strict: false });
            if (moveObj) {
              const uci = `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`;
              uciMoves.push(uci);
            } else {
              break;
            }
          } catch (e2) {
            break;
          }
        }
      } catch (e) {
        break;
      }
    }
    
    return uciMoves;
  }, []);

  // Parse moves list from puzzle data
  const parseMovesList = useCallback((puzzle: any): string[] => {
    if (!puzzle?.moves) return [];
    if (Array.isArray(puzzle.moves)) return puzzle.moves;
    if (typeof puzzle.moves === 'string') {
      const moves = puzzle.moves.split(' ').filter((m: string) => m.length > 0);
      // Check if moves are in algebraic notation
      // UCI format is always 4-5 chars: e2e4, e7e5, e2e1q
      // Algebraic can be: e4, Nf3, exd5, O-O, Bxc6, etc.
      const isAlgebraic = moves.some((m: string) => {
        // If it matches UCI pattern (4-5 chars of lowercase letters and numbers), it's UCI
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m)) return false;
        // Otherwise it's algebraic
        return true;
      });
      
      if (isAlgebraic && puzzle.fen) {
        return convertAlgebraicToUCI(moves, puzzle.fen);
      }
      return moves;
    }
    return [];
  }, [convertAlgebraicToUCI]);

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

    // FIX #1: Store orientation at init time - user plays the side whose turn it is after setup
    const userColor = game.turn() === 'w' ? 'white' : 'black';
    setBoardOrientation(userColor);

    // Update game state
    gameRef.current = game;
    setGameFen(game.fen());
    setUserMoveIndex(1); // User needs to play movesList[1]
    setSolved(false);
    setIsAutoSolving(false);
    setAutoSolveMove(null);
    setShowCorrectCheckmark(false);
    setShowWrongX(false);
    setCaptureAnimation(null);
    setPuzzleStartTime(Date.now());

    console.log('Puzzle initialized:', {
      id: puzzle.id,
      originalFen: puzzle.fen,
      setupMove: movesList[0],
      puzzleFen: game.fen(),
      userTurn: game.turn(),
      orientation: userColor,
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
      setTargetCycles(getTrainingSet.data.targetCycles || 3);

      // Resume from saved checkpoint if available
      const savedPuzzleIndex = getTrainingSet.data.currentPuzzleIndex ?? 0;
      const savedCycle = getTrainingSet.data.currentCycle ?? 1;
      const savedCorrectCount = getTrainingSet.data.correctCount ?? 0;

      // Clamp to valid range in case puzzles changed
      const resumeIndex = Math.min(savedPuzzleIndex, puzzleList.length - 1);

      console.log('Resuming session:', {
        savedPuzzleIndex,
        savedCycle,
        savedCorrectCount,
        resumeIndex,
        totalPuzzles: puzzleList.length,
      });

      setCurrentPuzzleIndex(resumeIndex);
      setCurrentCycle(savedCycle);
      setCorrectCount(savedCorrectCount);
      setSolved(false);

      // Initialize puzzle at the resume point
      initializePuzzle(puzzleList[resumeIndex]);

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading puzzles:", error);
      setIsLoading(false);
    }
  }, [getTrainingSet.data?.id]); // Only depend on training set ID to prevent re-initialization

  // Responsive board sizing — measure the actual container so nothing gets clipped
  useEffect(() => {
    const measure = () => {
      const el = boardContainerRef.current;
      if (el) {
        const { width, height } = el.getBoundingClientRect();
        // Use the smaller of width/height minus 16px padding on each side
        setBoardSize(Math.min(width - 32, height - 32, 520));
      } else {
        // Fallback before ref is attached
        const w = window.innerWidth;
        const h = window.innerHeight;
        setBoardSize(Math.min(w - 48, h - 160, 520));
      }
    };
    const ro = new ResizeObserver(measure);
    if (boardContainerRef.current) ro.observe(boardContainerRef.current);
    window.addEventListener('resize', measure);
    measure();
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);

  // Advance to next puzzle
  const advanceToNextPuzzle = useCallback(() => {
    if (currentPuzzleIndex < puzzles.length - 1) {
      const nextIndex = currentPuzzleIndex + 1;
      setCurrentPuzzleIndex(nextIndex);
      initializePuzzle(puzzles[nextIndex]);

      // Save progress to DB so session can be resumed
      updateTrainingSetMutation.mutate({
        id: sessionId,
        currentPuzzleIndex: nextIndex,
        currentCycle: currentCycle,
        correctCount: correctCount,
        lastPlayedAt: new Date(),
      });
    } else {
      // Cycle completed - record cycle
      const accuracy = (correctCount / puzzles.length) * 100;
      
      // Track cycle completion in Matomo
      trackCycleComplete(puzzles.length, correctCount, accuracy);
      
      completeCycleMutation.mutate({
        deviceId: getOrCreateDeviceId(),
        trainingSetId: sessionId,
        totalPuzzles: puzzles.length,
        correctCount,
        totalTimeMs: sessionTime * 1000,
        accuracy,
      });

      // Compute bestAccuracy: compare current cycle accuracy with stored best
      const currentBestAccuracy = getTrainingSet.data?.bestAccuracy
        ? parseFloat(String(getTrainingSet.data.bestAccuracy))
        : 0;
      const newBestAccuracy = Math.max(currentBestAccuracy, accuracy);

      if (currentCycle < targetCycles) {
        // Start next cycle
        const nextCycle = currentCycle + 1;
        setCurrentCycle(nextCycle);
        setCurrentPuzzleIndex(0);
        setCorrectCount(0);
        initializePuzzle(puzzles[0]);

        // Save progress: new cycle, reset puzzle index, update bestAccuracy
        updateTrainingSetMutation.mutate({
          id: sessionId,
          currentPuzzleIndex: 0,
          currentCycle: nextCycle,
          correctCount: 0,
          cyclesCompleted: currentCycle,
          bestAccuracy: newBestAccuracy.toFixed(2),
          totalTimeMs: totalTimeMsRef.current,
          lastPlayedAt: new Date(),
        });
      } else {
        // All cycles completed
        updateTrainingSetMutation.mutate({
          id: sessionId,
          cyclesCompleted: currentCycle,
          currentPuzzleIndex: 0,
          currentCycle: 1,
          correctCount: 0,
          bestAccuracy: newBestAccuracy.toFixed(2),
          totalTimeMs: totalTimeMsRef.current,
          status: "completed" as const,
          lastPlayedAt: new Date(),
        });

        // Aggregate stats after cycle completion
        aggregateStatsMutation.mutate({
          userId: user?.id,
          deviceId: getOrCreateDeviceId(),
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

      // FIX #3: Check if this move captures a piece and trigger capture animation
      const targetPiece = game.get(to as any);
      if (targetPiece) {
        setCaptureAnimation({ piece: targetPiece, from, to });
        safePuzzleTimeout(() => setCaptureAnimation(null), 400);
      }

      playUCIMove(game, opponentMove);
      setGameFen(game.fen());
      setAutoSolveMove(null);
      setUserMoveIndex(nextMoveIndex + 1); // User needs to play the next move
    }, 600);

    return false; // puzzle not yet complete
  }, [playUCIMove, safePuzzleTimeout]);

  // Helper: mark puzzle as solved and advance
  const markPuzzleSolved = useCallback(() => {
    const puzzleTimeMs = Date.now() - puzzleStartTime;
    recordPuzzleAttempt(true, puzzleTimeMs);
    
    // Track puzzle solved in Matomo
    trackPuzzleSolved(100, puzzleTimeMs);
    
    setCorrectCount(prev => {
      const newCount = prev + 1;
      // Save updated correct count to DB immediately
      updateTrainingSetMutation.mutate({
        id: sessionId,
        correctCount: newCount,
        lastPlayedAt: new Date(),
      });
      return newCount;
    });
    setShowCorrectCheckmark(true);
    setSolved(true);
    safePuzzleTimeout(() => setShowCorrectCheckmark(false), 1800);
    safePuzzleTimeout(() => advanceToNextPuzzle(), 2000);
  }, [puzzleStartTime, recordPuzzleAttempt, safePuzzleTimeout, advanceToNextPuzzle, sessionId]);

  // Helper: auto-solve the puzzle after a wrong move
  const autoSolvePuzzle = useCallback((currentPuzzle: any, movesList: string[]) => {
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
          // FIX #3: Check for captures during auto-solve
          const targetPiece = solveGame.get(to as any);
          if (targetPiece) {
            setCaptureAnimation({ piece: targetPiece, from, to });
            safePuzzleTimeout(() => setCaptureAnimation(null), 400);
          }

          playUCIMove(solveGame, move);
          setGameFen(solveGame.fen());
          setAutoSolveMove(null);
          solveIndex++;

          safePuzzleTimeout(playNextSolveMove, delayPerMove * 0.3);
        }, delayPerMove * 0.7);
      };

      playNextSolveMove();
    }, 300);
  }, [playUCIMove, safePuzzleTimeout, advanceToNextPuzzle]);

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

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    console.log('[handleMove] Called with:', { sourceSquare, targetSquare, solved, isAutoSolving });
    if (solved) return false;
    // Allow dragging pieces even during auto-solve animation

    const currentPuzzle = puzzles[currentPuzzleIndex];
    if (!currentPuzzle) return false;

    const movesList = parseMovesList(currentPuzzle);
    const expectedMove = movesList[userMoveIndex];

    if (!expectedMove) {
      console.log('No expected move at index:', userMoveIndex);
      return false;
    }

    try {
      // Create a fresh game instance from current FEN to ensure we're validating against the latest state
      const game = new Chess(gameFen);

      // Pre-validate: check if source square has a piece
      const piece = game.get(sourceSquare as any);
      if (!piece) {
        console.log('No piece on source square:', sourceSquare);
        return false;
      }

      // FIX #4: Allow any legal move, not just the correct solution
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

      // FIX #3: Check if this move captures a piece BEFORE making the move
      const capturedPiece = game.get(targetSquare as any);

      const result = game.move(moveObj);
      if (!result) {
        console.log('Move rejected by engine');
        return false;
      }

      // FIX #3: Trigger capture animation if a piece was captured
      if (capturedPiece) {
        setCaptureAnimation({ piece: capturedPiece, from: sourceSquare, to: targetSquare });
        safePuzzleTimeout(() => setCaptureAnimation(null), 400);
      }

      // Build UCI string for comparison
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;
      console.log('Move validation:', { userMoveIndex, expectedMove, moveUCI, totalMoves: movesList.length });

      // CRITICAL: Sync gameRef.current with the local game instance
      // playOpponentResponse reads from gameRef.current, so it must have the user's move applied
      gameRef.current = game;

      // Update the board with the move (FIX #4: always show the move, even if wrong)
      setGameFen(game.fen());

      if (expectedMove === moveUCI) {
        // ===== CORRECT MOVE =====
        // Check if there are more moves in the sequence (FIX #2: multi-move support)
        const nextOpponentMoveIndex = userMoveIndex + 1;

        if (nextOpponentMoveIndex >= movesList.length) {
          // Puzzle fully solved - no more moves
          markPuzzleSolved();
        } else {
          // Play opponent's response, then wait for user's next move
          const puzzleDone = playOpponentResponse(movesList, nextOpponentMoveIndex);

          if (puzzleDone) {
            markPuzzleSolved();
          } else {
            // Check if user has more moves after opponent response
            const nextUserMoveIndex = nextOpponentMoveIndex + 1;
            if (nextUserMoveIndex >= movesList.length) {
              // Opponent's response was the last move - puzzle solved
              safePuzzleTimeout(() => markPuzzleSolved(), 700);
            }
            // Otherwise, user needs to play nextUserMoveIndex (set by playOpponentResponse)
          }
        }
      } else {
        // ===== WRONG MOVE (but legal) =====
        // Lock the board immediately so the puzzle can't be replayed
        setSolved(true);
        setShowWrongX(true);

        // Record incorrect attempt
        const puzzleTimeMs = Date.now() - puzzleStartTime;
        recordPuzzleAttempt(false, puzzleTimeMs);

        // Show cross animation, then auto-solve to show the correct solution
        safePuzzleTimeout(() => {
          setShowWrongX(false);
          // Auto-solve: reset board and replay the correct solution
          autoSolvePuzzle(currentPuzzle, movesList);
        }, 1800);
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex flex-col overflow-hidden" style={{ zIndex: 40 }}>
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
          {(getTrainingSet.data?.openingName || currentPuzzle?.openingName) && (
            <p className="text-xs sm:text-sm text-teal-300 mb-1 sm:mb-2 font-semibold">
              {getTrainingSet.data?.openingName || currentPuzzle?.openingName}
            </p>
          )}
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-1">
            <div>
              <p className="text-xs text-slate-400">Time</p>
              <p className="text-sm font-bold text-amber-400">{formatTime(sessionTime)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Sets</p>
              <p className="text-sm font-bold text-amber-400">{currentCycle}/{targetCycles}</p>
            </div>
          </div>
          <div className="w-24 sm:w-32 md:w-40 h-0.5 bg-slate-800 rounded-full mx-auto overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-amber-400 font-bold">{currentPuzzleIndex}/{puzzles.length}</p>
          <p className="text-slate-400 text-xs">Puzzles Solved</p>
        </div>
      </div>

      {/* Board Container - Centered */}
      <div ref={boardContainerRef} className="flex-1 flex items-center justify-center overflow-hidden">
        <div style={{ width: boardSize, height: boardSize }} className="relative">
          <ChessgroundBoard
            fen={gameFen}
            onMove={handleMove}
            orientation={boardOrientation}
            boardSize={boardSize}
            theme={boardTheme}
          />

          {/* Star Animation for Correct Solutions */}
          {showCorrectCheckmark && !isAutoSolving && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="star-correct-animation">
                {/* Glow ring */}
                <div className="star-glow" />
                {/* Sparkle particles */}
                <div className="star-sparkle sparkle-1" />
                <div className="star-sparkle sparkle-2" />
                <div className="star-sparkle sparkle-3" />
                <div className="star-sparkle sparkle-4" />
                <div className="star-sparkle sparkle-5" />
                <div className="star-sparkle sparkle-6" />
                {/* Main star */}
                <svg className="star-svg" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
            </div>
          )}

          {/* Cross Animation for Wrong Moves */}
          {showWrongX && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="cross-wrong-animation">
                {/* Red glow ring */}
                <div className="cross-glow" />
                {/* Main cross */}
                <svg className="cross-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
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
