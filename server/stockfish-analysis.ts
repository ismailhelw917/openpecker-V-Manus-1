import { spawn } from 'child_process';
import { Chess } from 'chess.js';
import { calculateDifficulty } from './chess-move-tree';

/**
 * Stockfish analysis result
 */
export interface AnalysisResult {
  score: number; // Centipawns
  mate: number | null; // Mate in N moves (positive for side to move, negative for opponent)
  depth: number;
  nodes: number;
  pv: string; // Principal variation
}

/**
 * Stockfish engine wrapper for position analysis
 */
export class StockfishAnalyzer {
  private process: any = null;
  private ready = false;
  private responseBuffer = '';
  private currentPromise: {
    resolve: (value: AnalysisResult) => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor() {
    this.init();
  }

  /**
   * Initialize Stockfish process
   */
  private init() {
    try {
      this.process = spawn('stockfish', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.process.stdout.on('data', (data: Buffer) => {
        this.handleOutput(data.toString());
      });

      this.process.stderr.on('data', (data: Buffer) => {
        console.error('[Stockfish] Error:', data.toString());
      });

      // Send initialization commands
      this.send('uci');
      this.send('setoption name Threads value 4');
      this.send('setoption name Hash value 512');
      this.ready = true;
    } catch (error) {
      console.error('[Stockfish] Failed to spawn process:', error);
      this.ready = false;
    }
  }

  /**
   * Send command to Stockfish
   */
  private send(command: string) {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(command + '\n');
    }
  }

  /**
   * Handle output from Stockfish
   */
  private handleOutput(data: string) {
    this.responseBuffer += data;

    // Check for "bestmove" which indicates analysis is complete
    if (this.responseBuffer.includes('bestmove')) {
      const result = this.parseAnalysis(this.responseBuffer);
      this.responseBuffer = '';

      if (this.currentPromise) {
        this.currentPromise.resolve(result);
        this.currentPromise = null;
      }
    }
  }

  /**
   * Parse Stockfish output to extract analysis
   */
  private parseAnalysis(output: string): AnalysisResult {
    let score = 0;
    let mate: number | null = null;
    let depth = 0;
    let nodes = 0;
    let pv = '';

    const lines = output.split('\n');
    for (const line of lines) {
      if (line.startsWith('info')) {
        // Parse info line
        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) depth = parseInt(depthMatch[1]);

        const nodesMatch = line.match(/nodes (\d+)/);
        if (nodesMatch) nodes = parseInt(nodesMatch[1]);

        const scoreMatch = line.match(/score (cp|mate) (-?\d+)/);
        if (scoreMatch) {
          if (scoreMatch[1] === 'cp') {
            score = parseInt(scoreMatch[2]);
          } else if (scoreMatch[1] === 'mate') {
            mate = parseInt(scoreMatch[2]);
          }
        }

        const pvMatch = line.match(/pv (.+)$/);
        if (pvMatch) pv = pvMatch[1];
      }
    }

    return { score, mate, depth, nodes, pv };
  }

  /**
   * Analyze a position
   */
  async analyze(fen: string, depth: number = 20): Promise<AnalysisResult> {
    if (!this.ready) {
      throw new Error('Stockfish not ready');
    }

    return new Promise((resolve, reject) => {
      this.currentPromise = { resolve, reject };

      // Set position and start analysis
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);

      // Timeout after 30 seconds
      const timeout = setTimeout(() => {
        this.currentPromise = null;
        reject(new Error('Stockfish analysis timeout'));
      }, 30000);

      // Override resolve to clear timeout
      const originalResolve = resolve;
      this.currentPromise.resolve = (result: AnalysisResult) => {
        clearTimeout(timeout);
        originalResolve(result);
      };
    });
  }

  /**
   * Get best move for a position
   */
  async getBestMove(fen: string, depth: number = 20): Promise<string> {
    const analysis = await this.analyze(fen, depth);
    const moves = analysis.pv.split(' ');
    return moves.length > 0 ? moves[0] : '';
  }

  /**
   * Analyze multiple positions and return evaluations
   */
  async analyzePositions(
    positions: string[],
    depth: number = 20
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const fen of positions) {
      try {
        const result = await this.analyze(fen, depth);
        results.push(result);
      } catch (error) {
        console.error('[Stockfish] Analysis failed:', error);
        results.push({ score: 0, mate: null, depth: 0, nodes: 0, pv: '' });
      }
    }

    return results;
  }

  /**
   * Shutdown Stockfish process
   */
  shutdown() {
    if (this.process) {
      this.send('quit');
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

/**
 * Analyze puzzle moves and calculate difficulty
 */
export async function analyzePuzzleMoves(
  fen: string,
  moves: string[],
  depth: number = 15
): Promise<{ evaluations: number[]; difficulty: number }> {
  const analyzer = new StockfishAnalyzer();
  const evaluations: number[] = [];

  try {
    const game = new Chess(fen);

    // Evaluate position before each move
    for (const move of moves) {
      try {
        const analysis = await analyzer.analyze(game.fen(), depth);
        evaluations.push(analysis.score);

        // Make the move
        const moveResult = game.move(move, { strict: false });;
        if (!moveResult) {
          console.warn(`Invalid move: ${move}`);
          break;
        }
      } catch (error) {
        console.error(`Error analyzing position:`, error);
        break;
      }
    }

    // Calculate difficulty using harmonic mean
    const difficulty = calculateDifficultyFromEvaluations(evaluations);

    return { evaluations, difficulty };
  } finally {
    analyzer.shutdown();
  }
}

/**
 * Calculate difficulty from centipawn evaluations
 */
function calculateDifficultyFromEvaluations(evaluations: number[]): number {
  // Use the existing calculateDifficulty function from chess-move-tree
  return calculateDifficulty(evaluations);
}

/**
 * Singleton instance for global use
 */
let globalAnalyzer: StockfishAnalyzer | null = null;

/**
 * Get or create global analyzer instance
 */
export function getGlobalAnalyzer(): StockfishAnalyzer {
  if (!globalAnalyzer) {
    globalAnalyzer = new StockfishAnalyzer();
  }
  return globalAnalyzer;
}

/**
 * Shutdown global analyzer
 */
export function shutdownGlobalAnalyzer() {
  if (globalAnalyzer) {
    globalAnalyzer.shutdown();
    globalAnalyzer = null;
  }
}
