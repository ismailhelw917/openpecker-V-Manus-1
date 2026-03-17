import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChessBoard } from "@/components/ChessBoard";
import { Loader2, ChevronLeft, CheckCircle2, XCircle } from "lucide-react";

export default function TrainingSession() {
  const { setId } = useParams<{ setId: string }>();
  const [, setLocation] = useLocation();
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [cycleNumber, setCycleNumber] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [puzzleTimes, setPuzzleTimes] = useState<number[]>([]);

  // Fetch training set
  const setQuery = trpc.trainingSets.getById.useQuery(
    { id: setId || "" },
    { enabled: !!setId }
  );

  // Fetch cycle history
  const cycleQuery = trpc.cycles.getBySet.useQuery(
    { trainingSetId: setId || "" },
    { enabled: !!setId }
  );

  const trainingSet = setQuery.data;
  const puzzles = trainingSet?.puzzlesJson || [];
  const currentPuzzle = puzzles[currentPuzzleIndex];

  useEffect(() => {
    setStartTime(Date.now());
  }, [currentPuzzleIndex]);

  const handlePuzzleComplete = async (isCorrect: boolean) => {
    if (!trainingSet || !currentPuzzle) return;

    const timeMs = startTime ? Date.now() - startTime : 0;
    setPuzzleTimes([...puzzleTimes, timeMs]);

    if (isCorrect) {
      setCorrectCount(correctCount + 1);
    }

    // Record attempt
    const attemptsMutation = trpc.attempts.record.useMutation();
    await attemptsMutation.mutateAsync({
      trainingSetId: setId || "",
      cycleNumber,
      puzzleId: currentPuzzle.id,
      isCorrect,
      timeMs,
      deviceId: localStorage.getItem("openpecker-device-id") || undefined,
    });

    // Move to next puzzle
    if (currentPuzzleIndex < puzzles.length - 1) {
      setCurrentPuzzleIndex(currentPuzzleIndex + 1);
    } else {
      // Cycle complete
      await handleCycleComplete();
    }
  };

  const handleCycleComplete = async () => {
    if (!trainingSet) return;

    const totalTimeMs = puzzleTimes.reduce((a, b) => a + b, 0);

    // Record cycle
    const cyclesMutation = trpc.cycles.complete.useMutation();
    await cyclesMutation.mutateAsync({
      trainingSetId: setId || "",
      cycleNumber,
      totalPuzzles: puzzles.length,
      correctCount,
      totalTimeMs,
      deviceId: localStorage.getItem("openpecker-device-id") || undefined,
    });

    // Check if training set is complete
    const targetCycles = trainingSet.targetCycles || 3;
    if (cycleNumber >= targetCycles) {
      // Training set complete
      setLocation("/sets");
    } else {
      // Start next cycle
      setCycleNumber(cycleNumber + 1);
      setCurrentPuzzleIndex(0);
      setCorrectCount(0);
      setPuzzleTimes([]);
    }
  };

  if (setQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!trainingSet || puzzles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Card className="bg-slate-800 border-slate-700 p-8 text-center">
          <p className="text-slate-300 mb-4">Training set not found or has no puzzles</p>
          <Button onClick={() => setLocation("/sets")}>Back to Sets</Button>
        </Card>
      </div>
    );
  }

  const progress = ((currentPuzzleIndex + 1) / puzzles.length) * 100;
  const accuracy = puzzles.length > 0 ? Math.round((correctCount / (currentPuzzleIndex + 1)) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/sets")}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">
                {trainingSet.openingName || "Training Session"}
              </h1>
              <p className="text-sm text-slate-400">
                Cycle {cycleNumber} of {trainingSet.targetCycles}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-slate-400">Accuracy</p>
              <p className="text-2xl font-bold text-amber-400">{accuracy}%</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-400">Progress</p>
              <p className="text-2xl font-bold text-white">
                {currentPuzzleIndex + 1}/{puzzles.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chessboard */}
          <div className="lg:col-span-2">
            {currentPuzzle && (
              <ChessBoard
                puzzle={currentPuzzle}
                onComplete={handlePuzzleComplete}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Progress Bar */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-sm font-bold text-white mb-4">Cycle Progress</h3>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-amber-400 h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {currentPuzzleIndex + 1} of {puzzles.length} puzzles
              </p>
            </Card>

            {/* Stats */}
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <h3 className="text-sm font-bold text-white mb-4">Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Correct</span>
                  <span className="text-lg font-bold text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {correctCount}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Incorrect</span>
                  <span className="text-lg font-bold text-red-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" />
                    {currentPuzzleIndex + 1 - correctCount}
                  </span>
                </div>
                <div className="border-t border-slate-700 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Accuracy</span>
                    <span className="text-lg font-bold text-amber-400">{accuracy}%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Puzzle Info */}
            {currentPuzzle && (
              <Card className="bg-slate-800/50 border-slate-700 p-6">
                <h3 className="text-sm font-bold text-white mb-4">Puzzle Info</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-slate-400">Rating:</span>
                    <span className="text-white ml-2">{currentPuzzle.rating}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Themes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {currentPuzzle.themes?.map((theme: string) => (
                        <span
                          key={theme}
                          className="px-2 py-1 rounded bg-amber-500/20 text-amber-300 text-xs"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
