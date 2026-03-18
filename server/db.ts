import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";
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
      sql`SELECT DISTINCT openingName FROM puzzles WHERE openingName IS NOT NULL AND openingName != '' ORDER BY openingName ASC`
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

  if (userId) {
    return db
      .select()
      .from(trainingSets)
      .where(eq(trainingSets.userId, userId))
      .orderBy(desc(trainingSets.updatedAt));
  } else if (deviceId) {
    return db
      .select()
      .from(trainingSets)
      .where(eq(trainingSets.deviceId, deviceId))
      .orderBy(desc(trainingSets.updatedAt));
  }

  return [];
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

  if (userId) {
    return db
      .select()
      .from(cycleHistory)
      .where(eq(cycleHistory.userId, userId))
      .orderBy(desc(cycleHistory.completedAt));
  } else if (deviceId) {
    return db
      .select()
      .from(cycleHistory)
      .where(eq(cycleHistory.deviceId, deviceId))
      .orderBy(desc(cycleHistory.completedAt));
  }

  return [];
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
    const result = await db.select().from(users);
    return result.length;
  } catch (error) {
    console.error("Error counting users:", error);
    return 0;
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
