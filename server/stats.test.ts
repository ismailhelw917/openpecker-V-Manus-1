import { describe, it, expect, beforeAll } from "vitest";
import { getCycleHistoryByUser } from "./db";

describe("Stats Calculation", () => {
  // User IDs from database
  const USER_ID_1 = 750215; // N.Balaji
  const USER_ID_2 = 750255; // Ayush
  const USER_ID_3 = 750380; // BR

  it("should retrieve cycle history for user 1", async () => {
    const cycles = await getCycleHistoryByUser(USER_ID_1, null);
    expect(cycles).toBeDefined();
    expect(cycles.length).toBeGreaterThan(0);
    console.log(`User 1 cycles: ${cycles.length}`);
    
    // Calculate stats
    const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    
    console.log(`User 1 - Total Puzzles: ${totalPuzzles}, Correct: ${totalCorrect}, Accuracy: ${accuracy}%`);
    
    expect(totalPuzzles).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  it("should retrieve cycle history for user 2", async () => {
    const cycles = await getCycleHistoryByUser(USER_ID_2, null);
    expect(cycles).toBeDefined();
    expect(cycles.length).toBeGreaterThan(0);
    console.log(`User 2 cycles: ${cycles.length}`);
    
    const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    
    console.log(`User 2 - Total Puzzles: ${totalPuzzles}, Correct: ${totalCorrect}, Accuracy: ${accuracy}%`);
    
    expect(totalPuzzles).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  it("should retrieve cycle history for user 3", async () => {
    const cycles = await getCycleHistoryByUser(USER_ID_3, null);
    expect(cycles).toBeDefined();
    expect(cycles.length).toBeGreaterThan(0);
    console.log(`User 3 cycles: ${cycles.length}`);
    
    const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
    const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    
    console.log(`User 3 - Total Puzzles: ${totalPuzzles}, Correct: ${totalCorrect}, Accuracy: ${accuracy}%`);
    
    expect(totalPuzzles).toBeGreaterThan(0);
    expect(accuracy).toBeGreaterThanOrEqual(0);
    expect(accuracy).toBeLessThanOrEqual(100);
  });

  it("should calculate stats correctly for all users", async () => {
    const users = [
      { id: USER_ID_1, name: "N.Balaji" },
      { id: USER_ID_2, name: "Ayush" },
      { id: USER_ID_3, name: "BR" },
    ];

    for (const user of users) {
      const cycles = await getCycleHistoryByUser(user.id, null);
      
      if (cycles.length === 0) {
        console.log(`${user.name}: No cycles found`);
        continue;
      }

      const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
      const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
      const totalTimeMs = cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
      const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
      const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
      const winRate = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
      const lossRate = 100 - winRate;

      console.log(`
${user.name}:
  - Cycles: ${cycles.length}
  - Total Puzzles: ${totalPuzzles}
  - Correct: ${totalCorrect}
  - Accuracy: ${accuracy}%
  - Win Rate: ${winRate}%
  - Loss Rate: ${lossRate}%
  - Avg Time/Puzzle: ${avgTimePerPuzzle}s
      `);

      expect(accuracy).toBeGreaterThanOrEqual(0);
      expect(accuracy).toBeLessThanOrEqual(100);
      expect(winRate).toBeGreaterThanOrEqual(0);
      expect(winRate).toBeLessThanOrEqual(100);
    }
  });
});
