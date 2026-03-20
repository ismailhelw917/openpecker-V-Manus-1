import { spawn } from 'child_process';
import { Chess } from 'chess.js';

interface StockfishProcess {
  process: ReturnType<typeof spawn> | null;
  isReady: boolean;
}

let stockfishInstance: StockfishProcess = {
  process: null,
  isReady: false,
};

/**
 * Initialize Stockfish engine
 */
function initStockfish(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (stockfishInstance.isReady && stockfishInstance.process) {
      resolve();
      return;
    }

    try {
      const process = spawn('stockfish');
      stockfishInstance.process = process;

      let output = '';
      process.stdout?.on('data', (data) => {
        output += data.toString();
        if (output.includes('Stockfish')) {
          stockfishInstance.isReady = true;
          resolve();
        }
      });

      process.stderr?.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start Stockfish: ${error.message}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!stockfishInstance.isReady) {
          reject(new Error('Stockfish initialization timeout'));
        }
      }, 5000);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send command to Stockfish and get response
 */
function sendCommand(command: string, timeout: number = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stockfishInstance.process) {
      reject(new Error('Stockfish not initialized'));
      return;
    }

    let output = '';
    const timeoutId = setTimeout(() => {
      reject(new Error('Stockfish command timeout'));
    }, timeout);

    const onData = (data: Buffer) => {
      output += data.toString();
      
      // Check if we have a complete response
      if (output.includes('bestmove') || output.includes('info')) {
        clearTimeout(timeoutId);
        stockfishInstance.process?.stdout?.removeListener('data', onData);
        resolve(output);
      }
    };

    stockfishInstance.process.stdout?.on('data', onData);
    stockfishInstance.process.stdin?.write(command + '\n');
  });
}

/**
 * Get best move for a given position
 * @param fen - Chess position in FEN notation
 * @param depth - Search depth (1-20, default 15)
 * @returns Best move in UCI format
 */
export async function getBestMove(fen: string, depth: number = 15): Promise<string> {
  try {
    // Validate FEN
    const game = new Chess(fen);
    if (!game.fen()) {
      throw new Error('Invalid FEN position');
    }

    await initStockfish();

    // Set position and get best move
    await sendCommand('position fen ' + fen);
    const response = await sendCommand(`go depth ${Math.min(depth, 20)}`, 10000);

    // Parse bestmove from response
    const match = response.match(/bestmove\s+(\S+)/);
    if (!match || !match[1]) {
      throw new Error('No best move found');
    }

    return match[1];
  } catch (error) {
    console.error('Stockfish error:', error);
    throw new Error(`Failed to get best move: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Verify if a move is the best move
 * @param fen - Chess position in FEN notation
 * @param moveUCI - Move in UCI format (e.g., "e2e4")
 * @param depth - Search depth for verification
 * @returns Whether the move is the best move
 */
export async function verifyBestMove(
  fen: string,
  moveUCI: string,
  depth: number = 15
): Promise<{
  isBestMove: boolean;
  bestMove: string;
}> {
  try {
    // Validate FEN and move
    const game = new Chess(fen);
    if (!game.fen()) {
      throw new Error('Invalid FEN position');
    }

    // Verify move is legal
    const from = moveUCI.substring(0, 2);
    const to = moveUCI.substring(2, 4);
    const promotion = moveUCI.length > 4 ? moveUCI[4] : undefined;
    
    const moveObj = game.move({ from, to, promotion });
    if (!moveObj) {
      throw new Error('Illegal move');
    }

    // Get best move
    const bestMove = await getBestMove(fen, depth);

    return {
      isBestMove: moveUCI === bestMove,
      bestMove,
    };
  } catch (error) {
    console.error('Stockfish verification error:', error);
    throw new Error(`Failed to verify move: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Cleanup Stockfish instance
 */
export function closeStockfish(): void {
  if (stockfishInstance.process) {
    stockfishInstance.process.stdin?.write('quit\n');
    stockfishInstance.process.kill();
    stockfishInstance.process = null;
    stockfishInstance.isReady = false;
  }
}
