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

  it('should start at 127 users', () => {
    const count = getMockOnlineCount();
    expect(count).toBe(127);
  });

  it('should keep count within bounds (95-180)', () => {
    for (let i = 0; i < 100; i++) {
      const count = getMockOnlineCount();
      expect(count).toBeGreaterThanOrEqual(95);
      expect(count).toBeLessThanOrEqual(180);
    }
  });



  it('should change by at most 3 users per update', () => {
    let lastCount = getMockOnlineCount();
    
    for (let i = 0; i < 30; i++) {
      const currentCount = getMockOnlineCount();
      const difference = Math.abs(currentCount - lastCount);
      
      // Allow for time-based updates (may not change if called too quickly)
      if (currentCount !== lastCount) {
        expect(difference).toBeLessThanOrEqual(3);
      }
      
      lastCount = currentCount;
    }
  });

  it('should reset to 127 on reset', () => {
    // Get some counts to change state
    getMockOnlineCount();
    getMockOnlineCount();
    
    // Reset
    resetMockOnlineCount();
    
    // First call after reset should be 127
    const firstCount = getMockOnlineCount();
    expect(firstCount).toBe(127);
    
    // Subsequent calls will vary due to random walk
    const secondCount = getMockOnlineCount();
    expect(secondCount).toBeGreaterThanOrEqual(95);
    expect(secondCount).toBeLessThanOrEqual(180);
  });

  it('should stay within bounds during extended simulation', () => {
    resetMockOnlineCount();
    
    // Simulate 1000 calls over time
    for (let i = 0; i < 1000; i++) {
      const count = getMockOnlineCount();
      expect(count).toBeGreaterThanOrEqual(95);
      expect(count).toBeLessThanOrEqual(180);
    }
  });
});
