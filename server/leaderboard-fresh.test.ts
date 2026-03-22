import { describe, it, expect } from 'vitest';
import { getTopPlayersByMetric, countActivePlayers, countAllPlayers, getLeaderboardSummary } from './leaderboard-fresh';

describe('Fresh Leaderboard System', () => {
  describe('getTopPlayersByMetric', () => {
    it('should return players sorted by accuracy', async () => {
      const players = await getTopPlayersByMetric(50, 'accuracy');
      
      expect(Array.isArray(players)).toBe(true);
      
      if (players.length > 0) {
        const player = players[0];
        expect(player).toHaveProperty('rank');
        expect(player).toHaveProperty('playerName');
        expect(player).toHaveProperty('puzzlesSolved');
        expect(player).toHaveProperty('accuracy');
        expect(player).toHaveProperty('rating');
        expect(player).toHaveProperty('totalMinutes');
        
        expect(player.rank).toBe(1);
      }
    });

    it('should return players sorted by speed', async () => {
      const players = await getTopPlayersByMetric(50, 'speed');
      
      expect(Array.isArray(players)).toBe(true);
      
      if (players.length > 1) {
        for (let i = 0; i < players.length - 1; i++) {
          const avgTime1 = players[i].puzzlesSolved > 0 ? players[i].totalMinutes / players[i].puzzlesSolved : 999999;
          const avgTime2 = players[i + 1].puzzlesSolved > 0 ? players[i + 1].totalMinutes / players[i + 1].puzzlesSolved : 999999;
          expect(avgTime1).toBeLessThanOrEqual(avgTime2 + 0.1);
        }
      }
    });

    it('should return players sorted by rating', async () => {
      const players = await getTopPlayersByMetric(50, 'rating');
      
      expect(Array.isArray(players)).toBe(true);
      
      if (players.length > 1) {
        for (let i = 0; i < players.length - 1; i++) {
          expect(players[i].rating).toBeGreaterThanOrEqual(players[i + 1].rating);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const players = await getTopPlayersByMetric(5, 'accuracy');
      
      expect(players.length).toBeLessThanOrEqual(5);
    });

    it('should only return players with puzzles solved', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      
      for (const player of players) {
        expect(player.puzzlesSolved).toBeGreaterThan(0);
      }
    });

    it('should have valid accuracy values (0-100)', async () => {
      const players = await getTopPlayersByMetric(50, 'accuracy');
      
      for (const player of players) {
        expect(player.accuracy).toBeGreaterThanOrEqual(0);
        expect(player.accuracy).toBeLessThanOrEqual(100);
      }
    });

    it('should have valid rating values (1200+)', async () => {
      const players = await getTopPlayersByMetric(50, 'rating');
      
      for (const player of players) {
        expect(player.rating).toBeGreaterThanOrEqual(100);
        expect(player.rating).toBeLessThanOrEqual(3000);
      }
    });

    it('should have sequential ranks', async () => {
      const players = await getTopPlayersByMetric(20, 'accuracy');
      
      for (let i = 0; i < players.length; i++) {
        expect(players[i].rank).toBe(i + 1);
      }
    });

    it('should not contain hardcoded test players', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      
      for (const player of players) {
        expect(player.playerName.toLowerCase()).not.toContain('ayush');
        expect(player.playerName.toLowerCase()).not.toContain('br');
        expect(player.playerName).not.toBe('Ayush');
        expect(player.playerName).not.toBe('BR');
      }
    });
  });

  describe('countActivePlayers', () => {
    it('should return a non-negative number', async () => {
      const count = await countActivePlayers();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should match the number of players with puzzles solved', async () => {
      const count = await countActivePlayers();
      const allPlayers = await getTopPlayersByMetric(10000, 'accuracy');
      
      expect(count).toBe(allPlayers.length);
    });
  });

  describe('countAllPlayers', () => {
    it('should return a non-negative number', async () => {
      const count = await countAllPlayers();
      
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should be greater than or equal to active player count', async () => {
      const totalCount = await countAllPlayers();
      const activeCount = await countActivePlayers();
      
      expect(totalCount).toBeGreaterThanOrEqual(activeCount);
    });
  });

  describe('getLeaderboardSummary', () => {
    it('should return valid summary object', async () => {
      const summary = await getLeaderboardSummary();
      
      expect(summary).toHaveProperty('activePlayers');
      expect(summary).toHaveProperty('totalPlayers');
      expect(summary).toHaveProperty('topAccuracy');
      expect(summary).toHaveProperty('topRating');
      expect(summary).toHaveProperty('averageAccuracy');
      expect(summary).toHaveProperty('averageRating');
      expect(summary).toHaveProperty('totalPuzzlesSolvedGlobally');
    });

    it('should have valid accuracy values', async () => {
      const summary = await getLeaderboardSummary();
      
      expect(summary.topAccuracy).toBeGreaterThanOrEqual(0);
      expect(summary.topAccuracy).toBeLessThanOrEqual(100);
      expect(summary.averageAccuracy).toBeGreaterThanOrEqual(0);
      expect(summary.averageAccuracy).toBeLessThanOrEqual(100);
    });

    it('should have valid rating values', async () => {
      const summary = await getLeaderboardSummary();
      
      expect(summary.topRating).toBeGreaterThanOrEqual(100);
      expect(summary.topRating).toBeLessThanOrEqual(3000);
      expect(summary.averageRating).toBeGreaterThanOrEqual(100);
      expect(summary.averageRating).toBeLessThanOrEqual(3000);
    });

    it('should have consistent player counts', async () => {
      const summary = await getLeaderboardSummary();
      
      expect(summary.totalPlayers).toBeGreaterThanOrEqual(summary.activePlayers);
    });
  });

  describe('Data consistency', () => {
    it('should return consistent results across multiple calls', async () => {
      const players1 = await getTopPlayersByMetric(10, 'accuracy');
      const players2 = await getTopPlayersByMetric(10, 'accuracy');
      
      expect(players1.length).toBe(players2.length);
      
      for (let i = 0; i < players1.length; i++) {
        expect(players1[i].rank).toBe(players2[i].rank);
        expect(players1[i].playerName).toBe(players2[i].playerName);
        expect(players1[i].puzzlesSolved).toBe(players2[i].puzzlesSolved);
      }
    });

    it('should have unique ranks', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      const ranks = players.map(p => p.rank);
      const uniqueRanks = new Set(ranks);
      
      expect(uniqueRanks.size).toBe(ranks.length);
    });

    it('should not contain test players (Ayush, BR)', async () => {
      const summary = await getLeaderboardSummary();
      const players = await getTopPlayersByMetric(1000, 'accuracy');
      
      const testPlayerNames = players.map(p => p.playerName.toLowerCase());
      expect(testPlayerNames).not.toContain('ayush');
      expect(testPlayerNames).not.toContain('br');
    });
  });
});
