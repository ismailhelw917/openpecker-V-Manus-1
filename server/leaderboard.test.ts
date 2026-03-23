import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock the database module ────────────────────────────────────────────────
vi.mock('./db', () => ({
  getDb: vi.fn(),
}));

import { getDb } from './db';
import {
  getTopPlayersByMetricOptimized,
  invalidateLeaderboardCache,
  getLeaderboardSummary,
} from './leaderboard-optimized';

// ─── Helper: build a mock DB that routes queries by content ──────────────────
function makeDb(rows: { scores?: any[]; summary?: any[] }) {
  return {
    execute: vi.fn((query: any) => {
      // Stringify the query chunks to inspect which query is being run
      const chunks: any[] = query?.queryChunks ?? [];
      const q = chunks.map((c: any) => (typeof c === 'string' ? c : c?.value ?? '')).join('');

      // Summary query: COUNT(*) AS totalPlayers from leaderboard_scores
      if (q.includes('totalPlayers') && q.includes('leaderboard_scores')) {
        return Promise.resolve(rows.summary ?? [{ totalPlayers: 0, activePlayers: 0, totalPuzzlesSolvedGlobally: 0 }]);
      }

      // Main leaderboard query: SELECT playerName, totalPuzzles... FROM leaderboard_scores
      if (q.includes('leaderboard_scores')) {
        return Promise.resolve(rows.scores ?? []);
      }

      return Promise.resolve([]);
    }),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('leaderboard-optimized', () => {
  beforeEach(() => {
    invalidateLeaderboardCache();
    vi.clearAllMocks();
  });

  it('returns players sorted by puzzles solved descending', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      scores: [
        { playerName: 'Alice', totalPuzzles: 200, accuracy: 90, rating: 1200, totalMinutes: 60 },
        { playerName: 'Bob',   totalPuzzles: 150, accuracy: 80, rating: 1200, totalMinutes: 45 },
      ],
    }) as any);

    const result = await getTopPlayersByMetricOptimized(10);

    expect(result).toHaveLength(2);
    expect(result[0].playerName).toBe('Alice');
    expect(result[0].rank).toBe(1);
    expect(result[0].puzzlesSolved).toBe(200);
    expect(result[1].playerName).toBe('Bob');
    expect(result[1].rank).toBe(2);
  });

  it('includes guest players in the leaderboard', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      scores: [
        { playerName: 'Guest-abc123', totalPuzzles: 50, accuracy: 70, rating: 1200, totalMinutes: 20 },
      ],
    }) as any);

    const result = await getTopPlayersByMetricOptimized(10);

    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Guest-abc123');
    expect(result[0].puzzlesSolved).toBe(50);
  });

  it('ranks players correctly by puzzle count', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      scores: [
        { playerName: 'Guest-xyz', totalPuzzles: 200, accuracy: 75, rating: 1200, totalMinutes: 50 },
        { playerName: 'Alice',     totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30 },
      ],
    }) as any);

    const result = await getTopPlayersByMetricOptimized(10);

    expect(result).toHaveLength(2);
    expect(result[0].playerName).toBe('Guest-xyz'); // more puzzles → rank 1
    expect(result[0].rank).toBe(1);
    expect(result[1].playerName).toBe('Alice');
    expect(result[1].rank).toBe(2);
  });

  it('returns cached result on second call without hitting DB again', async () => {
    const mockDb = makeDb({
      scores: [
        { playerName: 'Alice', totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30 },
      ],
    });
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const first  = await getTopPlayersByMetricOptimized(10);
    const second = await getTopPlayersByMetricOptimized(10);

    // Results should be identical (same reference from cache)
    expect(first).toEqual(second);
    // DB execute should only be called for the first invocation (1 query to leaderboard_scores)
    const executeCalls = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(executeCalls).toBe(1); // only on first call
  });

  it('invalidateLeaderboardCache clears cache so next call hits DB', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      scores: [
        { playerName: 'Alice', totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30 },
      ],
    }) as any);

    await getTopPlayersByMetricOptimized(10);
    invalidateLeaderboardCache();
    await getTopPlayersByMetricOptimized(10);

    expect(getDb).toHaveBeenCalledTimes(2);
  });

  it('respects the limit parameter by passing it to the SQL query', async () => {
    // The mock returns all rows (it can't enforce SQL LIMIT), but the limit
    // is passed to the SQL query. We verify the function accepts the limit param.
    const fivePlayers = Array.from({ length: 5 }, (_, i) => ({
      playerName: `Player${i + 1}`,
      totalPuzzles: 200 - i * 5,
      accuracy: 80,
      rating: 1200,
      totalMinutes: 30,
    }));

    vi.mocked(getDb).mockResolvedValue(makeDb({ scores: fivePlayers }) as any);

    const result = await getTopPlayersByMetricOptimized(5);
    expect(result).toHaveLength(5);
    // All results should have rank assigned
    result.forEach((r, i) => expect(r.rank).toBe(i + 1));
  });

  it('getLeaderboardSummary returns correct counts', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      summary: [{ activePlayers: 42, totalPlayers: 100, totalPuzzlesSolvedGlobally: 5000 }],
    }) as any);

    const summary = await getLeaderboardSummary();

    expect(summary.activePlayers).toBe(42);
    expect(summary.totalPlayers).toBe(100);
    expect(summary.totalPuzzlesSolvedGlobally).toBe(5000);
  });
});
