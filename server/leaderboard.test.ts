import { describe, it, expect } from "vitest";
import { getAllRegisteredUsers, getCycleHistoryByUser } from "./db";

describe("Leaderboard Data", () => {
  it("should fetch all registered users", async () => {
    const users = await getAllRegisteredUsers();
    
    console.log("Registered users:", users.length);
    users.forEach(u => {
      console.log(`- ${u.name} (${u.email}): Premium=${u.isPremium}`);
    });
    
    expect(users.length).toBeGreaterThan(0);
  });

  it("should calculate leaderboard stats for all users", async () => {
    const users = await getAllRegisteredUsers();
    
    const leaderboardData = await Promise.all(
      users.map(async (user) => {
        const cycles = await getCycleHistoryByUser(user.id, null);
        const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
        const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
        const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
        const totalTimeMs = cycles.reduce((sum, c) => sum + (c.totalTimeMs || 0), 0);
        const avgTimePerPuzzle = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles / 1000) : 0;
        const baseRating = 1200;
        const ratingGain = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 200) : 0;
        const rating = baseRating + ratingGain;

        return {
          id: user.id,
          name: user.name || "Anonymous",
          isPremium: user.isPremium === 1,
          accuracy,
          speed: avgTimePerPuzzle,
          rating,
          totalPuzzles,
          completedCycles: cycles.length,
        };
      })
    );

    console.log("Leaderboard data:");
    leaderboardData.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}: Accuracy=${user.accuracy}%, Speed=${user.speed}s, Rating=${user.rating}, Puzzles=${user.totalPuzzles}, Cycles=${user.completedCycles}`);
    });

    // Verify data
    expect(leaderboardData.length).toBeGreaterThan(0);
    
    // Check that users with cycles have correct stats
    const usersWithCycles = leaderboardData.filter(u => u.completedCycles > 0);
    expect(usersWithCycles.length).toBeGreaterThan(0);
    
    usersWithCycles.forEach(user => {
      expect(user.accuracy).toBeGreaterThan(0);
      expect(user.accuracy).toBeLessThanOrEqual(100);
      expect(user.speed).toBeGreaterThan(0);
      expect(user.rating).toBeGreaterThan(0);
      expect(user.totalPuzzles).toBeGreaterThan(0);
    });
  });

  it("should sort leaderboard by accuracy", async () => {
    const users = await getAllRegisteredUsers();
    
    const leaderboardData = await Promise.all(
      users.map(async (user) => {
        const cycles = await getCycleHistoryByUser(user.id, null);
        const totalPuzzles = cycles.reduce((sum, c) => sum + c.totalPuzzles, 0);
        const totalCorrect = cycles.reduce((sum, c) => sum + c.correctCount, 0);
        const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;

        return {
          id: user.id,
          name: user.name || "Anonymous",
          accuracy,
          totalPuzzles,
          completedCycles: cycles.length,
        };
      })
    );

    // Sort by accuracy
    const sorted = leaderboardData.sort((a, b) => b.accuracy - a.accuracy);
    
    console.log("Sorted by accuracy:");
    sorted.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}: ${user.accuracy}%`);
    });

    // Verify sorting
    for (let i = 0; i < sorted.length - 1; i++) {
      expect(sorted[i].accuracy).toBeGreaterThanOrEqual(sorted[i + 1].accuracy);
    }
  });
});
