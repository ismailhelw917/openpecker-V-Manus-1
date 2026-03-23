import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getOrCreateAnonymousUser, getUserByDeviceId, getAllUsers, getUserCount } from "./anonymous-users";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Anonymous User Management", () => {
  let testDeviceId: string;
  let db: any;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }
    testDeviceId = `test-device-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  });

  afterAll(async () => {
    // Clean up test data
    if (db && testDeviceId) {
      try {
        await db
          .delete(users)
          .where(eq(users.deviceId, testDeviceId));
      } catch (error) {
        console.log("Cleanup error (non-critical):", error);
      }
    }
  });

  it("should create an anonymous user account for a new device ID", async () => {
    const user = await getOrCreateAnonymousUser(testDeviceId);
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.deviceId).toBe(testDeviceId);
    expect(user.name).toContain("Guest-");
    expect(user.loginMethod).toBe("device");
    expect(user.isPremium).toBe(0);
    expect(user.hasRegistered).toBe(0);
  });

  it("should return existing user for same device ID (idempotent)", async () => {
    const user1 = await getOrCreateAnonymousUser(testDeviceId);
    const user2 = await getOrCreateAnonymousUser(testDeviceId);
    
    expect(user1.id).toBe(user2.id);
    expect(user1.deviceId).toBe(user2.deviceId);
  });

  it("should retrieve user by device ID", async () => {
    await getOrCreateAnonymousUser(testDeviceId);
    const user = await getUserByDeviceId(testDeviceId);
    
    expect(user).toBeDefined();
    expect(user?.deviceId).toBe(testDeviceId);
    expect(user?.loginMethod).toBe("device");
  });

  it("should return null for non-existent device ID", async () => {
    const nonExistentId = `non-existent-${Date.now()}`;
    const user = await getUserByDeviceId(nonExistentId);
    
    expect(user).toBeNull();
  });

  it("should retrieve all users", async () => {
    await getOrCreateAnonymousUser(testDeviceId);
    const allUsers = await getAllUsers(1000);
    
    expect(Array.isArray(allUsers)).toBe(true);
    expect(allUsers.length).toBeGreaterThan(0);
    
    // Verify the test user can be found via getUserByDeviceId
    // (getAllUsers may not include our test user if there are >1000 users)
    const foundUser = await getUserByDeviceId(testDeviceId);
    expect(foundUser).toBeDefined();
    expect(foundUser?.deviceId).toBe(testDeviceId);
  });

  it("should count total users", async () => {
    await getOrCreateAnonymousUser(testDeviceId);
    const count = await getUserCount();
    
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("should generate unique openId for anonymous users", async () => {
    const user = await getOrCreateAnonymousUser(testDeviceId);
    
    expect(user.openId).toBeDefined();
    expect(user.openId).toContain("device-");
    expect(user.openId).toBe(`device-${testDeviceId}`);
  });

  it("should handle multiple device IDs independently", async () => {
    const deviceId1 = `test-device-1-${Date.now()}`;
    const deviceId2 = `test-device-2-${Date.now()}`;
    
    const user1 = await getOrCreateAnonymousUser(deviceId1);
    const user2 = await getOrCreateAnonymousUser(deviceId2);
    
    expect(user1.id).not.toBe(user2.id);
    expect(user1.deviceId).toBe(deviceId1);
    expect(user2.deviceId).toBe(deviceId2);
    
    // Clean up
    if (db) {
      try {
        await db.delete(users).where(eq(users.deviceId, deviceId1));
        await db.delete(users).where(eq(users.deviceId, deviceId2));
      } catch (error) {
        console.log("Cleanup error (non-critical):", error);
      }
    }
  });
});
