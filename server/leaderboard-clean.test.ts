import { describe, it, expect } from 'vitest';
import { getTopPlayers, getActivePlayerCount, getTotalPlayerCount, getLeaderboardStats } from './leaderboard-clean';

describe('Clean Leaderboard System', () => {
  describe('getTopPlayers', () => {
    it('should return players sorted by accuracy', async () => {
      const players = await getTopPlayers(10, 'accuracy');
      
      expect(Array.isArray(players)).toBe(true);
      
      if (players.length > 0) {
        const player = players[0];
        expect(player).toHaveProperty('rank');
        expect(player).toHaveProperty('name');
        expect(player).toHaveProperty('puzzlesSolved');
        expect(player).toHaveProperty('accuracy');
        expect(player).toHaveProperty('rating');
        expect(player).toHaveProperty('totalTimeMinutes');
        
        expect(typeof player.rank).toBe('number');
        expect(typeof player.name).toBe('string');
        expect(typeof player.puzzlesSolved).toBe('number');
        expect(typeof player.accuracy).toBe('number');
        expect(typeof player.rating).toBe('number');
        
        // First player should have rank 1
        expect(player.rank).toBe(1);
      }
    });

    it('should return players sorted by speed', async () => {
      const players = await getTopPlayers(10, 'speed');
      
      expect(Array.isArray(players)).toBe(true);
      
      // If there are multiple players, verify speed sorting
      if (players.length > 1) {
        for (let i = 0; i < players.length - 1; i++) {
          const avgTime1 = players[i].puzzlesSolved > 0 ? players[i].totalTimeMinutes / players[i].puzzlesSolved : 999999;
          const avgTime2 = players[i + 1].puzzlesSolved > 0 ? players[i + 1].totalTimeMinutes / players[i + 1].puzzlesSolved : 999999;
          expect(avgTime1).toBeLessThanOrEqual(avgTime2 + 0.1);
        }
      }
    });

    it('should return players sorted by rating', async () => {
      const players = await getTopPlayers(10, 'rating');
      
      expect(Array.isArray(players)).toBe(true);
      
      // If there are multiple players, verify rating sorting
      if (players.length > 1) {
        for (let i = 0; i < players.length - 1; i++) {
          expect(players[i].rating).toBeGreaterThanOrEqual(players[i + 1].rating);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const players = await getTopPlayers(5, 'accuracy');
      
      expect(players.length).toBeLessThanOrEqual(5);
    });

    it('should only return players with puzzles solved', async () => {
      const players = await getTopPlayers(100, 'accuracy');
      
      for (const player of players) {
        expect(player.puzzlesSolved).toBeGreaterThan(0);
      }
    });

    it('should have valid accuracy values', async () => {
      const players = await getTopPlayers(50, 'accuracy');
      
      for (const player of players) {
        expect(player.accuracy).toBeGreaterThanOrEqual(0);
        expect(player.accuracy).toBeLessThanOrEqual(100);
      }
    });

    it('should have valid rating values', async () => {
      const players = await getTopPlayers(50, 'rating');
      
      for (const player of players) {
        expect(player.rating).toBeGreaterThanOrEqual(100);
        expect(player.rating).toBeLessThanOrEqual(3000);
      }
    });

    it('should have sequential ranks', async () => {
      const players = await getTopPlayers(20, 'accuracy');
      
      for (let i = 0; i < players.length; i++) {
        expect(players[i].rank).toBe(i + 1);
      }
    });

    it('should have non-empty player names', async () => {
      const players = await getTopPlayers(10, 'accuracy');
      
      for (const player of players) {
        expect(player.name).toBeTruthy();
        expect(player.name.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getActivePlayerCount', () => {
    it('should return a non-negative number', async () => {
      const count = await getActivePlayerCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should match the number of players with puzzles solved', async () => {
      const count = await getActivePlayerCount();
      const allPlayers = await getTopPlayers(10000, 'accuracy');
      
      expect(count).toBe(allPlayers.length);
    });
  });

  describe('getTotalPlayerCount', () => {
    it('should return a non-negative number', async () => {
      const count = await getTotalPlayerCount();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should be greater than or equal to active player count', async () => {
      const totalCount = await getTotalPlayerCount();
      const activeCount = await getActivePlayerCount();
      
      expect(totalCount).toBeGreaterThanOrEqual(activeCount);
    });
  });

  describe('getLeaderboardStats', () => {
    it('should return valid stats object', async () => {
      const stats = await getLeaderboardStats();
      
      expect(stats).toHaveProperty('activePlayerCount');
      expect(stats).toHaveProperty('totalPlayerCount');
      expect(stats).toHaveProperty('topAccuracy');
      expect(stats).toHaveProperty('topRating');
      expect(stats).toHaveProperty('averageAccuracy');
      expect(stats).toHaveProperty('averageRating');
    });

    it('should have valid accuracy values', async () => {
      const stats = await getLeaderboardStats();
      
      expect(stats.topAccuracy).toBeGreaterThanOrEqual(0);
      expect(stats.topAccuracy).toBeLessThanOrEqual(100);
      expect(stats.averageAccuracy).toBeGreaterThanOrEqual(0);
      expect(stats.averageAccuracy).toBeLessThanOrEqual(100);
    });

    it('should have valid rating values', async () => {
      const stats = await getLeaderboardStats();
      
      expect(stats.topRating).toBeGreaterThanOrEqual(100);
      expect(stats.topRating).toBeLessThanOrEqual(3000);
      expect(stats.averageRating).toBeGreaterThanOrEqual(100);
      expect(stats.averageRating).toBeLessThanOrEqual(3000);
    });

    it('should have consistent player counts', async () => {
      const stats = await getLeaderboardStats();
      
      expect(stats.totalPlayerCount).toBeGreaterThanOrEqual(stats.activePlayerCount);
    });
  });

  describe('Leaderboard consistency', () => {
    it('should return consistent results across multiple calls', async () => {
      const players1 = await getTopPlayers(10, 'accuracy');
      const players2 = await getTopPlayers(10, 'accuracy');
      
      expect(players1.length).toBe(players2.length);
      
      for (let i = 0; i < players1.length; i++) {
        expect(players1[i].rank).toBe(players2[i].rank);
        expect(players1[i].name).toBe(players2[i].name);
        expect(players1[i].puzzlesSolved).toBe(players2[i].puzzlesSolved);
      }
    });

    it('should have unique ranks', async () => {
      const players = await getTopPlayers(100, 'accuracy');
      const ranks = players.map(p => p.rank);
      const uniqueRanks = new Set(ranks);
      
      expect(uniqueRanks.size).toBe(ranks.length);
    });
  });
});
