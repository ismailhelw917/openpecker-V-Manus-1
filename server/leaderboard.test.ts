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
function makeDb(rows: { registered?: any[]; guest?: any[]; activePlayers?: any[]; totalPlayers?: any[]; totalPuzzles?: any[] }) {
  return {
    execute: vi.fn((query: any) => {
      // Stringify the query chunks to inspect which query is being run
      const chunks: any[] = query?.queryChunks ?? [];
      const q = chunks.map((c: any) => (typeof c === 'string' ? c : c?.value ?? '')).join('');

      // Registered users query: joins users + puzzle_attempts + cycle_history
      if (q.includes('users') && q.includes('puzzle_attempts') && q.includes('cycle_history')) {
        return Promise.resolve(rows.registered ?? []);
      }
      // Guest query: puzzle_attempts where deviceId IS NOT NULL
      if (q.includes('puzzle_attempts') && q.includes('deviceId IS NOT NULL')) {
        return Promise.resolve(rows.guest ?? []);
      }
      // Summary – active players
      if (q.includes('activePlayers') || (q.includes('COALESCE') && q.includes('puzzle_attempts'))) {
        return Promise.resolve(rows.activePlayers ?? [{ activePlayers: 0 }]);
      }
      // Summary – total players
      if (q.includes('totalPlayers')) {
        return Promise.resolve(rows.totalPlayers ?? [{ totalPlayers: 0 }]);
      }
      // Summary – total puzzles solved
      if (q.includes('totalPuzzles') && q.includes('isCorrect')) {
        return Promise.resolve(rows.totalPuzzles ?? [{ totalPuzzles: 0 }]);
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

  it('returns registered players sorted by puzzles solved descending', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      registered: [
        { playerId: 1, playerName: 'Alice', totalPuzzles: 200, accuracy: 90, rating: 1200, totalMinutes: 60, joinDate: '2025-01-01' },
        { playerId: 2, playerName: 'Bob',   totalPuzzles: 150, accuracy: 80, rating: 1200, totalMinutes: 45, joinDate: '2025-01-02' },
      ],
      guest: [],
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
      registered: [],
      guest: [
        { playerId: 'guest_abc123', playerName: 'Guest-abc123', totalPuzzles: 50, accuracy: 70, rating: 1200, totalMinutes: 20, joinDate: '2025-03-01' },
      ],
    }) as any);

    const result = await getTopPlayersByMetricOptimized(10);

    expect(result).toHaveLength(1);
    expect(result[0].playerName).toBe('Guest-abc123');
    expect(result[0].puzzlesSolved).toBe(50);
  });

  it('merges registered and guest players and ranks them together', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      registered: [
        { playerId: 1, playerName: 'Alice', totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30, joinDate: '2025-01-01' },
      ],
      guest: [
        { playerId: 'guest_xyz', playerName: 'Guest-xyz', totalPuzzles: 200, accuracy: 75, rating: 1200, totalMinutes: 50, joinDate: '2025-02-01' },
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
      registered: [
        { playerId: 1, playerName: 'Alice', totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30, joinDate: '2025-01-01' },
      ],
      guest: [],
    });
    vi.mocked(getDb).mockResolvedValue(mockDb as any);

    const first  = await getTopPlayersByMetricOptimized(10);
    const second = await getTopPlayersByMetricOptimized(10);

    // Results should be identical (same reference from cache)
    expect(first).toEqual(second);
    // DB execute should only be called for the first invocation (2 queries: registered + guest)
    // The second call returns the cached value without any DB queries
    const executeCalls = (mockDb.execute as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(executeCalls).toBe(2); // registered query + guest query, only on first call
  });

  it('invalidateLeaderboardCache clears cache so next call hits DB', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      registered: [
        { playerId: 1, playerName: 'Alice', totalPuzzles: 100, accuracy: 90, rating: 1200, totalMinutes: 30, joinDate: '2025-01-01' },
      ],
      guest: [],
    }) as any);

    await getTopPlayersByMetricOptimized(10);
    invalidateLeaderboardCache();
    await getTopPlayersByMetricOptimized(10);

    expect(getDb).toHaveBeenCalledTimes(2);
  });

  it('respects the limit parameter', async () => {
    const manyPlayers = Array.from({ length: 20 }, (_, i) => ({
      playerId: i + 1,
      playerName: `Player${i + 1}`,
      totalPuzzles: 200 - i * 5,
      accuracy: 80,
      rating: 1200,
      totalMinutes: 30,
      joinDate: '2025-01-01',
    }));

    vi.mocked(getDb).mockResolvedValue(makeDb({ registered: manyPlayers, guest: [] }) as any);

    const result = await getTopPlayersByMetricOptimized(5);
    expect(result).toHaveLength(5);
  });

  it('getLeaderboardSummary returns correct counts', async () => {
    vi.mocked(getDb).mockResolvedValue(makeDb({
      activePlayers: [{ activePlayers: 42 }],
      totalPlayers:  [{ totalPlayers: 100 }],
      totalPuzzles:  [{ totalPuzzles: 5000 }],
    }) as any);

    const summary = await getLeaderboardSummary();

    expect(summary.activePlayers).toBe(42);
    expect(summary.totalPlayers).toBe(100);
    expect(summary.totalPuzzlesSolvedGlobally).toBe(5000);
  });
});
