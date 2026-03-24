import { useEffect, useState } from "react";
import { Chessboard as ChessboardComponent } from "react-chessboard";
const Chessboard = ChessboardComponent as any;
import { Chess } from "chess.js";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
  color?: string;
}

interface ChessBoardProps {
  puzzle: Puzzle;
  onComplete: (isCorrect: boolean) => void;
}

export function ChessBoard({ puzzle, onComplete }: ChessBoardProps) {
  const [game, setGame] = useState<Chess>(new Chess(puzzle.fen));
  const [moveIndex, setMoveIndex] = useState(0);
  const [solved, setSolved] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  useEffect(() => {
    // Reset game when puzzle changes
    const newGame = new Chess(puzzle.fen);
    setGame(newGame);
    setMoveIndex(0);
    setSolved(false);
    setShowHint(false);
    setMessage(null);
  }, [puzzle]);

  const handleMove = (sourceSquare: string, targetSquare: string) => {
    if (solved) return false;

    try {
      const newGame = new Chess(game.fen());
      const moves = newGame.moves({ verbose: true }) as any[];

      // Check if move is legal
      const move = moves.find(
        (m: any) => m.from === sourceSquare && m.to === targetSquare
      );

      if (!move) {
        setMessage({ text: "Illegal move", type: "error" });
        return false;
      }

      // Check if move matches the solution
      const correctMove = puzzle.moves[moveIndex];
      const moveNotation = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });

      if (!moveNotation) {
        setMessage({ text: "Invalid move", type: "error" });
        return false;
      }

      // Validate move sequence
      const moveStr = moveNotation.san || moveNotation.from + moveNotation.to;
      if (moveStr === correctMove) {
        setGame(newGame);
        setMoveIndex(moveIndex + 1);

        // Check if puzzle is solved
        if (moveIndex + 1 >= puzzle.moves.length) {
          setSolved(true);
          setMessage({ text: "Puzzle solved! ✓", type: "success" });
          setTimeout(() => {
            onComplete(true);
          }, 1000);
        } else {
          setMessage({ text: "Good move! Continue...", type: "info" });
        }

        return true;
      } else {
        // Wrong move
        setMessage({
          text: `Wrong move. Expected: ${correctMove}`,
          type: "error",
        });
        return false;
      }
    } catch (error) {
      console.error("Move error:", error);
      setMessage({ text: "Error processing move", type: "error" });
      return false;
    }
  };

  const handleHint = () => {
    if (moveIndex < puzzle.moves.length) {
      setShowHint(true);
      setMessage({
        text: `Hint: ${puzzle.moves[moveIndex]}`,
        type: "info",
      });
    }
  };

  const handleReset = () => {
    const newGame = new Chess(puzzle.fen);
    setGame(newGame);
    setMoveIndex(0);
    setSolved(false);
    setShowHint(false);
    setMessage(null);
  };

  const handleGiveUp = () => {
    setSolved(true);
    setMessage({
      text: `Solution: ${puzzle.moves.join(" ")}`,
      type: "error",
    });
    setTimeout(() => {
      onComplete(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Chessboard */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex justify-center items-center w-full">
          <div className="w-full aspect-square max-w-[90vw] max-h-[60vh]">
            {/* @ts-ignore - react-chessboard prop types */}
            <Chessboard
              position={game.fen()}
              onPieceDrop={handleMove}
              arePiecesDraggable={!solved}
              customDarkSquareStyle={{ backgroundColor: "#4a5568" }}
              customLightSquareStyle={{ backgroundColor: "#e2e8f0" }}
              boardWidth={Math.min(window.innerWidth * 0.9, window.innerHeight * 0.6)}
            />
          </div>
        </div>
      </Card>

      {/* Message Display */}
      {message && (
        <Card
          className={`p-4 flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-900/30 border-green-700"
              : message.type === "error"
              ? "bg-red-900/30 border-red-700"
              : "bg-blue-900/30 border-blue-700"
          }`}
        >
          {message.type === "success" && (
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          )}
          {message.type === "error" && (
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          )}
          <span
            className={
              message.type === "success"
                ? "text-green-300"
                : message.type === "error"
                ? "text-red-300"
                : "text-blue-300"
            }
          >
            {message.text}
          </span>
        </Card>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleHint}
          disabled={solved || moveIndex >= puzzle.moves.length}
        >
          Hint
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={handleReset}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button
          variant="destructive"
          className="flex-1"
          onClick={handleGiveUp}
          disabled={solved}
        >
          Give Up
        </Button>
      </div>

      {/* Progress */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">
            Moves: {moveIndex} / {puzzle.moves.length}
          </span>
          <div className="flex gap-1">
            {puzzle.moves.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx < moveIndex
                    ? "bg-green-500"
                    : idx === moveIndex
                    ? "bg-amber-500"
                    : "bg-slate-600"
                }`}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
