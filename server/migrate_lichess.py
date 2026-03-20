#!/usr/bin/env python3
"""Phase 9: Populate puzzles from ChessPuzzleKit (Lichess). 5M puzzles, dedup by FEN, batch 3000."""
import os, sys, time, mysql.connector
from urllib.parse import urlparse
import chesspuzzlekit

chesspuzzlekit.download_db()
chesspuzzlekit.init()

db_url = os.environ.get("DATABASE_URL", "")
if not db_url:
    print("ERROR: DATABASE_URL not set"); sys.exit(1)

parsed = urlparse(db_url)
db_config = {"host": parsed.hostname or "localhost", "port": parsed.port or 3306,
    "user": parsed.username or "root", "password": parsed.password or "",
    "database": parsed.path.lstrip("/") if parsed.path else "openpecker"}
if "ssl" in db_url.lower(): db_config["ssl_disabled"] = False

print(f"Connecting to {db_config['host']}:{db_config['port']}/{db_config['database']}")
conn = mysql.connector.connect(**db_config)
cursor = conn.cursor()

cursor.execute("SELECT id FROM puzzles")
existing_ids = set(row[0] for row in cursor.fetchall())
print(f"Found {len(existing_ids)} existing puzzles")

seen_fens = set()
cursor.execute("SELECT fen FROM puzzles")
for row in cursor.fetchall(): seen_fens.add(row[0])
print(f"Found {len(seen_fens)} existing FENs")

BATCH_SIZE = 3000
batch, total_inserted, total_skipped, total_processed = [], 0, 0, 0
start_time = time.time()

def extract_opening(tags):
    if not tags: return None, None, None
    parts = tags.strip().split(" ")
    eco = None
    if parts and len(parts[0]) <= 3 and parts[0][0].isalpha():
        eco = parts[0]; parts = parts[1:]
    full = " ".join(parts)
    if ":" in full:
        p = full.split(":", 1); return p[0].strip(), p[1].strip(), eco
    return full, None, eco

def flush():
    global batch, total_inserted
    if not batch: return
    sql = "INSERT IGNORE INTO puzzles (id,fen,moves,rating,themes,color,openingName,openingVariation,ecoCode,difficulty,numAttempts,numSolved,createdAt) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,NOW())"
    try:
        cursor.executemany(sql, batch); conn.commit(); total_inserted += cursor.rowcount
    except Exception as e:
        print(f"Batch error: {e}"); conn.rollback()
    batch = []

total_count = chesspuzzlekit.get_count()
print(f"Total puzzles in Lichess DB: {total_count}")
print("Starting migration...")

for i in range(total_count):
    total_processed += 1
    try:
        p = chesspuzzlekit.get_puzzle(i)
        pid = p.get("PuzzleId", f"lichess_{i}")
        fen = p.get("FEN", "")
        if pid in existing_ids or fen in seen_fens: total_skipped += 1; continue
        seen_fens.add(fen)
        moves = p.get("Moves", "")
        rating = int(p.get("Rating", 1500))
        themes = p.get("Themes", "")
        fen_parts = fen.split(" ")
        color = "black" if len(fen_parts) > 1 and fen_parts[1] == "w" else "white"
        on, ov, eco = extract_opening(p.get("OpeningTags", ""))
        batch.append((pid, fen, moves, rating, themes, color, on, ov, eco, rating))
        if len(batch) >= BATCH_SIZE: flush()
    except Exception as e:
        if total_processed % 100000 == 0: print(f"Error at {i}: {e}")
    if total_processed % 50000 == 0:
        el = time.time() - start_time
        print(f"Processed: {total_processed:,} | Inserted: {total_inserted:,} | Skipped: {total_skipped:,} | {total_processed/el:.0f}/s | {el:.0f}s")

flush()
el = time.time() - start_time
print(f"\n=== Done === Processed: {total_processed:,} | Inserted: {total_inserted:,} | Skipped: {total_skipped:,} | {el:.0f}s")
cursor.close(); conn.close()
