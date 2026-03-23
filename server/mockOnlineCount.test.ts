import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getMockOnlineCount, resetMockOnlineCount, setTestMode } from './mockOnlineCount';

describe('Mock Online Count', () => {
  beforeEach(() => {
    setTestMode(true);
    resetMockOnlineCount();
  });

  afterEach(() => {
    setTestMode(false);
  });

  it('should return a positive number on first call', () => {
    const count = getMockOnlineCount();
    expect(count).toBeGreaterThan(0);
  });

  it('should return a number within realistic bounds (20-300)', () => {
    for (let i = 0; i < 100; i++) {
      const count = getMockOnlineCount();
      expect(count).toBeGreaterThanOrEqual(20);
      expect(count).toBeLessThanOrEqual(300);
    }
  });

  it('should change by at most 20 users per update (drift + pull)', () => {
    let lastCount = getMockOnlineCount();
    
    for (let i = 0; i < 30; i++) {
      const currentCount = getMockOnlineCount();
      const difference = Math.abs(currentCount - lastCount);
      
      // Allow for time-based updates (may not change if called too quickly)
      if (currentCount !== lastCount) {
        // drift is ±4, pull is up to 5% of distance — max change is ~20 per tick
        expect(difference).toBeLessThanOrEqual(20);
      }
      
      lastCount = currentCount;
    }
  });

  it('should reset and return a fresh value on reset', () => {
    // Get some counts to change state
    getMockOnlineCount();
    getMockOnlineCount();
    
    // Reset
    resetMockOnlineCount();
    
    // First call after reset should return a positive number
    const firstCount = getMockOnlineCount();
    expect(firstCount).toBeGreaterThan(0);
    expect(firstCount).toBeLessThanOrEqual(300);
  });

  it('should stay within realistic bounds during extended simulation', () => {
    resetMockOnlineCount();
    
    // Simulate 1000 calls over time
    for (let i = 0; i < 1000; i++) {
      const count = getMockOnlineCount();
      expect(count).toBeGreaterThanOrEqual(20);
      expect(count).toBeLessThanOrEqual(300);
    }
  });
});
