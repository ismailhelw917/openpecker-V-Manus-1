import { useEffect, useState } from "react";
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

  // TODO: Implement recordAttempt endpoint
  // const recordAttempt = trpc.puzzles.recordAttempt.useMutation();

  useEffect(() => {
    if (getTrainingSet.data) {
      const puzzleList = JSON.parse(getTrainingSet.data.puzzlesJson || "[]");
      setPuzzles(puzzleList);
      setIsLoading(false);

      if (puzzleList.length > 0) {
        const firstPuzzle = puzzleList[0];
        const chess = new Chess(firstPuzzle.fen);
        setGame(chess);
      }
    }
  }, [getTrainingSet.data]);

  if (!match) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading puzzles...</p>
        </div>
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

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (move === null) return false;

      const newGame = new Chess(game.fen());
      setGame(newGame);

      // Check if this is the correct move
      const correctMoves = currentPuzzle.moves || [];
      const isCorrectMove =
        correctMoves.length > 0 &&
        correctMoves[0] === `${sourceSquare}${targetSquare}`;

      if (isCorrectMove) {
        setCorrectCount((prev) => prev + 1);
        toast.success("Correct move!");

        // Move to next puzzle after a short delay
        setTimeout(() => {
          if (currentPuzzleIndex < puzzles.length - 1) {
            setCurrentPuzzleIndex((prev) => prev + 1);
            setShowSolution(false);
            const nextPuzzle = puzzles[currentPuzzleIndex + 1];
            const nextGame = new Chess(nextPuzzle.fen);
            setGame(nextGame);
          } else {
            // Session complete
            handleSessionComplete();
          }
        }, 1000);
      } else {
        toast.error("Incorrect move. Try again!");
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  const handleSessionComplete = async () => {
    const sessionDuration = Date.now() - sessionStartTime;
    const accuracy = (correctCount / puzzles.length) * 100;

    // TODO: Save attempt to database
    toast.success("Session completed!");
    setLocation("/sets");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setLocation("/train")}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-amber-400">Puzzle Training</h1>
            <div className="text-slate-400 text-sm">
              {currentPuzzleIndex + 1} / {puzzles.length}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-800 rounded-full h-2">
            <div
              className="bg-amber-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chessboard */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <div className="bg-slate-800 rounded-lg p-4 mb-4">
                <div style={{ maxWidth: "400px", margin: "0 auto" }}>
                  <Chessboard
                    position={game.fen()}
                    onPieceDrop={handleMove}
                    customBoardStyle={{
                      borderRadius: "8px",
                      boxShadow: "0 0 20px rgba(251, 191, 36, 0.2)",
                    }}
                  />
                </div>
              </div>

              {/* Puzzle Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-slate-400 text-xs mb-1">RATING</p>
                  <p className="text-white font-bold">{currentPuzzle.rating || "—"}</p>
                </div>
                <div className="bg-slate-800/50 rounded p-3">
                  <p className="text-slate-400 text-xs mb-1">THEME</p>
                  <p className="text-white font-bold text-sm">
                    {currentPuzzle.themes?.[0] || "—"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Stats */}
            <Card className="bg-teal-900/20 border-teal-600/40 p-4">
              <h3 className="text-amber-400 font-bold mb-4">Session Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Correct:</span>
                  <span className="text-white font-bold">{correctCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Accuracy:</span>
                  <span className="text-amber-400 font-bold">
                    {((correctCount / (currentPuzzleIndex + 1)) * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Remaining:</span>
                  <span className="text-white font-bold">
                    {puzzles.length - currentPuzzleIndex - 1}
                  </span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            <div className="space-y-2">
              <Button
                onClick={() => setShowSolution(!showSolution)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              >
                {showSolution ? "Hide Solution" : "Show Solution"}
              </Button>

              {showSolution && (
                <Card className="bg-slate-800/50 border-slate-700 p-3">
                  <p className="text-slate-400 text-xs mb-2">SOLUTION</p>
                  <p className="text-amber-400 font-mono text-sm">
                    {currentPuzzle.moves?.[0] || "No solution"}
                  </p>
                </Card>
              )}

              <Button
                onClick={() => {
                  const newGame = new Chess(currentPuzzle.fen);
                  setGame(newGame);
                  setShowSolution(false);
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>

            {/* Navigation */}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (currentPuzzleIndex > 0) {
                    setCurrentPuzzleIndex((prev) => prev - 1);
                    const prevPuzzle = puzzles[currentPuzzleIndex - 1];
                    const prevGame = new Chess(prevPuzzle.fen);
                    setGame(prevGame);
                    setShowSolution(false);
                  }
                }}
                disabled={currentPuzzleIndex === 0}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                onClick={() => {
                  if (currentPuzzleIndex < puzzles.length - 1) {
                    setCurrentPuzzleIndex((prev) => prev + 1);
                    const nextPuzzle = puzzles[currentPuzzleIndex + 1];
                    const nextGame = new Chess(nextPuzzle.fen);
                    setGame(nextGame);
                    setShowSolution(false);
                  } else {
                    handleSessionComplete();
                  }
                }}
                className="flex-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold"
              >
                {currentPuzzleIndex === puzzles.length - 1 ? "Finish" : "Next"}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
