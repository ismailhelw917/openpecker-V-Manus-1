#!/usr/bin/env python3
import sys
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)
"""
Populate best_moves table using Stockfish analysis.
Only includes puzzles where the best move centipawn loss <= 200 (2.00 pawns).
Processes puzzles in batches from the puzzles table.
"""
import os
import sys
import time
import chess
import chess.engine
import mysql.connector
from urllib.parse import urlparse

# Config
STOCKFISH_PATH = os.path.expanduser("~/stockfish")
DEPTH = 12  # Analysis depth (balance speed vs accuracy)
MAX_CP_LOSS = 100  # 1.00 centipawn loss threshold
BATCH_SIZE = 500  # Puzzles per DB fetch
INSERT_BATCH = 100  # Rows per INSERT
PROGRESS_INTERVAL = 1000  # Log every N puzzles

# Database connection
db_url = os.environ.get("DATABASE_URL", "")
if not db_url:
    # Try reading from file (exported by Node.js)
    try:
        with open("/tmp/db_url.txt", "r") as f:
            db_url = f.read().strip()
    except:
        pass
if not db_url:
    print("ERROR: DATABASE_URL not set and /tmp/db_url.txt not found")
    sys.exit(1)

parsed = urlparse(db_url)
db_config = {
    "host": parsed.hostname or "localhost",
    "port": parsed.port or 3306,
    "user": parsed.username or "root",
    "password": parsed.password or "",
    "database": parsed.path.lstrip("/") if parsed.path else "openpecker",
}
if "ssl" in db_url.lower():
    db_config["ssl_disabled"] = False

print(f"Connecting to {db_config['host']}:{db_config['port']}/{db_config['database']}")
conn = mysql.connector.connect(**db_config)
cursor = conn.cursor(dictionary=True)

# Get count of puzzles not yet in best_moves
cursor.execute("SELECT COUNT(*) as cnt FROM puzzles WHERE id NOT IN (SELECT puzzle_id FROM best_moves)")
remaining = cursor.fetchone()["cnt"]
print(f"Puzzles to analyze: {remaining:,}")

# Initialize Stockfish
print(f"Starting Stockfish at depth {DEPTH}...")
engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
engine.configure({"Threads": 2, "Hash": 128})

total_analyzed = 0
total_inserted = 0
total_skipped = 0
insert_batch = []
start_time = time.time()
last_id = ""

def flush_inserts():
    global insert_batch, total_inserted
    if not insert_batch:
        return
    sql = """INSERT IGNORE INTO best_moves 
        (puzzle_id, fen, best_move, all_moves, centipawn_eval, centipawn_loss, 
         rating, difficulty, opening_name, opening_variation, eco_code, themes, color, is_best_quality)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
    try:
        cursor.executemany(sql, insert_batch)
        conn.commit()
        total_inserted += cursor.rowcount
    except Exception as e:
        print(f"  Insert error: {e}")
        conn.rollback()
    insert_batch = []

def analyze_position(fen, move_san):
    """Analyze a position and return (best_move_uci, eval_cp, cp_loss)"""
    try:
        board = chess.Board(fen)
        
        # Get Stockfish's best move and evaluation
        result = engine.analyse(board, chess.engine.Limit(depth=DEPTH))
        best_score = result["score"].white()
        best_move = result.get("pv", [None])[0]
        
        if best_score.is_mate():
            best_cp = 10000 if best_score.mate() > 0 else -10000
        else:
            best_cp = best_score.score()
        
        # Parse the puzzle's first move
        try:
            puzzle_move = board.parse_san(move_san)
        except (ValueError, chess.InvalidMoveError):
            # Try UCI format
            try:
                puzzle_move = chess.Move.from_uci(move_san)
            except:
                return None, None, None
        
        # If puzzle move IS the best move, cp_loss = 0
        if best_move and puzzle_move == best_move:
            return str(best_move), best_cp, 0
        
        # Otherwise evaluate the puzzle's move
        board.push(puzzle_move)
        after_result = engine.analyse(board, chess.engine.Limit(depth=DEPTH))
        after_score = after_result["score"].white()
        
        if after_score.is_mate():
            after_cp = 10000 if after_score.mate() > 0 else -10000
        else:
            after_cp = after_score.score()
        
        # Centipawn loss = difference (from the side to move's perspective)
        # If white to move: loss = best_cp - (-after_cp) [negate because after push it's black's turn]
        if board.turn == chess.BLACK:  # Was white's move
            cp_loss = best_cp - (-after_cp)
        else:  # Was black's move
            cp_loss = (-best_cp) - after_cp
        
        cp_loss = max(0, cp_loss)  # Loss can't be negative
        
        return str(puzzle_move), best_cp, cp_loss
        
    except Exception as e:
        return None, None, None

print("Starting analysis...")
while True:
    # Fetch batch of puzzles
    cursor.execute("""
        SELECT id, fen, moves, rating, difficulty, openingName, openingVariation, 
               ecoCode, themes, color
        FROM puzzles 
        WHERE id > %s AND id NOT IN (SELECT puzzle_id FROM best_moves)
        ORDER BY id
        LIMIT %s
    """, (last_id, BATCH_SIZE))
    
    rows = cursor.fetchall()
    if not rows:
        break
    
    for row in rows:
        total_analyzed += 1
        last_id = row["id"]
        
        fen = row["fen"]
        moves_str = row["moves"] or ""
        moves = moves_str.strip().split()
        
        if not fen or not moves:
            total_skipped += 1
            continue
        
        # The first move in a Lichess puzzle is the opponent's move (setup)
        # The second move is the puzzle's answer (best move)
        # We analyze the position AFTER the first move
        try:
            board = chess.Board(fen)
            # Apply the setup move (first move)
            if len(moves) >= 2:
                try:
                    setup_move = board.parse_san(moves[0])
                except:
                    try:
                        setup_move = chess.Move.from_uci(moves[0])
                    except:
                        total_skipped += 1
                        continue
                board.push(setup_move)
                puzzle_fen = board.fen()
                puzzle_best_move = moves[1]
            else:
                puzzle_fen = fen
                puzzle_best_move = moves[0]
        except:
            total_skipped += 1
            continue
        
        # Analyze with Stockfish
        best_uci, eval_cp, cp_loss = analyze_position(puzzle_fen, puzzle_best_move)
        
        if best_uci is None:
            total_skipped += 1
            continue
        
        # Filter: only include if centipawn loss <= 200 (2.00 pawns)
        if cp_loss is not None and cp_loss <= MAX_CP_LOSS:
            is_best = cp_loss == 0
            insert_batch.append((
                row["id"], puzzle_fen, best_uci, moves_str,
                eval_cp, cp_loss,
                row["rating"] or 1500, row["difficulty"],
                row["openingName"], row["openingVariation"],
                row["ecoCode"], row["themes"], row["color"],
                is_best
            ))
        else:
            total_skipped += 1
        
        if len(insert_batch) >= INSERT_BATCH:
            flush_inserts()
        
        # Progress
        if total_analyzed % PROGRESS_INTERVAL == 0:
            elapsed = time.time() - start_time
            rate = total_analyzed / elapsed if elapsed > 0 else 0
            print(f"  Analyzed: {total_analyzed:,} | Inserted: {total_inserted:,} | "
                  f"Skipped: {total_skipped:,} | Rate: {rate:.1f}/s | "
                  f"Elapsed: {elapsed:.0f}s | Last ID: {last_id}")

# Flush remaining
flush_inserts()

# Cleanup
engine.quit()
elapsed = time.time() - start_time

print(f"\n=== Best Moves Population Complete ===")
print(f"Total analyzed: {total_analyzed:,}")
print(f"Total inserted (cp_loss <= {MAX_CP_LOSS}): {total_inserted:,}")
print(f"Total skipped: {total_skipped:,}")
print(f"Filter rate: {total_inserted/(total_analyzed or 1)*100:.1f}% passed")
print(f"Total time: {elapsed:.0f}s")
print(f"Rate: {total_analyzed/elapsed:.1f} puzzles/s")

cursor.close()
conn.close()
