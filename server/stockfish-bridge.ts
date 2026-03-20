/**
 * Phase 5: Stockfish Node.js Bridge
 * Spawns stockfish process and communicates via stdin/stdout
 */
import { spawn, ChildProcess } from "child_process";
import { calculateDifficulty, type PositionEval } from "./difficulty-calculator";

let stockfishProcess: ChildProcess | null = null;
let outputBuffer = "";
let resolveCallback: ((value: string[]) => void) | null = null;

function getStockfish(): ChildProcess {
  if (!stockfishProcess) {
    stockfishProcess = spawn("stockfish", [], { stdio: ["pipe", "pipe", "pipe"] });
    stockfishProcess.stdout?.on("data", (data: Buffer) => {
      outputBuffer += data.toString();
      if (outputBuffer.includes("bestmove") || outputBuffer.includes("uciok") || outputBuffer.includes("readyok")) {
        if (resolveCallback) {
          const lines = outputBuffer.split("\n").filter(Boolean);
          resolveCallback(lines);
          resolveCallback = null;
          outputBuffer = "";
        }
      }
    });
    stockfishProcess.on("exit", () => { stockfishProcess = null; });
  }
  return stockfishProcess;
}

function sendCommand(cmd: string): Promise<string[]> {
  return new Promise((resolve) => {
    const sf = getStockfish();
    outputBuffer = "";
    resolveCallback = resolve;
    sf.stdin?.write(cmd + "\n");
    setTimeout(() => {
      if (resolveCallback) {
        resolveCallback([]);
        resolveCallback = null;
      }
    }, 10000);
  });
}

export async function initStockfish(): Promise<void> {
  await sendCommand("uci");
  await sendCommand("isready");
}

export async function evaluatePosition(fen: string, depth: number = 15): Promise<PositionEval> {
  await sendCommand(`position fen ${fen}`);
  const lines = await sendCommand(`go depth ${depth}`);
  const infoLine = [...lines].reverse().find(l => l.includes("score"));
  if (!infoLine) return { type: "cp", value: 0 };
  const mateMatch = infoLine.match(/score mate (-?\d+)/);
  if (mateMatch) return { type: "mate", value: parseInt(mateMatch[1]) };
  const cpMatch = infoLine.match(/score cp (-?\d+)/);
  if (cpMatch) return { type: "cp", value: parseInt(cpMatch[1]) };
  return { type: "cp", value: 0 };
}

export async function analyzePuzzle(fen: string, moves: string[], depth: number = 15): Promise<{
  evaluations: PositionEval[];
  difficulty: number;
}> {
  const evaluations: PositionEval[] = [];
  evaluations.push(await evaluatePosition(fen, depth));
  for (const move of moves) {
    await sendCommand(`position fen ${fen} moves ${move}`);
    const lines = await sendCommand(`go depth ${depth}`);
    const infoLine = [...lines].reverse().find(l => l.includes("score"));
    if (infoLine) {
      const mateMatch = infoLine.match(/score mate (-?\d+)/);
      if (mateMatch) evaluations.push({ type: "mate", value: parseInt(mateMatch[1]) });
      else {
        const cpMatch = infoLine.match(/score cp (-?\d+)/);
        if (cpMatch) evaluations.push({ type: "cp", value: parseInt(cpMatch[1]) });
      }
    }
  }
  return { evaluations, difficulty: calculateDifficulty(evaluations) };
}

export function shutdownStockfish(): void {
  if (stockfishProcess) {
    stockfishProcess.stdin?.write("quit\n");
    stockfishProcess = null;
  }
}
