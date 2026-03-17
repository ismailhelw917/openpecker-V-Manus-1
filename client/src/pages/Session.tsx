import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Chessboard as ChessboardComponent } from "react-chessboard";
const Chessboard = ChessboardComponent as any;
import { Chess } from "chess.js";
import { AlertCircle, Loader2 } from "lucide-react";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [correctCount, setCorrectCount] = useState(0);
  const [solved, setSolved] = useState(false);

  const getTrainingSet = trpc.trainingSets.getById.useQuery(
    { id: sessionId },
    { enabled: !!sessionId }
  );

  useEffect(() => {
    if (getTrainingSet.data) {
      try {
        let puzzleList = [];

        if (getTrainingSet.data.puzzlesJson) {
          const jsonData = typeof getTrainingSet.data.puzzlesJson === "string"
            ? JSON.parse(getTrainingSet.data.puzzlesJson)
            : getTrainingSet.data.puzzlesJson;
          puzzleList = Array.isArray(jsonData) ? jsonData : [];
        }

        if (!Array.isArray(puzzleList)) {
          puzzleList = [];
        }

        setPuzzles(puzzleList);
        setIsLoading(false);

        if (puzzleList.length > 0) {
          const firstPuzzle = puzzleList[0];
          if (firstPuzzle && firstPuzzle.fen) {
            try {
              const chess = new Chess(firstPuzzle.fen);
              setGame(chess);
            } catch (e) {
              console.error("Invalid FEN:", firstPuzzle.fen);
              toast.error("Invalid puzzle format");
            }
          }
        }
      } catch (error) {
        console.error("Error parsing puzzles:", error);
        toast.error("Failed to load puzzles");
        setIsLoading(false);
        setPuzzles([]);
      }
    }
  }, [getTrainingSet.data]);

  if (!match) return null;

  if (isLoading || getTrainingSet.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading puzzles...</p>
        </div>
      </div>
    );
  }

  if (getTrainingSet.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <Card className="bg-slate-900/50 border-teal-900/30 p-8 text-center max-w-md">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Error Loading Training Set</h2>
          <p className="text-slate-400">
            Failed to load the training set. Please try again.
          </p>
        </Card>
      </div>
    );
  }

  if (puzzles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <Card className="bg-slate-900/50 border-teal-900/30 p-8 text-center max-w-md">
          <div className="flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">No Puzzles Found</h2>
          <p className="text-slate-400">
            No puzzles available for the selected configuration. Try adjusting your filters.
          </p>
        </Card>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentPuzzleIndex];
  const progress = ((currentPuzzleIndex + 1) / puzzles.length) * 100;

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved) return false;

    try {
      const gameCopy = new Chess(game.fen());
      
      // Try to make the move with promotion handling
      let result = null;
      try {
        result = gameCopy.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q", // Default to queen promotion
        });
      } catch (e) {
        console.error("Move error:", e);
        return false;
      }

      if (!result) return false;

      setGame(gameCopy);

      // Check if this is the correct move
      const expectedMove = currentPuzzle.moves?.[0];
      const moveUCI = `${result.from}${result.to}${result.promotion || ""}`;
      const moveSAN = result.san;

      if (expectedMove === moveUCI || expectedMove === moveSAN || expectedMove === result.lan) {
        setCorrectCount((prev) => prev + 1);
        toast.success("Correct move!");
        setSolved(true);

        // Auto-load next puzzle after 1.5 seconds
        setTimeout(() => {
          if (currentPuzzleIndex < puzzles.length - 1) {
            setCurrentPuzzleIndex((prev) => prev + 1);
            setSolved(false);
          } else {
            toast.success("Cycle completed!");
            setTimeout(() => setLocation("/sets"), 1000);
          }
        }, 1500);
      } else {
        toast.error("Incorrect move");
        setGame(new Chess(currentPuzzle.fen));
      }

      return true;
    } catch (error) {
      console.error("Move error:", error);
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24 px-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="text-center mb-4">
            <h1 className="text-3xl font-bold text-amber-400">
              Puzzle {currentPuzzleIndex + 1} of {puzzles.length}
            </h1>
            <div className="w-full h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className="flex justify-center gap-8 text-center">
            <div>
              <p className="text-slate-400 text-sm">Correct</p>
              <p className="text-amber-400 font-bold text-2xl">{correctCount}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Accuracy</p>
              <p className="text-amber-400 font-bold text-2xl">
                {currentPuzzleIndex > 0 ? Math.round((correctCount / (currentPuzzleIndex + 1)) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Rating</p>
              <p className="text-amber-400 font-bold text-2xl">{currentPuzzle?.rating || "—"}</p>
            </div>
          </div>
        </div>

        {/* Chessboard */}
        <div className="bg-slate-900/50 border border-teal-900/30 rounded-lg p-4 mb-8 flex justify-center">
          <div style={{ width: "min(100%, 500px)", aspectRatio: "1" }}>
            <Chessboard
              position={game.fen()}
              onPieceDrop={handleMove}
              boardWidth={Math.min(500, typeof window !== "undefined" ? window.innerWidth - 32 : 500)}
              arePiecesDraggable={!solved}
            />
          </div>
        </div>

        {/* Status Message */}
        {solved && (
          <Card className="bg-green-900/30 border-green-900/50 p-6 text-center mb-8">
            <p className="text-green-400 font-bold text-lg">✓ Correct! Loading next puzzle...</p>
          </Card>
        )}

        {/* Puzzle Info */}
        <Card className="bg-slate-900/50 border-teal-900/30 p-6">
          <h3 className="text-amber-400 font-bold mb-4">Puzzle Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-400">FEN Position</p>
              <p className="text-white font-mono text-xs break-all">{currentPuzzle?.fen}</p>
            </div>
            <div>
              <p className="text-slate-400">Themes</p>
              <p className="text-white">{currentPuzzle?.themes?.join(", ") || "—"}</p>
            </div>
            <div>
              <p className="text-slate-400">Color to Move</p>
              <p className="text-white">{currentPuzzle?.color === "white" ? "White" : "Black"}</p>
            </div>
            <div>
              <p className="text-slate-400">Solution Moves</p>
              <p className="text-white font-mono text-xs">{currentPuzzle?.moves?.join(" ") || "—"}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
