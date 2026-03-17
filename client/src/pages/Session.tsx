import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
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

        if (!Array.isArray(puzzleList) || puzzleList.length === 0) {
          toast.error("No puzzles loaded");
          setIsLoading(false);
          setPuzzles([]);
          return;
        }

        setPuzzles(puzzleList);
        setIsLoading(false);

        // Load first puzzle
        const firstPuzzle = puzzleList[0];
        if (firstPuzzle && firstPuzzle.fen) {
          try {
            const chess = new Chess(firstPuzzle.fen);
            setGame(chess);
          } catch (e) {
            console.error("Invalid FEN:", firstPuzzle.fen, e);
            toast.error("Invalid puzzle format");
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
        <Card className="bg-red-900/30 border-red-900/50 p-6 text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-400 font-bold">No puzzles found</p>
          <button
            onClick={() => setLocation("/train")}
            className="mt-4 px-4 py-2 bg-amber-500 text-slate-900 rounded font-bold hover:bg-amber-400"
          >
            Back to Training
          </button>
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
            // Reset game to next puzzle FEN
            const nextPuzzle = puzzles[currentPuzzleIndex + 1];
            if (nextPuzzle && nextPuzzle.fen) {
              setGame(new Chess(nextPuzzle.fen));
            }
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
    <div className="w-screen h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-teal-900/30">
        <button
          onClick={() => setLocation("/sets")}
          className="flex items-center gap-2 text-amber-400 hover:text-amber-300"
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

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center">
          <div style={{ width: "min(100%, 100vh - 120px)", aspectRatio: "1" }}>
            <Chessboard
              position={game.fen()}
              onPieceDrop={handleMove}
              boardWidth={Math.min(500, typeof window !== "undefined" ? window.innerWidth - 32 : 500)}
              arePiecesDraggable={!solved}
            />
          </div>
        </div>
      </div>

      {/* Status Message */}
      {solved && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <Card className="bg-green-900/30 border-green-900/50 p-4">
            <p className="text-green-400 font-bold">✓ Correct! Loading next...</p>
          </Card>
        </div>
      )}
    </div>
  );
}
