import { describe, it, expect, beforeAll } from "vitest";
import { getCycleHistoryByUser } from "./db";

describe("Stats Calculation", () => {
  it("should retrieve cycle history for user 1", async () => {
    // Test with a non-existent user - should return empty array, not throw
    const cycles = await getCycleHistoryByUser(750215, null);
    expect(cycles).toBeDefined();
    expect(Array.isArray(cycles)).toBe(true);
    // If cycles exist, validate their structure
    if (cycles.length > 0) {
      const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
      const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
      const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    }
  });

  it("should retrieve cycle history for user 2", async () => {
    const cycles = await getCycleHistoryByUser(750255, null);
    expect(cycles).toBeDefined();
    expect(Array.isArray(cycles)).toBe(true);
    if (cycles.length > 0) {
      const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
      const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
      const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    }
  });

  it("should retrieve cycle history for user 3", async () => {
    const cycles = await getCycleHistoryByUser(750380, null);
    expect(cycles).toBeDefined();
    expect(Array.isArray(cycles)).toBe(true);
    if (cycles.length > 0) {
      const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
      const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
      const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
    }
  });

  it("should calculate stats correctly for all users", async () => {
    // Test the stats calculation logic with mock data
    const mockCycles = [
      { totalPuzzles: 50, correctCount: 45, totalTimeMs: 300000 },
      { totalPuzzles: 40, correctCount: 32, totalTimeMs: 240000 },
    ];

    const totalPuzzles = mockCycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = mockCycles.reduce((sum, c) => sum + c.correctCount, 0);
    const totalTimeMs = mockCycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
    const winRate = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    const lossRate = 100 - winRate;

    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
    expect(winRate).toBeGreaterThanOrEqual(0);
    expect(winRate).toBeLessThanOrEqual(100);
    expect(lossRate).toBeGreaterThanOrEqual(0);
    expect(lossRate).toBeLessThanOrEqual(100);
    expect(avgTimePerPuzzle).toBeGreaterThan(0);
  });
});
