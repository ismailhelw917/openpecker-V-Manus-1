import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import { 
  createTrainingSet, 
  createCycleRecord, 
  recordPuzzleAttempt,
  getCycleHistoryByUser,
  getPuzzleAttemptsByUser,
  getPuzzleAttemptStats
} from './db';

describe('Stats Aggregation', () => {
  const testUserId = 999;
  const testDeviceId = 'test-device-123';
  const trainingSetId = nanoid();

  it('should record puzzle attempts and calculate stats correctly', async () => {
    // Record puzzle attempts
    await recordPuzzleAttempt({
      userId: testUserId,
      deviceId: testDeviceId,
      trainingSetId,
      cycleNumber: 1,
      puzzleId: 'p1',
      isCorrect: 1,
      timeMs: 5000,
      moves: ['e2e4'],
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    });

    await recordPuzzleAttempt({
      userId: testUserId,
      deviceId: testDeviceId,
      trainingSetId,
      cycleNumber: 1,
      puzzleId: 'p2',
      isCorrect: 1,
      timeMs: 4000,
      moves: ['e2e4'],
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    });

    // Get stats
    const stats = await getPuzzleAttemptStats(testUserId, testDeviceId);
    
    expect(stats.totalPuzzles).toBeGreaterThanOrEqual(2);
    expect(stats.totalCorrect).toBeGreaterThanOrEqual(2);
    expect(stats.totalTimeMs).toBeGreaterThanOrEqual(9000);
  });

  it('should retrieve cycle history for user', async () => {
    // Create a cycle record
    await createCycleRecord({
      userId: testUserId,
      deviceId: testDeviceId,
      trainingSetId,
      cycleNumber: 1,
      correctCount: 45,
      totalPuzzles: 50,
      accuracy: '90',
      timeMs: 300000
    });

    // Get cycle history
    const cycles = await getCycleHistoryByUser(testUserId, testDeviceId);
    
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0].cycleNumber).toBe(1);
    expect(cycles[0].accuracy).toMatch(/^90(\.0+)?$/);
  });

  it('should calculate accuracy percentage correctly', async () => {
    const stats = await getPuzzleAttemptStats(testUserId, testDeviceId);
    
    if (stats.totalPuzzles > 0) {
      const accuracy = (stats.totalCorrect / stats.totalPuzzles) * 100;
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
      expect(stats.totalCorrect).toBeLessThanOrEqual(stats.totalPuzzles);
    }
  });

  it('should calculate average time per puzzle', async () => {
    const stats = await getPuzzleAttemptStats(testUserId, testDeviceId);
    
    if (stats.totalPuzzles > 0) {
      const avgTimeMs = stats.totalTimeMs / stats.totalPuzzles;
      expect(avgTimeMs).toBeGreaterThan(0);
      expect(stats.totalTimeMs).toBeGreaterThan(0);
    }
  });
});
