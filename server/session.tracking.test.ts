import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createOrUpdateOnlineSession,
  updateSessionHeartbeat,
  endOnlineSession,
  getOnlineSessionCount,
  cleanupStaleOnlineSessions,
  upsertUser,
} from './db';
import { getDb } from './db';
import { eq } from 'drizzle-orm';
import { users, onlineSessions } from '../drizzle/schema';

describe('Session Tracking', () => {
  let testUserId: number;
  let testPlayerId: number;

  beforeAll(async () => {
    // Create a test user
    const user = await upsertUser({
      openId: `session-test-${Date.now()}`,
      name: 'Session Test User',
      email: `session-test-${Date.now()}@example.com`,
    });
    testUserId = user?.id || 0;
    testPlayerId = user?.id || 0;
  });

  afterAll(async () => {
    // Clean up test sessions and user
    const db = await getDb();
    if (db && testPlayerId) {
      await db.delete(onlineSessions).where(eq(onlineSessions.playerId, testPlayerId));
      if (testUserId) {
        await db.delete(users).where(eq(users.id, testUserId));
      }
    }
  });

  it('should create or update online session', async () => {
    if (testPlayerId) {
      const result = await createOrUpdateOnlineSession(
        testPlayerId,
        testUserId,
        null,
        `test-session-${Date.now()}`
      );

      // createOrUpdateOnlineSession returns the insert result
      expect(result).toBeDefined();

      // Verify the session was created
      const db = await getDb();
      if (db) {
        const sessions = await db
          .select()
          .from(onlineSessions)
          .where(eq(onlineSessions.playerId, testPlayerId));

        expect(sessions.length).toBeGreaterThan(0);
        expect(sessions[0].status).toBe('active');
      }
    }
  });

  it('should update session heartbeat', async () => {
    if (testPlayerId) {
      // Create a session first
      await createOrUpdateOnlineSession(
        testPlayerId,
        testUserId,
        null,
        `test-heartbeat-${Date.now()}`
      );

      // Update heartbeat
      const result = await updateSessionHeartbeat(testPlayerId);
      expect(result).toBeDefined();

      // Verify heartbeat was updated
      const db = await getDb();
      if (db) {
        const sessions = await db
          .select()
          .from(onlineSessions)
          .where(eq(onlineSessions.playerId, testPlayerId));

        expect(sessions.length).toBeGreaterThan(0);
        // lastHeartbeat should be recent
        const lastHeartbeat = sessions[0].lastHeartbeat;
        const now = new Date();
        const timeDiff = now.getTime() - lastHeartbeat.getTime();
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
      }
    }
  });

  it('should count active sessions with recent heartbeats', async () => {
    if (testPlayerId) {
      // Create a fresh session
      await createOrUpdateOnlineSession(
        testPlayerId,
        testUserId,
        null,
        `test-count-${Date.now()}`
      );

      // Get online count (should include this session)
      const count = await getOnlineSessionCount(5); // 5 minute window
      expect(count).toBeGreaterThan(0);
    }
  });

  it('should cleanup stale sessions', async () => {
    const db = await getDb();
    if (db && testPlayerId) {
      // Create a session
      await createOrUpdateOnlineSession(
        testPlayerId,
        testUserId,
        null,
        `test-cleanup-${Date.now()}`
      );

      // Get initial count
      const countBefore = await db
        .select()
        .from(onlineSessions)
        .where(eq(onlineSessions.playerId, testPlayerId));

      expect(countBefore.length).toBeGreaterThan(0);

      // Manually set heartbeat to old time to simulate stale session
      const oldTime = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      await db
        .update(onlineSessions)
        .set({ lastHeartbeat: oldTime })
        .where(eq(onlineSessions.playerId, testPlayerId));

      // Clean up stale sessions (30 minute threshold)
      await cleanupStaleOnlineSessions(30);

      // Verify stale session was deleted
      const countAfter = await db
        .select()
        .from(onlineSessions)
        .where(eq(onlineSessions.playerId, testPlayerId));

      expect(countAfter.length).toBe(0);
    }
  });

  it('should end online session', async () => {
    if (testPlayerId) {
      // Create a session
      await createOrUpdateOnlineSession(
        testPlayerId,
        testUserId,
        null,
        `test-end-${Date.now()}`
      );

      // End the session
      const result = await endOnlineSession(testPlayerId);
      expect(result).toBeDefined();

      // Verify session was ended
      const db = await getDb();
      if (db) {
        const sessions = await db
          .select()
          .from(onlineSessions)
          .where(eq(onlineSessions.playerId, testPlayerId));

        // Session should be deleted or marked as inactive
        const activeSessions = sessions.filter(s => s.status === 'active');
        expect(activeSessions.length).toBe(0);
      }
    }
  });
});
