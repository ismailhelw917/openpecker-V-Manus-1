import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Chess } from "chess.js";
import { ChevronLeft } from "lucide-react";
import { CustomChessboard } from "@/components/CustomChessboard";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);
  const [boardSize, setBoardSize] = useState(400);
  const [captureSquare, setCaptureSquare] = useState<string | null>(null);

  const getTrainingSet = trpc.trainingSets.getById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

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
        toast.error("No puzzles loaded");
        setIsLoading(false);
        return;
      }

      setPuzzles(puzzleList);
      setCurrentPuzzleIndex(0);
      setCorrectCount(0);
      setSolved(false);
      
      // Load first puzzle FEN
      const firstPuzzle = puzzleList[0];
      if (firstPuzzle?.fen) {
        setFen(firstPuzzle.fen);
        console.log("Loaded puzzle FEN:", firstPuzzle.fen);
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error loading puzzles:", error);
      toast.error("Failed to load puzzles");
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
  const boardOrientation = isWhiteTurn ? 'white' : 'black';

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved) return false;
    if (!currentPuzzle?.fen) return false;

    try {
      // Use the current puzzle's FEN directly to avoid race conditions
      const game = new Chess(currentPuzzle.fen);
      
      let result = null;
      try {
        result = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
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
      // Parse moves string (space-separated) to get the first move
      const movesString = typeof currentPuzzle.moves === 'string' ? currentPuzzle.moves : '';
      const movesList = movesString.split(' ').filter((m: string) => m.length > 0);
      const expectedMove = movesList[0];
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;

      console.log('Move validation:', { expectedMove, moveUCI, movesString, movesList, puzzleId: currentPuzzle.id });

      if (expectedMove === moveUCI) {
        setCorrectCount((prev) => prev + 1);
        toast.success("Correct!");
        setSolved(true);

        // Auto-advance after 1.5 seconds
        setTimeout(() => {
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
            toast.success("All puzzles completed!");
            setTimeout(() => setLocation("/sets"), 1000);
          }
        }, 1500);
      } else {
        // Show capture animation on wrong move
        setCaptureSquare(targetSquare);
        toast.error("Wrong move");
        
        // Reset board after animation and show auto-solve
        setTimeout(() => {
          setFen(currentPuzzle.fen);
          setCaptureSquare(null);
          
          // Auto-solve after 3 seconds
          setTimeout(() => {
            // Play the correct move automatically
            const game = new Chess(currentPuzzle.fen);
            const movesString = typeof currentPuzzle.moves === 'string' ? currentPuzzle.moves : '';
            const movesList = movesString.split(' ').filter((m: string) => m.length > 0);
            const expectedMove = movesList[0];
            if (expectedMove) {
              const from = expectedMove.substring(0, 2);
              const to = expectedMove.substring(2, 4);
              const promotion = expectedMove.length > 4 ? expectedMove[4] : undefined;
              
              try {
                const moveResult = game.move({ from, to, promotion: promotion || 'q' });
                if (moveResult) {
                  setFen(game.fen());
                  setCorrectCount((prev) => prev + 1);
                  toast.info("Auto-solved: " + expectedMove);
                  setSolved(true);
                  
                  // Auto-advance after 1.5 seconds
                  setTimeout(() => {
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
                      toast.success("All puzzles completed!");
                      setTimeout(() => setLocation("/sets"), 1000);
                    }
                  }, 1500);
                }
              } catch (e) {
                console.error("Error auto-solving:", e);
              }
            }
          }, 3000);
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
          <h1 className="text-lg font-bold text-amber-400">
            Puzzle {currentPuzzleIndex + 1} / {puzzles.length}
          </h1>
          <div className="w-32 h-0.5 bg-slate-800 rounded-full mt-1 mx-auto overflow-hidden">
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
        <div style={{ width: boardSize, height: boardSize }}>
          <CustomChessboard
            game={new Chess(fen)}
            onPieceDrop={handleMove}
            boardColors={{ light: '#f0d9b5', dark: '#b58863' }}
            captureSquare={captureSquare}
            orientation={boardOrientation}
          />
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="h-20 border-t border-teal-900/30 bg-slate-900/50 flex-shrink-0" />

      {/* Status Message */}
      {solved && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-green-900/90 border border-green-900 p-4 rounded-lg">
            <p className="text-green-400 font-bold">✓ Correct!</p>
          </div>
        </div>
      )}
    </div>
  );
}
