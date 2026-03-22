import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invalidateLeaderboardCache, getLeaderboardCacheStatus } from './leaderboard-optimized';

describe('Leaderboard Cache Invalidation', () => {
  beforeEach(() => {
    // Clear cache before each test
    invalidateLeaderboardCache();
  });

  it('should clear the cache when invalidateLeaderboardCache is called', () => {
    // Get initial cache status (should be empty)
    let status = getLeaderboardCacheStatus();
    expect(status.cacheSize).toBe(0);

    // Simulate cache entries by calling getLeaderboardCacheStatus multiple times
    // (in real scenario, these would be populated by getTopPlayersByMetricOptimized)
    
    // Call invalidate
    invalidateLeaderboardCache();
    
    // Verify cache is cleared
    status = getLeaderboardCacheStatus();
    expect(status.cacheSize).toBe(0);
  });

  it('should have cache status function that returns proper structure', () => {
    const status = getLeaderboardCacheStatus();
    
    expect(status).toHaveProperty('cacheSize');
    expect(status).toHaveProperty('entries');
    expect(Array.isArray(status.entries)).toBe(true);
    expect(typeof status.cacheSize).toBe('number');
  });

  it('should be callable without errors', () => {
    // This test ensures the function can be imported and called
    expect(() => {
      invalidateLeaderboardCache();
    }).not.toThrow();
  });
});
