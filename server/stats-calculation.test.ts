import { describe, it, expect, beforeAll } from "vitest";
import { getCycleHistoryByUser } from "./db";

describe("Stats Calculation", () => {
  it("should calculate stats correctly for user with cycle data", async () => {
    // Get cycles for user 750215 (N.Balaji)
    const cycles = await getCycleHistoryByUser(750215, null);
    
    console.log("Cycles retrieved:", cycles.length);
    console.log("First cycle:", cycles[0]);
    
    expect(cycles.length).toBeGreaterThan(0);
    
    // Calculate stats
    const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
    const accuracy = totalPuzzles > 0 ? (totalCorrect / totalPuzzles) * 100 : 0;
    const completedCycles = cycles.length;
    const totalTimeMs = cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
    const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
    const winRate = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    const lossRate = 100 - winRate;
    
    console.log("Stats calculated:");
    console.log("- Total Puzzles:", totalPuzzles);
    console.log("- Total Correct:", totalCorrect);
    console.log("- Accuracy:", accuracy.toFixed(2) + "%");
    console.log("- Win Rate:", winRate + "%");
    console.log("- Loss Rate:", lossRate + "%");
    console.log("- Avg Time/Puzzle:", avgTimePerPuzzle + "s");
    console.log("- Total Cycles:", completedCycles);
    
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
  });

  it("should handle accuracy field type correctly", async () => {
    const cycles = await getCycleHistoryByUser(750215, null);
    
    if (cycles.length > 0) {
      const cycle = cycles[0];
      console.log("Accuracy field type:", typeof cycle.accuracy);
      console.log("Accuracy value:", cycle.accuracy);
      
      // The accuracy field should be a decimal number
      const accuracyValue = typeof cycle.accuracy === 'string' 
        ? parseFloat(cycle.accuracy) 
        : Number(cycle.accuracy);
      
      expect(accuracyValue).toBeGreaterThanOrEqual(0);
      expect(accuracyValue).toBeLessThanOrEqual(100);
    }
  });
});
