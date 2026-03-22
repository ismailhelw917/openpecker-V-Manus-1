import { describe, it, expect } from 'vitest';
import { getLeaderboard, getActivePlayerCount, getTotalRegisteredPlayerCount } from './leaderboard';

describe('Leaderboard Functions', () => {
  describe('getLeaderboard', () => {
    it('should return leaderboard entries sorted by accuracy', async () => {
      const entries = await getLeaderboard(10, 'accuracy');
      
      expect(Array.isArray(entries)).toBe(true);
      
      // If there are entries, check structure
      if (entries.length > 0) {
        const entry = entries[0];
        expect(entry).toHaveProperty('rank');
        expect(entry).toHaveProperty('name');
        expect(entry).toHaveProperty('totalPuzzles');
        expect(entry).toHaveProperty('totalCorrect');
        expect(entry).toHaveProperty('accuracy');
        expect(entry).toHaveProperty('rating');
        expect(entry).toHaveProperty('completedCycles');
        expect(entry).toHaveProperty('totalTimeMin');
        
        // Check types
        expect(typeof entry.rank).toBe('number');
        expect(typeof entry.name).toBe('string');
        expect(typeof entry.totalPuzzles).toBe('number');
        expect(typeof entry.accuracy).toBe('number');
        expect(typeof entry.rating).toBe('number');
        
        // Check rank is sequential
        expect(entry.rank).toBe(1);
        if (entries.length > 1) {
          expect(entries[1].rank).toBe(2);
        }
      }
    });

    it('should return leaderboard entries sorted by speed', async () => {
      const entries = await getLeaderboard(10, 'speed');
      
      expect(Array.isArray(entries)).toBe(true);
      
      // If there are entries, check they're sorted by time
      if (entries.length > 1) {
        const avgTime1 = entries[0].totalTimeMin / entries[0].totalPuzzles;
        const avgTime2 = entries[1].totalTimeMin / entries[1].totalPuzzles;
        // Speed sort should have lower avg time first (or equal)
        expect(avgTime1).toBeLessThanOrEqual(avgTime2 + 0.1); // Allow small rounding difference
      }
    });

    it('should return leaderboard entries sorted by rating', async () => {
      const entries = await getLeaderboard(10, 'rating');
      
      expect(Array.isArray(entries)).toBe(true);
      
      // If there are entries, check they're sorted by rating
      if (entries.length > 1) {
        expect(entries[0].rating).toBeGreaterThanOrEqual(entries[1].rating);
      }
    });

    it('should respect limit parameter', async () => {
      const entries = await getLeaderboard(5, 'accuracy');
      
      expect(entries.length).toBeLessThanOrEqual(5);
    });

    it('should only return players with totalPuzzles > 0', async () => {
      const entries = await getLeaderboard(100, 'accuracy');
      
      for (const entry of entries) {
        expect(entry.totalPuzzles).toBeGreaterThan(0);
      }
    });

    it('should have valid accuracy values (0-100)', async () => {
      const entries = await getLeaderboard(50, 'accuracy');
      
      for (const entry of entries) {
        expect(entry.accuracy).toBeGreaterThanOrEqual(0);
        expect(entry.accuracy).toBeLessThanOrEqual(100);
      }
    });

    it('should have valid rating values (100-3000)', async () => {
      const entries = await getLeaderboard(50, 'rating');
      
      for (const entry of entries) {
        expect(entry.rating).toBeGreaterThanOrEqual(100);
        expect(entry.rating).toBeLessThanOrEqual(3000);
      }
    });
  });

  describe('getActivePlayerCount', () => {
    it('should return a non-negative number', async () => {
      const count = await getActivePlayerCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should match the number of players with totalPuzzles > 0', async () => {
      const count = await getActivePlayerCount();
      const entries = await getLeaderboard(10000, 'accuracy');
      
      expect(count).toBe(entries.length);
    });
  });

  describe('getTotalRegisteredPlayerCount', () => {
    it('should return a non-negative number', async () => {
      const count = await getTotalRegisteredPlayerCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should be greater than or equal to active player count', async () => {
      const totalCount = await getTotalRegisteredPlayerCount();
      const activeCount = await getActivePlayerCount();
      
      expect(totalCount).toBeGreaterThanOrEqual(activeCount);
    });
  });

  describe('Leaderboard consistency', () => {
    it('should return consistent results across multiple calls', async () => {
      const entries1 = await getLeaderboard(10, 'accuracy');
      const entries2 = await getLeaderboard(10, 'accuracy');
      
      expect(entries1.length).toBe(entries2.length);
      
      for (let i = 0; i < entries1.length; i++) {
        expect(entries1[i].rank).toBe(entries2[i].rank);
        expect(entries1[i].name).toBe(entries2[i].name);
        expect(entries1[i].totalPuzzles).toBe(entries2[i].totalPuzzles);
      }
    });

    it('should have unique ranks', async () => {
      const entries = await getLeaderboard(100, 'accuracy');
      const ranks = entries.map(e => e.rank);
      const uniqueRanks = new Set(ranks);
      
      expect(uniqueRanks.size).toBe(ranks.length);
    });
  });
});
