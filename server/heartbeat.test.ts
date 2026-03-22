import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "./db";
import { sql } from "drizzle-orm";

describe("Heartbeat and Active Sessions", () => {
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }
  });

  it("should create active session on heartbeat", async () => {
    const sessionId = `test-session-${Date.now()}`;
    const name = "Test Player";
    const email = "test@example.com";

    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${sessionId}, ${name}, ${email}, 0, '/leaderboard', 'device-123', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      lastActive = NOW()
    `);

    const result = await db.execute(sql`
      SELECT * FROM active_sessions WHERE id = ${sessionId}
    `);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe(name);
  });

  it("should update active session on duplicate heartbeat", async () => {
    const sessionId = `test-session-${Date.now()}`;
    const name1 = "Player 1";
    const name2 = "Player 2";

    // First insert
    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${sessionId}, ${name1}, 'player1@example.com', 0, '/train', 'device-123', NOW(), NOW())
    `);

    // Update with duplicate key
    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${sessionId}, ${name2}, 'player2@example.com', 0, '/leaderboard', 'device-123', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      currentPath = VALUES(currentPath),
      lastActive = NOW()
    `);

    const result = await db.execute(sql`
      SELECT * FROM active_sessions WHERE id = ${sessionId}
    `);

    expect(result[0].name).toBe(name2);
    expect(result[0].currentPath).toBe('/leaderboard');
  });

  it("should retrieve active sessions within 60 seconds", async () => {
    const sessionId = `active-${Date.now()}`;

    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${sessionId}, 'Active Player', 'active@example.com', 0, '/leaderboard', 'device-123', NOW(), NOW())
    `);

    const result = await db.execute(sql`
      SELECT * FROM active_sessions
      WHERE lastActive > DATE_SUB(NOW(), INTERVAL 60 SECOND)
      AND id = ${sessionId}
    `);

    expect(result.length).toBeGreaterThan(0);
  });

  it("should not retrieve inactive sessions older than 60 seconds", async () => {
    const sessionId = `inactive-${Date.now()}`;

    // Insert with old timestamp
    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${sessionId}, 'Inactive Player', 'inactive@example.com', 0, '/train', 'device-123', DATE_SUB(NOW(), INTERVAL 120 SECOND), DATE_SUB(NOW(), INTERVAL 120 SECOND))
    `);

    const result = await db.execute(sql`
      SELECT * FROM active_sessions
      WHERE lastActive > DATE_SUB(NOW(), INTERVAL 60 SECOND)
      AND id = ${sessionId}
    `);

    expect(result.length).toBe(0);
  });

  it("should distinguish between guest and registered users", async () => {
    const guestId = `guest-${Date.now()}`;
    const userId = `user-${Date.now()}`;

    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${guestId}, 'Guest Player', '', 1, '/train', 'device-123', NOW(), NOW())
    `);

    await db.execute(sql`
      INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
      VALUES (${userId}, 'Registered User', 'user@example.com', 0, '/leaderboard', 'device-456', NOW(), NOW())
    `);

    const guests = await db.execute(sql`
      SELECT * FROM active_sessions WHERE isGuest = 1 AND id = ${guestId}
    `);

    const users = await db.execute(sql`
      SELECT * FROM active_sessions WHERE isGuest = 0 AND id = ${userId}
    `);

    expect(guests.length).toBeGreaterThan(0);
    expect(guests[0].isGuest).toBe(1);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0].isGuest).toBe(0);
  });
});
