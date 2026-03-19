import { eq, and, or, gte, lte, lt, desc, asc, sql, count, sum, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  puzzles,
  InsertPuzzle,
  trainingSets,
  TrainingSet,
  InsertTrainingSet,
  cycleHistory,
  InsertCycleRecord,
  openings,
  InsertOpening,
  puzzleAttempts,
  InsertPuzzleAttempt,
  globalSettings,
  promoCodes,
  InsertPromoCode,
  promoRedemptions,
  InsertPromoRedemption,
  onlineSessions,
  players,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    // Handle passwordHash separately
    if (user.passwordHash !== undefined) {
      values.passwordHash = user.passwordHash;
      updateSet.passwordHash = user.passwordHash;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    // Handle isPremium field
    if (user.isPremium !== undefined) {
      values.isPremium = user.isPremium;
      updateSet.isPremium = user.isPremium;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Puzzle queries
export async function getPuzzlesByThemeAndRating(
  theme: string,
  minRating: number,
  maxRating: number,
  limit: number = 20,
  color?: string
) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = and(
    sql`JSON_CONTAINS(${puzzles.themes}, JSON_QUOTE(${theme}))`,
    gte(puzzles.rating, minRating),
    lte(puzzles.rating, maxRating)
  );

  if (color && color !== 'both') {
    whereConditions = and(whereConditions, eq(puzzles.color, color));
  }

  return db
    .select()
    .from(puzzles)
    .where(whereConditions)
    .limit(limit);
}

// Get random puzzles by theme and rating (for training sessions)
export async function getRandomPuzzlesByThemeAndRating(
  theme: string,
  minRating: number,
  maxRating: number,
  limit: number = 20,
  color?: string
) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = and(
    sql`JSON_CONTAINS(${puzzles.themes}, JSON_QUOTE(${theme}))`,
    gte(puzzles.rating, minRating),
    lte(puzzles.rating, maxRating)
  );

  if (color && color !== 'both') {
    whereConditions = and(whereConditions, eq(puzzles.color, color));
  }

  return db
    .select()
    .from(puzzles)
    .where(whereConditions)
    .orderBy(sql`RAND()`)
    .limit(limit);
}

// Get all unique opening names
export async function getUniqueOpenings() {
  const db = await getDb();
  if (!db) return [];

  try {
    // Use raw SQL to get distinct opening names
    const result = await db.execute(
      `SELECT DISTINCT openingName FROM puzzles WHERE openingName IS NOT NULL AND openingName != '' ORDER BY openingName ASC`
    );
    
    // Extract opening names from result
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      return result[0].map((row: any) => row.openingName).filter(Boolean);
    }
    return [];
  } catch (error) {
    console.error("Error fetching unique openings:", error);
    return [];
  }
}

// Get puzzles by opening name and rating
// Get the actual rating range for an opening
export async function getOpeningRatingRange(openingName: string) {
  const db = await getDb();
  if (!db) return { min: 1000, max: 2000 };

  try {
    const result = await db.execute(
      sql`SELECT MIN(rating) as minRating, MAX(rating) as maxRating FROM puzzles WHERE openingName = ${openingName}`
    );
    
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) && result[0].length > 0) {
      const row = result[0][0];
      return {
        min: row.minRating || 1000,
        max: row.maxRating || 2000,
      };
    }
    return { min: 1000, max: 2000 };
  } catch (error) {
    console.error("Error getting opening rating range:", error);
    return { min: 1000, max: 2000 };
  }
}

export async function getPuzzlesByOpeningAndRating(
  openingName: string,
  minRating: number,
  maxRating: number,
  limit: number = 20,
  color?: string
) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = and(
    eq(puzzles.openingName, openingName),
    gte(puzzles.rating, minRating),
    lte(puzzles.rating, maxRating)
  );

  if (color && color !== 'both') {
    whereConditions = and(whereConditions, eq(puzzles.color, color));
  }

  let result = await db
    .select()
    .from(puzzles)
    .where(whereConditions)
    .limit(limit);

  // If no puzzles found, try with expanded rating range
  if (result.length === 0) {
    const ratingRange = await getOpeningRatingRange(openingName);
    whereConditions = and(
      eq(puzzles.openingName, openingName),
      gte(puzzles.rating, ratingRange.min),
      lte(puzzles.rating, ratingRange.max)
    );

    if (color && color !== 'both') {
      whereConditions = and(whereConditions, eq(puzzles.color, color));
    }

    result = await db
      .select()
      .from(puzzles)
      .where(whereConditions)
      .limit(limit);
  }

  return result;
}

// Get random puzzles by opening name and rating
export async function getRandomPuzzlesByOpeningAndRating(
  openingName: string,
  minRating: number,
  maxRating: number,
  limit: number = 20,
  color?: string
) {
  const db = await getDb();
  if (!db) return [];

  let whereConditions = and(
    eq(puzzles.openingName, openingName),
    gte(puzzles.rating, minRating),
    lte(puzzles.rating, maxRating)
  );

  if (color && color !== 'both') {
    whereConditions = and(whereConditions, eq(puzzles.color, color));
  }

  // Use selectDistinct to prevent duplicate puzzle IDs
  // This ensures each puzzle appears only once in the result set
  return db
    .selectDistinct()
    .from(puzzles)
    .where(whereConditions)
    .orderBy(sql`RAND()`)
    .limit(limit);
}

export async function getPuzzleById(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(puzzles).where(eq(puzzles.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function insertPuzzles(puzzleList: InsertPuzzle[]) {
  const db = await getDb();
  if (!db) return;
  await db.insert(puzzles).values(puzzleList).onDuplicateKeyUpdate({
    set: {
      fen: sql`VALUES(fen)`,
      moves: sql`VALUES(moves)`,
      rating: sql`VALUES(rating)`,
      themes: sql`VALUES(themes)`,
      color: sql`VALUES(color)`,
    },
  });
}

// Training set queries
export async function createTrainingSet(set: InsertTrainingSet) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(trainingSets).values(set);
  return set.id;
}

export async function getTrainingSet(id: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(trainingSets).where(eq(trainingSets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getTrainingSetsByUser(userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return [];

  // Build OR conditions to find sets by userId OR deviceId
  const conditions = [];
  if (userId) conditions.push(eq(trainingSets.userId, userId));
  if (deviceId) conditions.push(eq(trainingSets.deviceId, deviceId));

  if (conditions.length === 0) return [];

  return db
    .select()
    .from(trainingSets)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(trainingSets.updatedAt));
}

export async function updateTrainingSet(id: string, updates: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(trainingSets).set(updates).where(eq(trainingSets.id, id));
}

export async function deleteTrainingSet(id: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(trainingSets).where(eq(trainingSets.id, id));
}

// Cycle history queries
export async function createCycleRecord(record: InsertCycleRecord) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(cycleHistory).values(record);
  return result;
}

export async function getCycleHistoryByUser(userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return [];

  // Build OR conditions to find cycles by userId OR deviceId
  const conditions = [];
  if (userId) conditions.push(eq(cycleHistory.userId, userId));
  if (deviceId) conditions.push(eq(cycleHistory.deviceId, deviceId));

  if (conditions.length === 0) return [];

  return db
    .select()
    .from(cycleHistory)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(cycleHistory.completedAt));
}

export async function getCycleHistoryByTrainingSet(trainingSetId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(cycleHistory)
    .where(eq(cycleHistory.trainingSetId, trainingSetId))
    .orderBy(asc(cycleHistory.cycleNumber));
}

// Opening queries
export async function getAllOpenings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(openings).orderBy(asc(openings.name));
}

export async function insertOpenings(openingList: InsertOpening[]) {
  const db = await getDb();
  if (!db) return;
  await db.insert(openings).values(openingList).onDuplicateKeyUpdate({
    set: {
      name: sql`VALUES(name)`,
      fen: sql`VALUES(fen)`,
      ecoCode: sql`VALUES(ecoCode)`,
    },
  });
}

// Puzzle attempt queries
export async function recordPuzzleAttempt(attempt: InsertPuzzleAttempt) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(puzzleAttempts).values(attempt);
  
  // Update player stats after recording attempt
  if (attempt.userId || attempt.deviceId) {
    try {
      // Get player ID
      let playerQuery;
      if (attempt.userId) {
        playerQuery = sql`SELECT id FROM players WHERE userId = ${attempt.userId} LIMIT 1`;
      } else {
        playerQuery = sql`SELECT id FROM players WHERE deviceId = ${attempt.deviceId} AND type = 'anonymous' LIMIT 1`;
      }
      
      const playerResult = await db.execute(playerQuery);
      const playerRows = Array.isArray(playerResult) ? (Array.isArray(playerResult[0]) ? playerResult[0] : playerResult) : [];
      const player = playerRows[0];
      
      if (player?.id) {
        // Import and call updatePlayerStats from players.ts
        const { updatePlayerStats } = await import('./players');
        await updatePlayerStats(player.id);
      }
    } catch (error) {
      console.warn('[Database] Failed to update player stats after puzzle attempt:', error);
      // Don't throw - we still want to return the puzzle attempt result
    }
  }
  
  return result;
}

export async function getPuzzleAttemptsByTrainingSet(trainingSetId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(puzzleAttempts)
    .where(eq(puzzleAttempts.trainingSetId, trainingSetId))
    .orderBy(asc(puzzleAttempts.completedAt));
}

/**
 * Get all puzzle attempts for a user (by userId or deviceId)
 * Used for real-time stats aggregation
 */
export async function getPuzzleAttemptsByUser(userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (userId) conditions.push(eq(puzzleAttempts.userId, userId));
  if (deviceId) conditions.push(eq(puzzleAttempts.deviceId, deviceId));

  if (conditions.length === 0) return [];

  return db
    .select()
    .from(puzzleAttempts)
    .where(conditions.length === 1 ? conditions[0] : or(...conditions))
    .orderBy(desc(puzzleAttempts.completedAt));
}

/**
 * Get aggregated puzzle attempt stats for a user (by userId or deviceId)
 */
export async function getPuzzleAttemptStats(userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return { totalPuzzles: 0, totalCorrect: 0, totalTimeMs: 0 };

  // First get all training set IDs for this user/device
  const userSets = await getTrainingSetsByUser(userId, deviceId);
  if (userSets.length === 0) return { totalPuzzles: 0, totalCorrect: 0, totalTimeMs: 0 };

  const setIds = userSets.map((s: any) => s.id);

  // Query puzzle_attempts by training set IDs (works even if userId/deviceId are NULL in attempts)
  const result = await db
    .select({
      totalPuzzles: count(),
      totalCorrect: sum(puzzleAttempts.isCorrect),
      totalTimeMs: sum(puzzleAttempts.timeMs),
    })
    .from(puzzleAttempts)
    .where(inArray(puzzleAttempts.trainingSetId, setIds));

  return {
    totalPuzzles: Number(result[0]?.totalPuzzles || 0),
    totalCorrect: Number(result[0]?.totalCorrect || 0),
    totalTimeMs: Number(result[0]?.totalTimeMs || 0),
  };
}


/**
 * Get random puzzles from puzzles_raw table
 * Queries directly from CSV-loaded data
 */
export async function getRandomPuzzlesFromRaw(
  count: number = 25,
  minRating: number = 1000,
  maxRating: number = 2000
): Promise<any[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot fetch puzzles: database not available");
    return [];
  }

  try {
    const result = await (db as any).query(`
      SELECT 
        PuzzleId,
        FEN,
        Moves,
        Rating,
        Themes,
        OpeningTags
      FROM puzzles_raw
      WHERE Rating >= ? AND Rating <= ?
      ORDER BY RAND()
      LIMIT ?
    `, [minRating, maxRating, count]);

    if (!Array.isArray(result)) return [];

    return result.map((row: any) => ({
      id: row.PuzzleId,
      fen: row.FEN,
      moves: row.Moves ? row.Moves.split(' ') : [],
      rating: row.Rating,
      themes: row.Themes ? row.Themes.split(' ') : [],
      opening: row.OpeningTags || '',
    }));
  } catch (error) {
    console.error("[Database] Error fetching puzzles from raw:", error);
    return [];
  }
}

/**
 * Get unique opening tags from puzzles_raw
 */
export async function getUniqueOpeningsFromRaw(): Promise<string[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot fetch openings: database not available");
    return [];
  }

  try {
    const result = await (db as any).query(`
      SELECT DISTINCT OpeningTags
      FROM puzzles_raw
      WHERE OpeningTags IS NOT NULL AND OpeningTags != ''
      ORDER BY OpeningTags ASC
    `);

    if (!Array.isArray(result)) return [];

    return result
      .map((row: any) => row.OpeningTags)
      .filter((tag: string) => tag && tag.trim())
      .sort();
  } catch (error) {
    console.error("[Database] Error fetching openings:", error);
    return [];
  }
}

/**
 * Get puzzles by opening tag from puzzles_raw
 */
export async function getPuzzlesByOpeningFromRaw(
  opening: string,
  count: number = 25,
  minRating: number = 1000,
  maxRating: number = 2000
): Promise<any[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot fetch puzzles: database not available");
    return [];
  }

  try {
    // First try exact match
    let result = await (db as any).query(`
      SELECT 
        PuzzleId,
        FEN,
        Moves,
        Rating,
        Themes,
        OpeningTags
      FROM puzzles_raw
      WHERE OpeningTags LIKE ?
        AND Rating >= ? AND Rating <= ?
      ORDER BY RAND()
      LIMIT ?
    `, [`%${opening}%`, minRating, maxRating, count]);

    // If no results, try without rating filter
    if (!Array.isArray(result) || (result as any).length === 0) {
      result = await (db as any).query(`
        SELECT 
          PuzzleId,
          FEN,
          Moves,
          Rating,
          Themes,
          OpeningTags
        FROM puzzles_raw
        WHERE OpeningTags LIKE ?
        ORDER BY RAND()
        LIMIT ?
      `, [`%${opening}%`, count]);
    }

    if (!Array.isArray(result)) return [];

    return result.map((row: any) => ({
      id: row.PuzzleId,
      fen: row.FEN,
      moves: row.Moves ? row.Moves.split(' ') : [],
      rating: row.Rating,
      themes: row.Themes ? row.Themes.split(' ') : [],
      opening: row.OpeningTags || '',
    }));
  } catch (error) {
    console.error("[Database] Error fetching puzzles by opening:", error);
    return [];
  }
}


/**
 * Get user by email for login
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * Update user's password hash
 */
export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update user: database not available");
    return;
  }

  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}


/**
 * Count total number of users in database
 */
export async function countTotalUsers() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    return result[0]?.count || 0;
  } catch (error) {
    console.error("Error counting users:", error);
    return 0;
  }
}

/**
 * Count only registered users (those with email/password or OAuth)
 */
export async function countRegisteredUsers() {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.hasRegistered, 1));
    return result[0]?.count || 0;
  } catch (error) {
    console.error("Error counting registered users:", error);
    return 0;
  }
}

/**
 * Get comprehensive user analytics for the admin dashboard
 */
export async function getUserAnalytics() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, premiumUsers: 0, adminUsers: 0, activeUsers: 0, totalSessions: 0, recentSignups: 0 };

  try {
    // Use raw SQL for reliable results with TiDB
    // Exclude device-only accounts from total user count to show real sign-ins
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM users WHERE loginMethod != 'device' OR loginMethod IS NULL) as totalUsers,
        (SELECT COUNT(*) FROM users WHERE isPremium = 1) as premiumUsers,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as adminUsers,
        (SELECT COUNT(DISTINCT userId) FROM training_sets WHERE userId IS NOT NULL) as activeUsers,
        (SELECT COUNT(*) FROM training_sets) as totalSessions,
        (SELECT COUNT(*) FROM users WHERE lastSignedIn >= DATE_SUB(NOW(), INTERVAL 24 HOUR) AND (loginMethod != 'device' OR loginMethod IS NULL)) as recentSignups
    `);

    // db.execute returns [rows, fields] - extract first row
    const rows = (result as any)[0] || result;
    const row = Array.isArray(rows) ? rows[0] : rows;

    return {
      totalUsers: Number(row?.totalUsers) || 0,
      premiumUsers: Number(row?.premiumUsers) || 0,
      adminUsers: Number(row?.adminUsers) || 0,
      activeUsers: Number(row?.activeUsers) || 0,
      totalSessions: Number(row?.totalSessions) || 0,
      recentSignups: Number(row?.recentSignups) || 0,
    };
  } catch (error) {
    console.error("Error getting user analytics:", error);
    return { totalUsers: 0, premiumUsers: 0, adminUsers: 0, activeUsers: 0, totalSessions: 0, recentSignups: 0 };
  }
}

/**
 * Get all registered users
 */
export async function getAllRegisteredUsers() {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.select().from(users).where(eq(users.hasRegistered, 1));
    return result;
  } catch (error) {
    console.error("Error fetching registered users:", error);
    return [];
  }
}


/**
 * Get global settings
 */
export async function getGlobalSettings() {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.select().from(globalSettings).limit(1);
    if (result.length > 0) {
      return result[0];
    }
    // Create default settings if not found
    await db.insert(globalSettings).values({
      id: 1,
      showGiftPremiumBanner: 1,
      giftPremiumMaxUsers: 100,
    });
    return {
      id: 1,
      showGiftPremiumBanner: 1,
      giftPremiumMaxUsers: 100,
    };
  } catch (error) {
    console.error("Error getting global settings:", error);
    return null;
  }
}

/**
 * Update global settings
 */
export async function updateGlobalSettings(updates: { showGiftPremiumBanner?: number; giftPremiumMaxUsers?: number }) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.update(globalSettings)
      .set(updates)
      .where(eq(globalSettings.id, 1));
    return result;
  } catch (error) {
    console.error("Error updating global settings:", error);
    return null;
  }
}


// ==================== PROMO CODE FUNCTIONS ====================

/**
 * Get a promo code by its code string
 */
export async function getPromoCodeByCode(code: string) {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("Error getting promo code:", error);
    return null;
  }
}

/**
 * Redeem a promo code for a user/device
 */
export async function redeemPromoCode(promoCodeId: number, userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  try {
    // Get the promo code
    const promo = await db.select().from(promoCodes).where(eq(promoCodes.id, promoCodeId)).limit(1);
    if (!promo[0]) return { success: false, error: "Promo code not found" };

    const code = promo[0];

    // Check if active
    if (!code.isActive) return { success: false, error: "This promo code is no longer active" };

    // Check if expired
    if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
      return { success: false, error: "This promo code has expired" };
    }

    // Check usage limit
    if (code.currentUses >= code.maxUses) {
      return { success: false, error: "This promo code has reached its maximum number of uses" };
    }

    // Check if user already redeemed this code
    const conditions = [eq(promoRedemptions.promoCodeId, promoCodeId)];
    if (userId) conditions.push(eq(promoRedemptions.userId, userId));
    else if (deviceId) conditions.push(eq(promoRedemptions.deviceId, deviceId));

    const existing = await db.select().from(promoRedemptions).where(and(...conditions)).limit(1);
    if (existing[0]) {
      return { success: false, error: "You have already redeemed this promo code" };
    }

    // Record the redemption
    await db.insert(promoRedemptions).values({
      promoCodeId,
      userId,
      deviceId,
    });

    // Increment usage count
    await db.update(promoCodes)
      .set({ currentUses: sql`${promoCodes.currentUses} + 1` })
      .where(eq(promoCodes.id, promoCodeId));

    // If lifetime_premium, update user's isPremium status
    if (code.benefitType === "lifetime_premium" && userId) {
      await db.update(users)
        .set({ isPremium: 1 })
        .where(eq(users.id, userId));
    }

    return {
      success: true,
      benefitType: code.benefitType,
      discountPercent: code.discountPercent,
      description: code.description,
    };
  } catch (error) {
    console.error("Error redeeming promo code:", error);
    return { success: false, error: "Failed to redeem promo code" };
  }
}

/**
 * Get all promo codes (admin)
 */
export async function getAllPromoCodes() {
  const db = await getDb();
  if (!db) return [];
  try {
    return await db.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
  } catch (error) {
    console.error("Error getting promo codes:", error);
    return [];
  }
}

/**
 * Get user's redeemed promo codes
 */
export async function getUserRedemptions(userId: number | null, deviceId: string | null) {
  const db = await getDb();
  if (!db) return [];
  try {
    const conditions = [];
    if (userId) conditions.push(eq(promoRedemptions.userId, userId));
    if (deviceId) conditions.push(eq(promoRedemptions.deviceId, deviceId));
    if (conditions.length === 0) return [];

    const whereClause = conditions.length === 1 ? conditions[0] : or(...conditions);
    return await db.select().from(promoRedemptions).where(whereClause);
  } catch (error) {
    console.error("Error getting user redemptions:", error);
    return [];
  }
}


/**
 * Online session tracking functions
 */

export async function createOrUpdateOnlineSession(
  playerId: number,
  userId: number | null,
  deviceId: string | null,
  sessionId?: string
) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const finalSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const result = await db.insert(onlineSessions).values({
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      playerId,
      userId,
      deviceId,
      sessionId: finalSessionId,
      status: "active",
      lastHeartbeat: new Date(),
      startedAt: new Date(),
      createdAt: new Date(),
    }).onDuplicateKeyUpdate({
      set: {
        lastHeartbeat: new Date(),
        status: "active",
      },
    });

    return result;
  } catch (error) {
    console.error("[Database] Error creating/updating online session:", error);
    return undefined;
  }
}

export async function updateSessionHeartbeat(playerId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .update(onlineSessions)
      .set({ lastHeartbeat: new Date() })
      .where(eq(onlineSessions.playerId, playerId));

    return result;
  } catch (error) {
    console.error("[Database] Error updating session heartbeat:", error);
    return undefined;
  }
}

export async function getOnlineSessionCount(minutesActive: number = 5) {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoffTime = new Date(Date.now() - minutesActive * 60 * 1000);
    
    const result = await db
      .select({ count: sql<number>`COUNT(DISTINCT playerId)` })
      .from(onlineSessions)
      .where(
        and(
          eq(onlineSessions.status, "active"),
          gte(onlineSessions.lastHeartbeat, cutoffTime)
        )
      );

    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Error getting online session count:", error);
    return 0;
  }
}

export async function endOnlineSession(playerId: number) {
  const db = await getDb();
  if (!db) return undefined;

  try {
    const result = await db
      .update(onlineSessions)
      .set({ status: "idle" })
      .where(eq(onlineSessions.playerId, playerId));

    return result;
  } catch (error) {
    console.error("[Database] Error ending online session:", error);
    return undefined;
  }
}

export async function cleanupStaleOnlineSessions(minutesInactive: number = 30) {
  const db = await getDb();
  if (!db) return 0;

  try {
    const cutoffTime = new Date(Date.now() - minutesInactive * 60 * 1000);
    
    const result = await db
      .delete(onlineSessions)
      .where(lt(onlineSessions.lastHeartbeat, cutoffTime));

    return result;
  } catch (error) {
    console.error("[Database] Error cleaning up stale sessions:", error);
    return 0;
  }
}

/**
 * Update player name in the players table (for registered users)
 */
export async function updatePlayerName(userId: number, name: string) {
  const db = await getDb();
  if (!db) return;

  try {
    await db
      .update(players)
      .set({ name })
      .where(eq(players.userId, userId));
  } catch (error) {
    console.error("[Database] Error updating player name:", error);
  }
}

/**
 * Get count of currently online players
 */
export async function getOnlineCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: count() })
      .from(onlineSessions);
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Error getting online count:", error);
    return 0;
  }
}

/**
 * Get total number of registered players
 */
export async function getTotalPlayerCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: count() })
      .from(players);
    
    return result[0]?.count || 0;
  } catch (error) {
    console.error("[Database] Error getting total player count:", error);
    return 0;
  }
}
