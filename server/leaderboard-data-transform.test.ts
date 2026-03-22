import { describe, it, expect } from 'vitest';

describe('Leaderboard Data Transformation', () => {
  // Simulate the transformation logic from routers.ts
  const transformLeaderboardEntry = (e: any) => {
    const totalTimeMs = Number(e.totalTimeMs) || 0;
    const totalPuzzles = Number(e.totalPuzzles) || 0;
    const completedCycles = Number(e.completedCycles) || 0;
    const totalCorrect = Number(e.totalCorrect) || 0;
    const accuracy = Number(e.accuracy) || 0;
    const rating = Number(e.rating) || 1200;
    
    const speed = totalPuzzles > 0 ? Math.round((totalTimeMs / totalPuzzles) / 1000) : 0;
    const totalTimeMin = Math.round(totalTimeMs / 1000 / 60);
    
    return {
      ...e,
      totalPuzzles,
      completedCycles,
      totalCorrect,
      accuracy: Math.round(accuracy * 100) / 100,
      rating,
      speed,
      totalTimeMin,
    };
  };

  it('should calculate speed correctly from totalTimeMs and totalPuzzles', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      totalTimeMs: 300000, // 5 minutes
      totalPuzzles: 10,
      completedCycles: 1,
      totalCorrect: 8,
      accuracy: 80,
      rating: 1500,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.speed).toBe(30); // 300000ms / 10 puzzles / 1000 = 30 seconds
  });

  it('should calculate totalTimeMin correctly from totalTimeMs', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      totalTimeMs: 600000, // 10 minutes
      totalPuzzles: 20,
      completedCycles: 2,
      totalCorrect: 18,
      accuracy: 90,
      rating: 1600,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.totalTimeMin).toBe(10); // 600000ms / 1000 / 60 = 10 minutes
  });

  it('should handle zero puzzles without division by zero', () => {
    const entry = {
      id: '1',
      name: 'New Player',
      totalTimeMs: 0,
      totalPuzzles: 0,
      completedCycles: 0,
      totalCorrect: 0,
      accuracy: 0,
      rating: 1200,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.speed).toBe(0);
    expect(result.totalTimeMin).toBe(0);
  });

  it('should preserve all original fields while adding calculated ones', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      email: 'test@example.com',
      type: 'registered',
      isPremium: false,
      totalTimeMs: 120000,
      totalPuzzles: 5,
      completedCycles: 1,
      totalCorrect: 4,
      accuracy: 80,
      rating: 1400,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.id).toBe('1');
    expect(result.name).toBe('Test Player');
    expect(result.email).toBe('test@example.com');
    expect(result.type).toBe('registered');
    expect(result.isPremium).toBe(false);
  });

  it('should round accuracy to 2 decimal places', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      totalTimeMs: 100000,
      totalPuzzles: 3,
      completedCycles: 1,
      totalCorrect: 2,
      accuracy: 66.66666,
      rating: 1300,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.accuracy).toBe(66.67);
  });

  it('should use default rating of 1200 if not provided', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      totalTimeMs: 100000,
      totalPuzzles: 5,
      completedCycles: 1,
      totalCorrect: 4,
      accuracy: 80,
      rating: null,
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.rating).toBe(1200);
  });

  it('should handle string values by converting to numbers', () => {
    const entry = {
      id: '1',
      name: 'Test Player',
      totalTimeMs: '240000',
      totalPuzzles: '8',
      completedCycles: '2',
      totalCorrect: '6',
      accuracy: '75',
      rating: '1450',
    };
    
    const result = transformLeaderboardEntry(entry);
    expect(result.totalTimeMin).toBe(4); // 240000ms / 1000 / 60 = 4 minutes
    expect(result.speed).toBe(30); // 240000ms / 8 puzzles / 1000 = 30 seconds
    expect(result.totalPuzzles).toBe(8);
    expect(result.completedCycles).toBe(2);
    expect(result.accuracy).toBe(75);
    expect(result.rating).toBe(1450);
  });
});
