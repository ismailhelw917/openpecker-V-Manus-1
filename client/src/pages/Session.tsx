import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Chessboard as ChessboardComponent } from "react-chessboard";
const Chessboard = ChessboardComponent as any;
import { Chess } from "chess.js";

export default function Session() {
  const [match, params] = useRoute("/session/:id");
  const [, setLocation] = useLocation();
  const sessionId = params?.id as string;

  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [game, setGame] = useState(new Chess());
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSolution, setShowSolution] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionStartTime] = useState(Date.now());

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading puzzles...</p>
        </div>
      </div>
    );
  }

  if (getTrainingSet.isError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <Card className="bg-slate-900/50 border-teal-900/30 p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">Error Loading Training Set</h2>
          <p className="text-slate-400 mb-6">
            Failed to load the training set. Please try again.
          </p>
          <Button
            onClick={() => setLocation("/sets")}
            className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold"
          >
            Back to Sets
          </Button>
        </Card>
      </div>
    );
  }

  if (puzzles.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <Card className="bg-slate-900/50 border-teal-900/30 p-8 text-center max-w-md">
          <h2 className="text-2xl font-bold text-amber-400 mb-4">No Puzzles Found</h2>
          <p className="text-slate-400 mb-6">
            No puzzles available for the selected configuration. Try adjusting your filters.
          </p>
          <Button
            onClick={() => setLocation("/train")}
            className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold"
          >
            Back to Configuration
          </Button>
        </Card>
      </div>
    );
  }

  const currentPuzzle = puzzles[currentPuzzleIndex];
  const progress = ((currentPuzzleIndex + 1) / puzzles.length) * 100;

  const handleMove = (move: any) => {
    try {
      const gameCopy = new Chess(game.fen());
      let result;
      try {
        result = gameCopy.move(move);
      } catch (e) {
        result = null;
      }

      if (result) {
        setGame(gameCopy);

        if (currentPuzzle.moves && currentPuzzle.moves[0] === result.san) {
          setCorrectCount(correctCount + 1);
          toast.success("Correct move!");
          setTimeout(() => {
            if (currentPuzzleIndex < puzzles.length - 1) {
              setCurrentPuzzleIndex(currentPuzzleIndex + 1);
              const nextPuzzle = puzzles[currentPuzzleIndex + 1];
              const newGame = new Chess(nextPuzzle.fen);
              setGame(newGame);
              setShowSolution(false);
            } else {
              toast.success("Cycle completed!");
              setLocation("/sets");
            }
          }, 1000);
        } else {
          toast.error("Incorrect move");
          setGame(new Chess(currentPuzzle.fen));
        }
      }
    } catch (error) {
      console.error("Move error:", error);
    }
  };

  const handleNextPuzzle = () => {
    if (currentPuzzleIndex < puzzles.length - 1) {
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
      const nextPuzzle = puzzles[currentPuzzleIndex + 1];
      const newGame = new Chess(nextPuzzle.fen);
      setGame(newGame);
      setShowSolution(false);
    }
  };

  const handlePreviousPuzzle = () => {
    if (currentPuzzleIndex > 0) {
      setCurrentPuzzleIndex(currentPuzzleIndex - 1);
      const prevPuzzle = puzzles[currentPuzzleIndex - 1];
      const newGame = new Chess(prevPuzzle.fen);
      setGame(newGame);
      setShowSolution(false);
    }
  };

  const handleReset = () => {
    const newGame = new Chess(currentPuzzle.fen);
    setGame(newGame);
    setShowSolution(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => setLocation("/sets")}
            variant="outline"
            className="border-teal-900/30 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-amber-400">
              Puzzle {currentPuzzleIndex + 1} of {puzzles.length}
            </h1>
            <div className="w-64 h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-amber-400 font-bold">{correctCount} Correct</p>
            <p className="text-slate-400 text-sm">
              {Math.round((correctCount / (currentPuzzleIndex + 1)) * 100)}% Accuracy
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chessboard */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <div className="aspect-square bg-slate-800 rounded-lg overflow-hidden">
                <Chessboard
                  position={game.fen()}
                  onPieceDrop={handleMove}
                  boardWidth={400}
                  arePiecesDraggable={true}
                />
              </div>
            </Card>
          </div>

          {/* Info Panel */}
          <div className="space-y-4">
            {/* Puzzle Info */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">Puzzle Info</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-400">Rating</p>
                  <p className="text-white font-semibold">{currentPuzzle.rating || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">Theme</p>
                  <p className="text-white font-semibold">{currentPuzzle.themes || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-400">Moves</p>
                  <p className="text-white font-semibold">{currentPuzzle.moves?.length || 0}</p>
                </div>
              </div>
            </Card>

            {/* Controls */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <div className="space-y-3">
                <Button
                  onClick={handleReset}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
                <Button
                  onClick={() => setShowSolution(!showSolution)}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold"
                >
                  {showSolution ? "Hide" : "Show"} Solution
                </Button>
              </div>
            </Card>

            {/* Navigation */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <div className="flex gap-2">
                <Button
                  onClick={handlePreviousPuzzle}
                  disabled={currentPuzzleIndex === 0}
                  variant="outline"
                  className="flex-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={handleNextPuzzle}
                  disabled={currentPuzzleIndex === puzzles.length - 1}
                  variant="outline"
                  className="flex-1"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>

            {/* Solution */}
            {showSolution && (
              <Card className="bg-slate-900/50 border-teal-900/30 p-6">
                <h3 className="text-amber-400 font-bold mb-3">Solution</h3>
                <p className="text-white font-mono text-sm break-words">
                  {currentPuzzle.moves?.join(" ") || "No solution available"}
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
