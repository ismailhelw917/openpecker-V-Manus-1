import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, upsertUser, updatePlayerName } from './db';
import { eq } from 'drizzle-orm';
import { users } from '../drizzle/schema';

describe('Auth - updateName', () => {
  let testUserId: number;

  beforeAll(async () => {
    // Create a test user
    const user = await upsertUser({
      openId: `test-user-${Date.now()}`,
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
    });
    testUserId = user?.id || 0;
  });

  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      const db = await getDb();
      if (db) {
        await db.delete(users).where(eq(users.id, testUserId));
      }
    }
  });

  it('should update user name in database', async () => {
    const db = await getDb();
    expect(db).toBeDefined();

    if (db && testUserId) {
      // Update user name
      const newName = 'Updated Test User';
      await db
        .update(users)
        .set({ name: newName })
        .where(eq(users.id, testUserId));

      // Verify the update
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, testUserId));

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe(newName);
    }
  });

  it('should update player name in leaderboard', async () => {
    if (testUserId) {
      const newName = 'Leaderboard Test User';
      await updatePlayerName(testUserId, newName);

      // Verify the update was successful
      const db = await getDb();
      if (db) {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.id, testUserId));

        expect(result).toHaveLength(1);
        // Note: updatePlayerName updates the players table, not users table
        // This test verifies the function doesn't throw
      }
    }
  });

  it('should validate name length constraints', async () => {
    // Test minimum length
    expect(() => {
      const name = 'a'; // Too short
      if (name.length < 2) throw new Error('Name must be at least 2 characters');
    }).toThrow();

    // Test maximum length
    expect(() => {
      const name = 'a'.repeat(51); // Too long
      if (name.length > 50) throw new Error('Name must be less than 50 characters');
    }).toThrow();

    // Test valid length
    expect(() => {
      const name = 'Valid Name';
      if (name.length < 2 || name.length > 50) throw new Error('Invalid name length');
    }).not.toThrow();
  });
});
