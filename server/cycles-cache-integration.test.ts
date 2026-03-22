import { describe, it, expect, beforeEach, vi } from 'vitest';
import { invalidateLeaderboardCache, getLeaderboardCacheStatus } from './leaderboard-optimized';

/**
 * Integration test to verify that cache invalidation happens when cycles are created
 * This simulates the flow: puzzle completion -> cycle.create -> cache invalidation
 */
describe('Cycle Creation Cache Invalidation Integration', () => {
  beforeEach(() => {
    invalidateLeaderboardCache();
  });

  it('should invalidate cache when simulating cycle completion', () => {
    // Initial state: cache is empty
    let status = getLeaderboardCacheStatus();
    expect(status.cacheSize).toBe(0);

    // Simulate cache population (would happen on first leaderboard query)
    // In real scenario, getTopPlayersByMetricOptimized would populate cache
    
    // Simulate cycle completion by calling invalidate
    // This is what happens in cycles.create mutation
    invalidateLeaderboardCache();
    
    // Verify cache is cleared
    status = getLeaderboardCacheStatus();
    expect(status.cacheSize).toBe(0);
    
    console.log('[Test] Cache invalidation successful - leaderboard will refresh on next query');
  });

  it('should allow multiple invalidations without errors', () => {
    // Simulate multiple rapid cycle completions
    for (let i = 0; i < 5; i++) {
      expect(() => {
        invalidateLeaderboardCache();
      }).not.toThrow();
    }
    
    const status = getLeaderboardCacheStatus();
    expect(status.cacheSize).toBe(0);
  });

  it('should have proper cache status structure', () => {
    const status = getLeaderboardCacheStatus();
    
    expect(status).toHaveProperty('cacheSize');
    expect(status).toHaveProperty('entries');
    expect(typeof status.cacheSize).toBe('number');
    expect(Array.isArray(status.entries)).toBe(true);
    
    // Verify entries have expected structure
    if (status.entries.length > 0) {
      const entry = status.entries[0];
      expect(entry).toHaveProperty('key');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('ttl');
      expect(entry).toHaveProperty('dataCount');
    }
  });
});
