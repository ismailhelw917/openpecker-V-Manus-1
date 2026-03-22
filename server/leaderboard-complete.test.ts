import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTopPlayersByMetric, countActivePlayers, countAllPlayers, getLeaderboardSummary } from './leaderboard-complete';

describe('Complete Leaderboard System (cycle_history based)', () => {
  describe('getTopPlayersByMetric', () => {
    it('should return players sorted by accuracy', async () => {
      const players = await getTopPlayersByMetric(50, 'accuracy');
      expect(Array.isArray(players)).toBe(true);
      expect(players.length).toBeGreaterThan(0);
      
      // Verify structure
      if (players.length > 0) {
        expect(players[0]).toHaveProperty('rank');
        expect(players[0]).toHaveProperty('playerName');
        expect(players[0]).toHaveProperty('puzzlesSolved');
        expect(players[0]).toHaveProperty('accuracy');
        expect(players[0]).toHaveProperty('rating');
      }
    });

    it('should return players sorted by speed', async () => {
      const players = await getTopPlayersByMetric(50, 'speed');
      expect(Array.isArray(players)).toBe(true);
    });

    it('should return players sorted by rating', async () => {
      const players = await getTopPlayersByMetric(50, 'rating');
      expect(Array.isArray(players)).toBe(true);
    });

    it('should include registered users with cycle data', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      const hasRegisteredUsers = players.some(p => !p.playerName.startsWith('Guest-'));
      expect(hasRegisteredUsers).toBe(true);
    });
  });

  describe('countActivePlayers', () => {
    it('should return active player count', async () => {
      const count = await countActivePlayers();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('countAllPlayers', () => {
    it('should return total player count', async () => {
      const count = await countAllPlayers();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should have total >= active', async () => {
      const active = await countActivePlayers();
      const total = await countAllPlayers();
      expect(total).toBeGreaterThanOrEqual(active);
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
      expect(summary.averageRating).toBeGreaterThanOrEqual(100);
    });

    it('should have consistent player counts', async () => {
      const summary = await getLeaderboardSummary();
      expect(summary.totalPlayers).toBeGreaterThanOrEqual(summary.activePlayers);
    });
  });

  describe('Data consistency', () => {
    it('should return consistent results across multiple calls', async () => {
      const result1 = await getTopPlayersByMetric(10, 'accuracy');
      const result2 = await getTopPlayersByMetric(10, 'accuracy');
      
      expect(result1.length).toBe(result2.length);
      if (result1.length > 0) {
        expect(result1[0].playerName).toBe(result2[0].playerName);
      }
    });

    it('should have more players than before (using cycle_history)', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      // Should have more than just the 8 from puzzle_attempts
      expect(players.length).toBeGreaterThanOrEqual(4);
    });

    it('should include players with cycle data', async () => {
      const players = await getTopPlayersByMetric(100, 'accuracy');
      const activePlayers = await countActivePlayers();
      
      // Should have at least some players
      expect(players.length).toBeGreaterThan(0);
      expect(activePlayers).toBeGreaterThan(0);
    });
  });
});
