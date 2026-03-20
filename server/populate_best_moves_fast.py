#!/usr/bin/env python3
"""
Optimized Stockfish analysis for best_moves table using multiprocessing.
Filter: centipawn loss >= 200 (2.00 minimum, no maximum).
Each worker gets its own Stockfish subprocess - no asyncio conflicts.
"""
import sys, os, time, signal
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

import chess
import chess.engine
import mysql.connector
from urllib.parse import urlparse
from multiprocessing import Process, Queue, Value
import ctypes

# === CONFIG ===
STOCKFISH_PATH = os.path.expanduser("~/stockfish")
DEPTH = 8
MIN_CP_LOSS = 200        # 2.00 centipawn loss MINIMUM, no maximum
NUM_WORKERS = 4           # 4 separate processes, each with own Stockfish
FETCH_BATCH = 5000        # Puzzles per DB fetch
INSERT_BATCH = 500        # Rows per DB insert
PROGRESS_INTERVAL = 2000  # Log every N puzzles

# === DATABASE ===
db_url = os.environ.get("DATABASE_URL", "")
if not db_url:
    print("ERROR: DATABASE_URL not set")
    sys.exit(1)

parsed = urlparse(db_url)
db_config = {
    "host": parsed.hostname or "localhost",
    "port": parsed.port or 3306,
    "user": parsed.username or "root",
    "password": parsed.password or "",
    "database": parsed.path.lstrip("/") if parsed.path else "openpecker",
}
if parsed.query and "ssl" in parsed.query.lower():
    db_config["ssl_disabled"] = False

def get_db_conn():
    return mysql.connector.connect(**db_config)

def analyze_puzzle(engine, fen, moves_str):
    """Analyze a single puzzle. Returns result dict or None."""
    moves = moves_str.strip().split()
    if not fen or len(moves) < 2:
        return None
    try:
        board = chess.Board(fen)
        try:
            setup_move = board.parse_san(moves[0])
        except (ValueError, chess.InvalidMoveError):
            try:
                setup_move = chess.Move.from_uci(moves[0])
            except:
                return None
        board.push(setup_move)
        puzzle_fen = board.fen()

        result = engine.analyse(board, chess.engine.Limit(depth=DEPTH))
        best_score = result["score"].white()
        best_pv = result.get("pv", [])
        best_move = best_pv[0] if best_pv else None
        if best_score.is_mate():
            best_cp = 10000 if best_score.mate() > 0 else -10000
        else:
            best_cp = best_score.score()

        puzzle_move_san = moves[1]
        try:
            puzzle_move = board.parse_san(puzzle_move_san)
        except (ValueError, chess.InvalidMoveError):
            try:
                puzzle_move = chess.Move.from_uci(puzzle_move_san)
            except:
                return None

        if best_move and puzzle_move == best_move:
            return {"fen": puzzle_fen, "best_move": str(best_move), "eval_cp": best_cp, "cp_loss": 0}

        board_copy = board.copy()
        board_copy.push(puzzle_move)
        after_result = engine.analyse(board_copy, chess.engine.Limit(depth=DEPTH))
        after_score = after_result["score"].white()
        if after_score.is_mate():
            after_cp = 10000 if after_score.mate() > 0 else -10000
        else:
            after_cp = after_score.score()

        side_to_move = board.turn
        if side_to_move == chess.WHITE:
            cp_loss = best_cp - (-after_cp)
        else:
            cp_loss = (-best_cp) - after_cp
        cp_loss = max(0, cp_loss)
        return {"fen": puzzle_fen, "best_move": str(puzzle_move), "eval_cp": best_cp, "cp_loss": cp_loss}
    except Exception:
        return None


def worker_process(worker_id, task_queue, analyzed_count, inserted_count, db_url_str):
    """Each worker has its own Stockfish engine and DB connection."""
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    os.environ["DATABASE_URL"] = db_url_str

    print(f"  Worker {worker_id}: Starting Stockfish engine (depth={DEPTH})...", flush=True)
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    engine.configure({"Threads": 1, "Hash": 32})

    conn = get_db_conn()
    cursor = conn.cursor()

    insert_buffer = []
    local_analyzed = 0
    local_inserted = 0

    print(f"  Worker {worker_id}: Ready!", flush=True)

    while True:
        try:
            batch = task_queue.get(timeout=10)
        except:
            break
        if batch is None:
            break

        for row in batch:
            result = analyze_puzzle(engine, row["fen"], row["moves"] or "")
            local_analyzed += 1

            if result is None:
                continue

            cp_loss = result["cp_loss"]
            if cp_loss >= MIN_CP_LOSS:
                insert_buffer.append((
                    row["id"], result["fen"], result["best_move"], row["moves"] or "",
                    result["eval_cp"], cp_loss,
                    row["rating"] or 1500, row.get("difficulty"),
                    row.get("openingName"), row.get("openingVariation"),
                    row.get("ecoCode"), row.get("themes"), row.get("color"),
                    False
                ))
                local_inserted += 1

            if len(insert_buffer) >= INSERT_BATCH:
                try:
                    sql = """INSERT IGNORE INTO best_moves
                        (puzzle_id, fen, best_move, all_moves, centipawn_eval, centipawn_loss,
                         rating, difficulty, opening_name, opening_variation, eco_code, themes, color, is_best_quality)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
                    cursor.executemany(sql, insert_buffer)
                    conn.commit()
                except Exception as e:
                    print(f"  Worker {worker_id} INSERT ERROR: {e}", flush=True)
                    conn.rollback()
                insert_buffer = []

        with analyzed_count.get_lock():
            analyzed_count.value += local_analyzed
        with inserted_count.get_lock():
            inserted_count.value += local_inserted
        local_analyzed = 0
        local_inserted = 0

    if insert_buffer:
        try:
            sql = """INSERT IGNORE INTO best_moves
                (puzzle_id, fen, best_move, all_moves, centipawn_eval, centipawn_loss,
                 rating, difficulty, opening_name, opening_variation, eco_code, themes, color, is_best_quality)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
            cursor.executemany(sql, insert_buffer)
            conn.commit()
        except Exception as e:
            print(f"  Worker {worker_id} FINAL INSERT ERROR: {e}", flush=True)

    with analyzed_count.get_lock():
        analyzed_count.value += local_analyzed
    with inserted_count.get_lock():
        inserted_count.value += local_inserted

    engine.quit()
    cursor.close()
    conn.close()
    print(f"  Worker {worker_id}: Done.", flush=True)


def main():
    print(f"=== Optimized Best Moves Migration (Multiprocessing) ===")
    print(f"Filter: centipawn loss >= {MIN_CP_LOSS} (2.00 minimum, no maximum)")
    print(f"Workers: {NUM_WORKERS} | Depth: {DEPTH} | Fetch batch: {FETCH_BATCH}")

    conn = get_db_conn()
    cursor = conn.cursor(dictionary=True)

    cursor.execute("SELECT COUNT(*) as cnt FROM best_moves")
    already_done = cursor.fetchone()["cnt"]
    print(f"Already in best_moves: {already_done:,}")

    cursor.execute("SELECT COUNT(*) as cnt FROM puzzles")
    total_puzzles = cursor.fetchone()["cnt"]
    print(f"Total puzzles: {total_puzzles:,}")

    analyzed_count = Value(ctypes.c_long, 0)
    inserted_count = Value(ctypes.c_long, 0)
    task_queue = Queue(maxsize=NUM_WORKERS * 3)

    print(f"\nStarting {NUM_WORKERS} worker processes...")
    workers = []
    for i in range(NUM_WORKERS):
        p = Process(target=worker_process, args=(i, task_queue, analyzed_count, inserted_count, db_url))
        p.start()
        workers.append(p)

    time.sleep(5)

    print(f"\nFetching and distributing puzzles...")
    print(f"{'='*70}")

    start_time = time.time()
    last_id = ""
    total_fetched = 0
    last_log_time = 0

    while True:
        cursor.execute("""
            SELECT id, fen, moves, rating, difficulty, openingName, openingVariation,
                   ecoCode, themes, color
            FROM puzzles
            WHERE id > %s
            ORDER BY id
            LIMIT %s
        """, (last_id, FETCH_BATCH))

        rows = cursor.fetchall()
        if not rows:
            break

        last_id = rows[-1]["id"]
        total_fetched += len(rows)

        chunk_size = max(1, len(rows) // NUM_WORKERS)
        chunks = [rows[i:i+chunk_size] for i in range(0, len(rows), chunk_size)]
        for chunk in chunks:
            task_queue.put(chunk)

        now = time.time()
        if now - last_log_time >= 15:
            current_analyzed = analyzed_count.value
            elapsed = now - start_time
            rate = current_analyzed / elapsed if elapsed > 0 else 0
            current_inserted = inserted_count.value
            remaining = total_puzzles - current_analyzed
            eta_seconds = remaining / rate if rate > 0 else 0
            eta_hours = eta_seconds / 3600
            pct = (current_analyzed / total_puzzles) * 100
            pass_rate = (current_inserted / current_analyzed * 100) if current_analyzed > 0 else 0
            print(f"  [{pct:5.1f}%] Analyzed: {current_analyzed:>9,} / {total_puzzles:,} | "
                  f"Inserted(>=200cp): {current_inserted:>7,} ({pass_rate:.1f}%) | "
                  f"Rate: {rate:>6.1f}/s | ETA: {eta_hours:.1f}h")
            last_log_time = now

    for _ in range(NUM_WORKERS):
        task_queue.put(None)

    print(f"\nAll puzzles distributed ({total_fetched:,}). Waiting for workers to finish...")

    while any(p.is_alive() for p in workers):
        time.sleep(10)
        current_analyzed = analyzed_count.value
        current_inserted = inserted_count.value
        elapsed = time.time() - start_time
        rate = current_analyzed / elapsed if elapsed > 0 else 0
        pct = (current_analyzed / total_puzzles) * 100
        remaining = total_puzzles - current_analyzed
        eta_seconds = remaining / rate if rate > 0 else 0
        eta_hours = eta_seconds / 3600
        pass_rate = (current_inserted / current_analyzed * 100) if current_analyzed > 0 else 0
        print(f"  [{pct:5.1f}%] Analyzed: {current_analyzed:>9,} / {total_puzzles:,} | "
              f"Inserted(>=200cp): {current_inserted:>7,} ({pass_rate:.1f}%) | "
              f"Rate: {rate:>6.1f}/s | ETA: {eta_hours:.1f}h")

    for p in workers:
        p.join()

    elapsed = time.time() - start_time
    final_analyzed = analyzed_count.value
    final_inserted = inserted_count.value

    print(f"\n{'='*70}")
    print(f"=== MIGRATION COMPLETE ===")
    print(f"Total analyzed:  {final_analyzed:,}")
    print(f"Total inserted (cp_loss >= {MIN_CP_LOSS}): {final_inserted:,}")
    print(f"Total filtered (cp_loss < {MIN_CP_LOSS}): {final_analyzed - final_inserted:,}")
    print(f"Pass rate: {final_inserted/(final_analyzed or 1)*100:.1f}%")
    print(f"Total time: {elapsed/3600:.1f} hours ({elapsed:.0f}s)")
    print(f"Avg rate: {final_analyzed/elapsed:.1f} puzzles/s")

    cursor.close()
    conn.close()


if __name__ == "__main__":
    main()
