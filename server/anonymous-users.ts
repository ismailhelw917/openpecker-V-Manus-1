/**
 * Anonymous user account creation and management
 * Creates and manages accounts for device-based users
 */

import { getDb } from "./db";
import { users } from "../drizzle/schema";
import type { User } from "../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Get or create an anonymous user account for a device ID
 * @param deviceId - Unique device identifier
 * @returns User object with auto-generated anonymous account
 */
export async function getOrCreateAnonymousUser(deviceId: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Check if user already exists for this device ID
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // Create new anonymous user account
    const anonymousName = `Guest-${deviceId.substring(0, 8)}`;
    const anonymousEmail = `device-${deviceId}@anonymous.local`;
    const openId = `device-${deviceId}`;

    await db
      .insert(users)
      .values({
        openId: openId,
        name: anonymousName,
        email: anonymousEmail,
        deviceId: deviceId,
        loginMethod: "device",
        role: "user",
        isPremium: 0,
        hasRegistered: 0,
      });

    // Return the created user
    const createdUser = await db
      .select()
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);

    return createdUser[0];
  } catch (error) {
    console.error("[ANONYMOUS USER ERROR]", error);
    throw error;
  }
}

/**
 * Link a device ID to a registered user account
 * Called when user registers/logs in
 * @param userId - Registered user ID
 * @param deviceId - Device ID to link
 */
export async function linkDeviceToUser(userId: number, deviceId: string) {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    await db
      .update(users)
      .set({
        deviceId: deviceId,
        hasRegistered: 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return true;
  } catch (error) {
    console.error("[LINK DEVICE ERROR]", error);
    throw error;
  }
}

/**
 * Get user by device ID
 * @param deviceId - Device identifier
 */
export async function getUserByDeviceId(deviceId: string) {
  try {
    const db = await getDb();
    if (!db) return null;

    const result = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("[GET USER BY DEVICE ERROR]", error);
    return null;
  }
}

/**
 * Get all users (registered + anonymous)
 * @param limit - Maximum number of users to return
 */
export async function getAllUsers(limit: number = 1000) {
  try {
    const db = await getDb();
    if (!db) return [];

    const allUsers = await db
      .select()
      .from(users)
      .limit(limit);

    return allUsers;
  } catch (error) {
    console.error("[GET ALL USERS ERROR]", error);
    return [];
  }
}

/**
 * Get user count (registered + anonymous)
 */
export async function getUserCount() {
  try {
    const db = await getDb();
    if (!db) return 0;

    const result = await db
      .select()
      .from(users);

    return result.length;
  } catch (error) {
    console.error("[GET USER COUNT ERROR]", error);
    return 0;
  }
}
