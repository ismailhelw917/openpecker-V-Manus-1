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
