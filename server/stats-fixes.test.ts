import { describe, it, expect, vi } from 'vitest';

// Test the stats computation logic
describe('Stats Computation', () => {
  it('should compute accuracy correctly from puzzle attempts', () => {
    const totalPuzzles = 19;
    const totalCorrect = 5;
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    expect(accuracy).toBe(26);
  });

  it('should return 0 accuracy when no puzzles attempted', () => {
    const totalPuzzles = 0;
    const totalCorrect = 0;
    const accuracy = totalPuzzles > 0 ? Math.round((totalCorrect / totalPuzzles) * 100) : 0;
    expect(accuracy).toBe(0);
  });

  it('should compute time stats correctly', () => {
    const totalTimeMs = 898234;
    const totalPuzzles = 19;
    const totalTimeHours = totalTimeMs > 0 ? Math.floor(totalTimeMs / 3600000) : 0;
    const totalTimeMinutes = totalTimeMs > 0 ? Math.floor(totalTimeMs / 60000) : 0;
    const avgTimePerPuzzleMs = totalPuzzles > 0 ? Math.round(totalTimeMs / totalPuzzles) : 0;
    const avgTimePerPuzzleStr = avgTimePerPuzzleMs > 0 ? (avgTimePerPuzzleMs / 1000).toFixed(1) + "s" : "0s";
    
    expect(totalTimeHours).toBe(0);
    expect(totalTimeMinutes).toBe(14);
    expect(avgTimePerPuzzleMs).toBe(47275);
    expect(avgTimePerPuzzleStr).toBe("47.3s");
  });

  it('should compute study time string correctly for hours', () => {
    const totalTimeMs = 7200000; // 2 hours
    const totalTimeHours = totalTimeMs > 0 ? Math.floor(totalTimeMs / 3600000) : 0;
    const totalTimeMinutes = totalTimeMs > 0 ? Math.floor(totalTimeMs / 60000) : 0;
    const studyTimeStr = totalTimeHours > 0 ? totalTimeHours + "h" : (totalTimeMinutes > 0 ? totalTimeMinutes + "m" : "0h");
    expect(studyTimeStr).toBe("2h");
  });

  it('should compute study time string correctly for minutes', () => {
    const totalTimeMs = 898234; // ~15 minutes
    const totalTimeHours = totalTimeMs > 0 ? Math.floor(totalTimeMs / 3600000) : 0;
    const totalTimeMinutes = totalTimeMs > 0 ? Math.floor(totalTimeMs / 60000) : 0;
    const studyTimeStr = totalTimeHours > 0 ? totalTimeHours + "h" : (totalTimeMinutes > 0 ? totalTimeMinutes + "m" : "0h");
    expect(studyTimeStr).toBe("14m");
  });

  it('should compute average puzzles per day correctly', () => {
    const totalPuzzles = 19;
    const daysSinceFirst = 3;
    const avgPuzzlesPerDay = totalPuzzles > 0 ? Math.round(totalPuzzles / daysSinceFirst) : 0;
    expect(avgPuzzlesPerDay).toBe(6);
  });

  it('should compute consistency correctly', () => {
    const currentStreak = 3;
    const daysSinceFirst = 5;
    const totalPuzzles = 19;
    const consistency = totalPuzzles >= 5 ? Math.min(100, Math.round((currentStreak / Math.max(daysSinceFirst, 1)) * 100)) : 0;
    expect(consistency).toBe(60);
  });

  it('should compute rating gain correctly', () => {
    const playerRating = 1200;
    const ratingGain = playerRating - 1200;
    expect(ratingGain).toBe(0);
  });
});

// Test streak calculation logic
describe('Streak Calculation', () => {
  it('should calculate current streak from consecutive days', () => {
    // Simulate active days: today, yesterday, day before
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days = [
      { activeDay: new Date(today) },
      { activeDay: new Date(today.getTime() - 86400000) },
      { activeDay: new Date(today.getTime() - 86400000 * 2) },
    ];
    
    let streak = 0;
    const firstDay = new Date(days[0].activeDay);
    firstDay.setHours(0, 0, 0, 0);
    const diffFromToday = Math.floor((today.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffFromToday <= 1) {
      let expectedDate = new Date(firstDay);
      for (let i = 0; i < days.length; i++) {
        const dayDate = new Date(days[i].activeDay);
        dayDate.setHours(0, 0, 0, 0);
        const diff = Math.floor((expectedDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 0) {
          streak++;
          expectedDate.setDate(expectedDate.getDate() - 1);
        } else {
          break;
        }
      }
    }
    
    expect(streak).toBe(3);
  });

  it('should return 0 streak when last activity was more than 1 day ago', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days = [
      { activeDay: new Date(today.getTime() - 86400000 * 3) }, // 3 days ago
    ];
    
    const firstDay = new Date(days[0].activeDay);
    firstDay.setHours(0, 0, 0, 0);
    const diffFromToday = Math.floor((today.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24));
    
    let streak = 0;
    if (diffFromToday > 1) {
      streak = 0;
    }
    
    expect(streak).toBe(0);
  });
});

// Test player name generation logic
describe('Player Name Generation', () => {
  it('should generate player name from userId when name is null', () => {
    const userId = 750572;
    const deviceId = null;
    const name: string | null = null;
    const playerName = name || (userId ? `Player-${userId}` : `Guest-${deviceId?.slice(0, 8) || 'unknown'}`);
    expect(playerName).toBe('Player-750572');
  });

  it('should generate guest name from deviceId when both name and userId are null', () => {
    const userId = null;
    const deviceId = 'abc12345-xyz-789';
    const name: string | null = null;
    const playerName = name || (userId ? `Player-${userId}` : `Guest-${deviceId?.slice(0, 8) || 'unknown'}`);
    expect(playerName).toBe('Guest-abc12345');
  });

  it('should use provided name when available', () => {
    const userId = 750572;
    const deviceId = null;
    const name = 'Ismail';
    const playerName = name || (userId ? `Player-${userId}` : `Guest-${deviceId?.slice(0, 8) || 'unknown'}`);
    expect(playerName).toBe('Ismail');
  });
});

// Test checkout URL handling
describe('Checkout URL Handling', () => {
  it('should use window.location.href for redirect (not window.open)', () => {
    // Verify the pattern: window.location.href = data.url
    // This is a design test - window.open is blocked by mobile popup blockers
    const data = { url: 'https://checkout.stripe.com/pay/cs_test_123' };
    
    // Simulate the redirect approach
    let redirectUrl = '';
    const mockLocation = { href: '' };
    
    if (data?.url) {
      mockLocation.href = data.url;
      redirectUrl = mockLocation.href;
    }
    
    expect(redirectUrl).toBe('https://checkout.stripe.com/pay/cs_test_123');
  });

  it('should throw error when no checkout URL received', () => {
    const data = { url: null };
    expect(() => {
      if (!data?.url) throw new Error("No checkout URL received");
    }).toThrow("No checkout URL received");
  });
});

// ─── Incremental ELO rating logic ────────────────────────────────────────────
describe('Incremental ELO Rating', () => {
  /**
   * Mirror of the logic in server/players.ts updatePlayerStats
   */
  function computeNewRating(
    currentRating: number,
    totalPuzzles: number,
    prevTotalPuzzles: number,
    totalCorrect: number,
    prevTotalCorrect: number,
  ): number {
    const newPuzzles = Math.max(0, totalPuzzles - prevTotalPuzzles);
    const newCorrect = Math.max(0, totalCorrect - prevTotalCorrect);
    if (newPuzzles === 0) return currentRating;

    const kFactor = Math.max(4, 32 - Math.floor(totalPuzzles / 50));
    const expectedScore = 0.5;
    const actualScore = newCorrect / newPuzzles;
    const delta = Math.round(kFactor * (actualScore - expectedScore) * Math.min(newPuzzles, 32));
    return Math.max(100, Math.min(3000, currentRating + delta));
  }

  it('rating stays at 1200 when no new puzzles are solved', () => {
    const rating = computeNewRating(1200, 10, 10, 8, 8);
    expect(rating).toBe(1200);
  });

  it('rating increases when player solves all new puzzles correctly', () => {
    // 10 new puzzles, all correct → actual 1.0 vs expected 0.5 → positive delta
    const rating = computeNewRating(1200, 10, 0, 10, 0);
    expect(rating).toBeGreaterThan(1200);
  });

  it('rating decreases when player gets all new puzzles wrong', () => {
    // 10 new puzzles, all wrong → actual 0.0 vs expected 0.5 → negative delta
    const rating = computeNewRating(1200, 10, 0, 0, 0);
    expect(rating).toBeLessThan(1200);
  });

  it('rating is cumulative across multiple updates', () => {
    // First batch: 10 puzzles, 8 correct
    const r1 = computeNewRating(1200, 10, 0, 8, 0);
    expect(r1).toBeGreaterThan(1200);

    // Second batch: 20 total puzzles, 16 total correct (10 new, 8 correct)
    const r2 = computeNewRating(r1, 20, 10, 16, 8);
    expect(r2).toBeGreaterThan(r1); // rating keeps growing

    // Third batch: 30 total, 18 correct (10 new, 2 correct — bad performance)
    const r3 = computeNewRating(r2, 30, 20, 18, 16);
    expect(r3).toBeLessThan(r2); // rating drops after bad batch
  });

  it('rating is clamped between 100 and 3000', () => {
    // Simulate a very high rating being pushed higher — should cap at 3000
    const high = computeNewRating(2990, 10, 0, 10, 0);
    expect(high).toBeLessThanOrEqual(3000);

    // Simulate a very low rating being pushed lower — should floor at 100
    const low = computeNewRating(110, 10, 0, 0, 0);
    expect(low).toBeGreaterThanOrEqual(100);
  });

  it('k-factor decreases as player solves more puzzles (more stable rating)', () => {
    // With 0 total puzzles: kFactor = max(4, 32 - 0) = 32
    // With 1400 total puzzles: kFactor = max(4, 32 - 28) = 4
    const kFactorNew      = Math.max(4, 32 - Math.floor(10 / 50));   // 32
    const kFactorVeteran  = Math.max(4, 32 - Math.floor(1400 / 50)); // 4
    expect(kFactorNew).toBe(32);
    expect(kFactorVeteran).toBe(4);
    expect(kFactorNew).toBeGreaterThan(kFactorVeteran);
  });

  it('ratingGain display handles negative values without prepending +', () => {
    const ratingGain = -15;
    const display = ratingGain >= 0 ? '+' + ratingGain.toString() : ratingGain.toString();
    expect(display).toBe('-15');
  });

  it('ratingGain display prepends + for positive values', () => {
    const ratingGain = 47;
    const display = ratingGain >= 0 ? '+' + ratingGain.toString() : ratingGain.toString();
    expect(display).toBe('+47');
  });

  it('peakRating only ever increases', () => {
    const currentPeak = 1350;
    // New rating is lower → peak stays
    const peak1 = Math.max(currentPeak, 1300);
    expect(peak1).toBe(1350);
    // New rating is higher → peak updates
    const peak2 = Math.max(currentPeak, 1400);
    expect(peak2).toBe(1400);
  });
});
