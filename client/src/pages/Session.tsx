import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Chessboard as ChessboardComponent } from "react-chessboard";
const Chessboard = ChessboardComponent as any;
import { Chess } from "chess.js";
import { AlertCircle, Loader2, ChevronLeft } from "lucide-react";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [game, setGame] = useState<Chess | null>(null);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);

  const getTrainingSet = trpc.trainingSets.getById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

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
      
      // Load first puzzle
      const firstPuzzle = puzzleList[0];
      if (firstPuzzle?.fen) {
        try {
          const chess = new Chess(firstPuzzle.fen);
          setGame(chess);
          console.log("Loaded first puzzle FEN:", firstPuzzle.fen);
        } catch (e) {
          console.error("Invalid FEN:", firstPuzzle.fen, e);
          toast.error("Invalid puzzle FEN");
        }
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
      <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading puzzles...</p>
        </div>
      </div>
    );
  }

  if (!puzzles || puzzles.length === 0) {
    return (
      <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-900/50 p-6 text-center rounded-lg max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-bold">No puzzles found</p>
          <button
            onClick={() => setLocation("/train")}
            className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 rounded font-bold hover:bg-amber-400"
          >
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentPuzzleIndex];
  const progress = ((currentPuzzleIndex + 1) / puzzles.length) * 100;

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved || !game) return false;

    try {
      const gameCopy = new Chess(game.fen());
      
      // Try to make the move with promotion handling
      let result = null;
      try {
        result = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch (e) {
        console.error("Move error:", e);
        return false;
      }

      if (!result) return false;

      setGame(gameCopy);

      // Check if move is correct
      const expectedMove = currentPuzzle.moves?.[0];
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;

      if (expectedMove === moveUCI) {
        setCorrectCount((prev) => prev + 1);
        toast.success("Correct!");
        setSolved(true);

        // Auto-advance after 1 second
        setTimeout(() => {
          if (currentPuzzleIndex < puzzles.length - 1) {
            const nextIndex = currentPuzzleIndex + 1;
            setCurrentPuzzleIndex(nextIndex);
            setSolved(false);
            
            const nextPuzzle = puzzles[nextIndex];
            if (nextPuzzle?.fen) {
              setGame(new Chess(nextPuzzle.fen));
            }
          } else {
            toast.success("All puzzles completed!");
            setTimeout(() => setLocation("/sets"), 1000);
          }
        }, 1000);
      } else {
        toast.error("Wrong move");
        setGame(new Chess(currentPuzzle.fen));
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex flex-col pb-20">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-teal-900/30 flex-shrink-0">
        <button
          onClick={() => setLocation("/sets")}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300 font-bold"
        >
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold text-amber-400">
            Puzzle {currentPuzzleIndex + 1} of {puzzles.length}
          </h1>
          <div className="w-48 h-1 bg-slate-800 rounded-full mt-2 mx-auto overflow-hidden">
            <div
              className="h-full bg-amber-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <p className="text-amber-400 font-bold text-lg">{correctCount}/{puzzles.length}</p>
          <p className="text-slate-400 text-xs">Correct</p>
        </div>
      </div>

      {/* Board Container */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {game && (
          <div style={{ width: "min(100%, 90vh)", aspectRatio: "1" }}>
            <Chessboard
              position={game.fen()}
              onPieceDrop={handleMove}
              boardWidth={Math.min(600, typeof window !== "undefined" ? window.innerWidth - 32 : 600)}
              arePiecesDraggable={!solved}
            />
          </div>
        )}
      </div>

      {/* Status Message */}
      {solved && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="bg-green-900/90 border border-green-900 p-6 rounded-lg">
            <p className="text-green-400 font-bold text-lg">✓ Correct!</p>
          </div>
        </div>
      )}
    </div>
  );
}
