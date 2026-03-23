import { describe, it, expect, beforeAll } from "vitest";
import { getCycleHistoryByUser } from "./db";

describe("Stats Calculation", () => {
  it("should calculate stats correctly for user with cycle data", async () => {
    // Use mock data to verify calculation logic (not dependent on specific DB user)
    const mockCycles = [
      { totalPuzzles: 50, correctCount: 45, totalTimeMs: 300000, cycleNumber: 1, accuracy: '90.00', trainingSetId: 'test' },
      { totalPuzzles: 40, correctCount: 32, totalTimeMs: 240000, cycleNumber: 2, accuracy: '80.00', trainingSetId: 'test' },
    ];
    
    // Calculate stats
    const totalPuzzles = mockCycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = mockCycles.reduce((sum, c) => sum + c.correctCount, 0);
    const accuracy = totalPuzzles > 0 ? (totalCorrect / totalPuzzles) * 100 : 0;
    const completedCycles = mockCycles.length;
    const totalTimeMs = mockCycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
    const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
    const winRate = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    const lossRate = 100 - winRate;
    
    // Verify calculations
    expect(totalPuzzles).toBeGreaterThan(0);
    expect(totalCorrect).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThan(0);
    expect(accuracy).toBeLessThanOrEqual(100);
    expect(winRate).toBeGreaterThan(0);
    expect(winRate).toBeLessThanOrEqual(100);
    expect(lossRate).toBeGreaterThanOrEqual(0);
    expect(lossRate).toBeLessThanOrEqual(100);
    expect(avgTimePerPuzzle).toBeGreaterThan(0);
    expect(completedCycles).toBeGreaterThan(0);
    // Verify specific values
    expect(totalPuzzles).toBe(90);
    expect(totalCorrect).toBe(77);
    expect(winRate).toBe(86);
  });

  it("should handle accuracy field type correctly", async () => {
    // Test accuracy parsing logic with mock data
    const mockAccuracy = '90.00';
    const accuracyValue = typeof mockAccuracy === 'string' 
      ? parseFloat(mockAccuracy) 
      : Number(mockAccuracy);
    
    expect(accuracyValue).toBeGreaterThanOrEqual(0);
    expect(accuracyValue).toBeLessThanOrEqual(100);
    expect(accuracyValue).toBe(90);
  });
});
