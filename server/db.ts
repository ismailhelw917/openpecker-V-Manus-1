import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
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
  passwordResetTokens,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import { eq, ne, and, or, gte, lte, lt, asc, desc, count, sum, inArray, sql, like } from 'drizzle-orm';

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;

// Create a robust connection pool with keepAlive and auto-reconnect.
// The raw URL-based drizzle() call uses default pool settings which
// cause "Connection is closed" errors in production after idle timeouts.
function createPool(): mysql.Pool {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,       // Close idle connections after 60s
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000, // Send keepAlive every 10s
    supportBigNumbers: true,
  });
  console.log("[Database] Connection pool created with keepAlive enabled");
  return pool;
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _pool = createPool();
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      _pool = null;
    }
  }
  return _db;
}

// Force-recreate the DB connection if it becomes stale.
// Called by error handlers when they detect "Connection is closed" errors.
export async function resetDbConnection() {
  console.log("[Database] Resetting connection pool...");
  if (_pool) {
    try { _pool.end(); } catch { /* ignore */ }
  }
  _db = null;
  _pool = null;
  return getDb();
}

export async function upsertUser(user: InsertUser) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return null;
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
    
    // Fetch and return the upserted user
    const result = await db.select().from(users).where(eq(users.openId, user.openId)).limit(1);
    return result.length > 0 ? result[0] : null;
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
      `SELECT DISTINCT openingName FROM puzzles WHERE openingName IS NOT NULL AND openingName != '' AND openingName NOT IN ('Unclassified', 'Opening', 'Unknown') ORDER BY openingName ASC`
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

// Reverse mapping: display name → database name
const DISPLAY_TO_DB_OPENING = {
  "Alekhine's Defence": 'Alekhine',
  'Amar Opening': 'Amar',
  'Amazon Attack': 'Amazon',
  "Anderssen's Opening": 'Anderssens',
  'Australian Opening': 'Australian',
  "Barnes Opening": 'Barnes',
  'Benko Gambit': 'Benko',
  'Benoni Defence': 'Benoni',
  "Bird's Opening": 'Bird',
  'Bishops Opening': 'Bishops',
  'Blackmar-Diemer Gambit': 'Blackmar-Diemer',
  'Blumenfeld Gambit': 'Blumenfeld',
  'Bogo-Indian Defence': 'Bogo-Indian',
  'Borg Opening': 'Borg',
  'Canard Opening': 'Canard',
  'Caro-Kann Defence': 'Caro-Kann',
  'Carr Opening': 'Carr',
  'Catalan Opening': 'Catalan',
  'Center Game': 'Center',
  'Clemenz Opening': 'Clemenz',
  'Crab Opening': 'Crab',
  'Creepy Opening': 'Creepy',
  'Czech Defence': 'Czech',
  'Danish Gambit': 'Danish',
  'Duras Opening': 'Duras',
  'Dutch Defence': 'Dutch',
  'East Indian Defence': 'East',
  'Elephant Gambit': 'Elephant',
  'English Opening': 'English',
  'Englund Gambit': 'Englund',
  'Four Knights Game': 'Four',
  'French Defence': 'French',
  'Fried Liver Attack': 'Fried',
  'Gedults Opening': 'Gedults',
  'Giuoco Piano': 'Giuoco',
  'Goldsmith Game': 'Goldsmith',
  "Grob's Attack": 'Grob',
  'Grunfeld Defence': 'Grunfeld',
  'Guatemala Opening': 'Guatemala',
  'Gunderam Opening': 'Gunderam',
  'Hippopotamus Defence': 'Hippopotamus',
  'Horwitz Defence': 'Horwitz',
  'Hungarian Opening': 'Hungarian',
  'Indian Defence': 'Indian',
  'Italian Game': 'Italian',
  'Kadas Opening': 'Kadas',
  'Kangaroo Opening': 'Kangaroo',
  "King's Indian Defence": 'Kings',
  "Lasker's Opening": 'Lasker',
  'Latvian Gambit': 'Latvian',
  'Lemming Defence': 'Lemming',
  'Lion Opening': 'Lion',
  'London System': 'London',
  'Mexican Opening': 'Mexican',
  "Mieses' Opening": 'Mieses',
  "Mikenas' Opening": 'Mikenas',
  'Modern Defence': 'Modern',
  'Neo-Grunfeld Defence': 'Neo-Grunfeld',
  'Nimzo-Indian Defence': 'Nimzo-Indian',
  'Nimzo-Larsen Attack': 'Nimzo-Larsen',
  'Nimzowitsch Defence': 'Nimzowitsch',
  'Old Indian Defence': 'Old',
  "Owen's Defence": 'Owen',
  'Paleface Opening': 'Paleface',
  "Petrov's Defence": 'Petrovs',
  "Philidor's Defence": 'Philidor',
  "Pirc's Defence": 'Pirc',
  'Polish Opening': 'Polish',
  'Ponziani Opening': 'Ponziani',
  'Portuguese Opening': 'Portuguese',
  'Pseudo-Benoni': 'Pseudo',
  'Pterodactyl Defence': 'Pterodactyl',
  "Queen's Gambit": 'Queens',
  'Rapport-Jobava System': 'Rapport-Jobava',
  'Rat Defence': 'Rat',
  'Reti Opening': 'Reti',
  'Richter-Veresov Attack': 'Richter-Veresov',
  'Robatsch Defence': 'Robatsch',
  "Rubinstein's Opening": 'Rubinstein',
  'Russian Game': 'Russian',
  'Ruy López': 'Ruy',
  'Saragossa Opening': 'Saragossa',
  'Scandinavian Defence': 'Scandinavian',
  'Scotch Game': 'Scotch',
  'Semi-Slav Defence': 'Semi-Slav',
  'Sicilian Defence': 'Sicilian',
  'Slav Defence': 'Slav',
  'Sodium Attack': 'Sodium',
  'St. George Defence': 'St',
  'Tarrasch Defence': 'Tarrasch',
  'Three Knights Game': 'Three',
  'Torre Attack': 'Torre',
  'Trompowsky Attack': 'Trompowsky',
  'Unclassified': 'Unclassified',
  'Valencia Opening': 'Valencia',
  "Van't Kruijs Opening": 'Van',
  'Vienna Game': 'Vienna',
  'Wade Defence': 'Wade',
  'Ware Opening': 'Ware',
  'Yusupov-Rubinstein System': 'Yusupov-Rubinstein',
  "Zukertort's Opening": 'Zukertort',
};

export async function getRandomPuzzlesByOpeningAndRating(
  openingName: string,
  minRating: number,
  maxRating: number,
  puzzleCount: number,
  variation?: string,
  color?: string
) {
  const db = await getDb();
  if (!db) {
    console.error('[getRandomPuzzlesByOpeningAndRating] Database not available');
    return [];
  }

  console.log('[getRandomPuzzlesByOpeningAndRating] Searching:', { openingName, variation, minRating, maxRating, puzzleCount, color });

  // Convert display name to database name using reverse map
  // e.g., "Sicilian Defence" → "Sicilian"
  const dbOpeningName = DISPLAY_TO_DB_OPENING[openingName as keyof typeof DISPLAY_TO_DB_OPENING] || openingName;
  console.log('[getRandomPuzzlesByOpeningAndRating] Converted opening name to:', dbOpeningName);
  console.log('[getRandomPuzzlesByOpeningAndRating] Looking for puzzles with openingName =', dbOpeningName);

  let whereConditions = and(
    eq(puzzles.openingName, dbOpeningName),
    gte(puzzles.rating, minRating),
    lte(puzzles.rating, maxRating)
  );

  // Filter by variation using openingVariation column (LIKE match)
  if (variation && variation.trim()) {
    const variationPattern = `%${variation}%`;
    console.log('[getRandomPuzzlesByOpeningAndRating] Filtering by variation:', variation);
    console.log('[getRandomPuzzlesByOpeningAndRating] LIKE pattern:', variationPattern);
    whereConditions = and(whereConditions, like(puzzles.openingVariation, variationPattern));
  }

  if (color && color !== 'both') {
    whereConditions = and(whereConditions, eq(puzzles.color, color));
  }

  try {
    console.log('[getRandomPuzzlesByOpeningAndRating] Query params:', {
      dbOpeningName,
      minRating,
      maxRating,
      color,
      puzzleCount
    });

    // Use Drizzle ORM query builder
    let result = await db
      .select()
      .from(puzzles)
      .where(whereConditions)
      .limit(puzzleCount);
    
    console.log('[getRandomPuzzlesByOpeningAndRating] Found:', result?.length || 0, 'puzzles');
    
    // Fallback 1: no rating filter (keeps variation + color)
    if (!result || result.length === 0) {
      console.warn('[getRandomPuzzlesByOpeningAndRating] 0 results with rating filter — retrying without rating constraints');
      let fb1: any = eq(puzzles.openingName, dbOpeningName);
      if (variation && variation.trim()) fb1 = and(fb1, like(puzzles.openingVariation, `%${variation}%`));
      if (color && color !== 'both') fb1 = and(fb1, eq(puzzles.color, color));
      result = await db.select().from(puzzles).where(fb1).limit(puzzleCount);
      console.log('[getRandomPuzzlesByOpeningAndRating] Fallback-1 found:', result?.length || 0, 'puzzles');
    }

    // Fallback 2: no variation filter (keeps rating + color)
    if (!result || result.length === 0) {
      console.warn('[getRandomPuzzlesByOpeningAndRating] 0 results — retrying without variation filter');
      let fb2: any = and(eq(puzzles.openingName, dbOpeningName), gte(puzzles.rating, minRating), lte(puzzles.rating, maxRating));
      if (color && color !== 'both') fb2 = and(fb2, eq(puzzles.color, color));
      result = await db.select().from(puzzles).where(fb2).limit(puzzleCount);
      console.log('[getRandomPuzzlesByOpeningAndRating] Fallback-2 found:', result?.length || 0, 'puzzles');
    }

    // Fallback 3: opening only (no rating, no variation, no color)
    if (!result || result.length === 0) {
      console.warn('[getRandomPuzzlesByOpeningAndRating] Final fallback: opening name only');
      result = await db.select().from(puzzles).where(eq(puzzles.openingName, dbOpeningName)).limit(puzzleCount);
      console.log('[getRandomPuzzlesByOpeningAndRating] Fallback-3 found:', result?.length || 0, 'puzzles');
    }
    
    return result || [];
  } catch (error) {
    console.error('[getRandomPuzzlesByOpeningAndRating] Error:', error);
    console.error('[getRandomPuzzlesByOpeningAndRating] Stack:', (error as Error).stack);
    return [];
  }
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
  // Filter out undefined values to avoid "No values to set" error
  const cleanUpdates: Record<string, any> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value;
    }
  }
  // Always touch updatedAt so the row is marked as recently modified
  cleanUpdates.updatedAt = new Date();
  await db.update(trainingSets).set(cleanUpdates).where(eq(trainingSets.id, id));
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

export async function getPuzzleAttemptStatsForSets(trainingSetIds: string[]) {
  const db = await getDb();
  if (!db) return {};
  if (trainingSetIds.length === 0) return {};
  
  const result = await db
    .select({
      trainingSetId: puzzleAttempts.trainingSetId,
      totalAttempts: count(puzzleAttempts.id),
      totalCorrect: count(sql`CASE WHEN ${puzzleAttempts.isCorrect} = 1 THEN 1 END`),
      totalTimeMs: sum(puzzleAttempts.timeMs),
    })
    .from(puzzleAttempts)
    .where(inArray(puzzleAttempts.trainingSetId, trainingSetIds))
    .groupBy(puzzleAttempts.trainingSetId);
  
  const statsMap: Record<string, any> = {};
  result.forEach((row: any) => {
    statsMap[row.trainingSetId] = {
      totalAttempts: Number(row.totalAttempts) || 0,
      totalCorrect: Number(row.totalCorrect) || 0,
      totalTimeMs: Number(row.totalTimeMs) || 0,
      accuracy: Number(row.totalAttempts) > 0 ? (Number(row.totalCorrect) / Number(row.totalAttempts)) * 100 : null,
    };
  });
  
  return statsMap;
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

export async function getOpeningsWithPuzzleCounts() {
  const db = await getDb();
  if (!db) return [];
  
  // Get unique openings from puzzles table with counts
  const result = await db.execute(sql`
    SELECT DISTINCT openingName, COUNT(*) as puzzle_count, AVG(rating) as avg_rating 
    FROM puzzles 
    WHERE openingName IS NOT NULL 
    GROUP BY openingName 
    ORDER BY puzzle_count DESC
  `);
  
  // Extract rows from result - db.execute returns [rows, fields]
  return Array.isArray(result) ? result[0] : (result as any).rows || [];
}


/**
 * Classify all puzzles by opening variations
 * Creates Opening → Subset → Variation hierarchy
 */
export async function classifyAllPuzzlesByVariation() {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot classify puzzles: database not available");
    return { processed: 0, updated: 0, error: 'Database not available' };
  }

  try {
    // Opening classification hierarchy
    const openingHierarchy: Record<string, Record<string, string>> = {
      'Sicilian Defense': {
        'Sicilian Najdorf': 'Najdorf Variation',
        'Sicilian Accelerated Dragon': 'Accelerated Dragon',
        'Sicilian Closed': 'Closed Variation',
        'Sicilian': 'Main Line',
      },
      'Italian Game': {
        'Italian Game Giuoco Piano': 'Giuoco Piano',
        'Italian Game Two Knights Defense': 'Two Knights Defense',
        'Italian Game': 'Main Line',
      },
      'French Defense': {
        'French Defense': 'Main Line',
      },
      'Four Knights': {
        'Four Knights Game': 'Four Knights Game',
        'Four Knights Scotch': 'Scotch Game',
        'Four Knights': 'Main Line',
      },
      'Opening': {
        'Opening': 'Unclassified',
      },
    };

    // Function to classify a puzzle
    const classifyOpening = (openingName: string | null) => {
      if (!openingName) {
        return { opening: 'Opening', subset: 'Unclassified', variation: 'Unknown' };
      }

      // Check if opening name matches any known hierarchy
      for (const [mainOpening, subsets] of Object.entries(openingHierarchy)) {
        if (openingName.includes(mainOpening)) {
          // Try to find the most specific subset match
          for (const [subsetName, variation] of Object.entries(subsets)) {
            if (openingName.includes(subsetName)) {
              return { opening: mainOpening, subset: subsetName, variation };
            }
          }
          // If no subset match, use main opening
          return { opening: mainOpening, subset: mainOpening, variation: 'Main Line' };
        }
      }

      // Default classification
      return { opening: 'Opening', subset: 'Unclassified', variation: openingName || 'Unknown' };
    };

    // Get all puzzles using raw SQL
    const result = await db.execute(sql`SELECT id, openingName FROM puzzles`);
    const allPuzzles = Array.isArray(result) ? result[0] : (result as any).rows || [];
    let updated = 0;

    // Process each puzzle
    for (const puzzle of allPuzzles) {
      const classification = classifyOpening(puzzle.openingName);
      
      // Update puzzle with classification using raw SQL
      await db.execute(sql`
        UPDATE puzzles 
        SET opening = ${classification.opening}, 
            subset = ${classification.subset}, 
            variation = ${classification.variation}
        WHERE id = ${puzzle.id}
      `);
      
      updated++;
      
      if (updated % 500 === 0) {
        console.log(`[Classify] Processed ${updated}/${allPuzzles.length} puzzles`);
      }
    }

    console.log(`[Classify] Classified ${updated} puzzles`);
    return { processed: allPuzzles.length, updated, error: null };
  } catch (error) {
    console.error('[Database] Error classifying puzzles:', error);
    return { processed: 0, updated: 0, error: String(error) };
  }
}

/**
 * Get all unique opening hierarchies (Opening → Subset → Variation)
 */
export async function getOpeningHierarchy() {
  const db = await getDb();
  if (!db) return [];

  try {
    // Get distinct opening/subset/variation combinations with puzzle counts
    const result = await db.execute(sql`
      SELECT opening, subset, variation, COUNT(*) as puzzleCount
      FROM puzzles
      WHERE opening IS NOT NULL 
        AND opening != ''
        AND subset IS NOT NULL 
        AND subset != ''
        AND variation IS NOT NULL 
        AND variation != ''
      GROUP BY opening, subset, variation
      ORDER BY opening ASC, subset ASC, variation ASC
    `);

    // Extract rows from result
    const rows = Array.isArray(result) ? result[0] : (result as any).rows || [];
    return rows;
  } catch (error) {
    console.error('[Database] Error getting opening hierarchy:', error);
    return [];
  }
}

/**
 * Get puzzle count by opening hierarchy level
 */
export async function getPuzzleCountByOpeningHierarchy(
  opening?: string,
  subset?: string,
  variation?: string
) {
  const db = await getDb();
  if (!db) return 0;

  try {
    let whereConditions = [];
    // Resolve display name to DB short name (e.g. "Sicilian Defence" → "Sicilian")
    if (opening) {
      const dbName = DISPLAY_TO_DB_OPENING[opening as keyof typeof DISPLAY_TO_DB_OPENING] ?? opening;
      whereConditions.push(eq(puzzles.openingName, dbName));
    }
    if (subset) whereConditions.push(eq(puzzles.subset, subset));
    if (variation) whereConditions.push(eq(puzzles.openingVariation, variation));

    const result = await db
      .select({ count: count() })
      .from(puzzles)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    return result[0]?.count || 0;
  } catch (error) {
    console.error('[Database] Error counting puzzles by hierarchy:', error);
    return 0;
  }
}

/**
 * Get puzzles by opening hierarchy level
 */
export async function getPuzzlesByOpeningHierarchy(
  opening?: string,
  subset?: string,
  variation?: string,
  count: number = 50,
  minRating: number = 1000,
  maxRating: number = 2000
) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Build WHERE clause dynamically
    let whereConditions = [];
    whereConditions.push(gte(puzzles.rating, minRating));
    whereConditions.push(lte(puzzles.rating, maxRating));

    // Resolve display name to DB short name (e.g. "Sicilian Defence" → "Sicilian", "Queen's Gambit" → "Queens")
    if (opening) {
      const dbName = DISPLAY_TO_DB_OPENING[opening as keyof typeof DISPLAY_TO_DB_OPENING] ?? opening;
      whereConditions.push(eq(puzzles.openingName, dbName));
    }
    if (subset) whereConditions.push(eq(puzzles.subset, subset));
    if (variation) whereConditions.push(eq(puzzles.openingVariation, variation));

    const result = await db
      .select()
      .from(puzzles)
      .where(and(...whereConditions))
      .orderBy(sql`RAND()`)
      .limit(count);

    console.log(`[getPuzzlesByOpeningHierarchy] Found ${result.length} puzzles for:`, { opening, subset, variation });
    return result;
  } catch (error) {
    console.error('[Database] Error fetching puzzles by hierarchy:', error);
    return [];
  }
}


// ============================================================================
// Puzzle Difficulty and Variation Management
// ============================================================================

/**
 * Update puzzle difficulty rating
 */
export async function updatePuzzleDifficulty(puzzleId: string, difficulty: number) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(puzzles).set({ difficulty }).where(eq(puzzles.id, puzzleId));
}

/**
 * Update puzzle variations (stored as JSON)
 */
export async function updatePuzzleVariations(puzzleId: string, variations: any) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(puzzles).set({ variations }).where(eq(puzzles.id, puzzleId));
}

/**
 * Get puzzles by difficulty range
 */
export async function getPuzzlesByDifficultyRange(
  minDifficulty: number,
  maxDifficulty: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(puzzles)
    .where(
      and(
        gte(puzzles.difficulty, minDifficulty),
        lte(puzzles.difficulty, maxDifficulty)
      )
    )
    .limit(limit);
}

/**
 * Get puzzle difficulty statistics for an opening
 */
export async function getOpeningDifficultyStats(openingName: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const result = await db.execute(
      sql`SELECT 
        AVG(difficulty) as avgDifficulty,
        MIN(difficulty) as minDifficulty,
        MAX(difficulty) as maxDifficulty,
        COUNT(*) as puzzleCount
      FROM puzzles 
      WHERE openingName = ${openingName} AND difficulty IS NOT NULL`
    );
    
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0]) && result[0].length > 0) {
      return result[0][0];
    }
    return null;
  } catch (error) {
    console.error("Error getting opening difficulty stats:", error);
    return null;
  }
}

/**
 * Get puzzle variations by ID
 */
export async function getPuzzleVariations(puzzleId: string) {
  const db = await getDb();
  if (!db) return null;

  try {
    const puzzle = await getPuzzleById(puzzleId);
    if (puzzle && puzzle.variations) {
      return JSON.parse(puzzle.variations);
    }
    return null;
  } catch (error) {
    console.error("Error parsing puzzle variations:", error);
    return null;
  }
}

/**
 * Get puzzles with most variations (good for training)
 */
export async function getPuzzlesWithMostVariations(limit: number = 20) {
  const db = await getDb();
  if (!db) return [];

  try {
    const result = await db.execute(
      sql`SELECT * FROM puzzles 
        WHERE variations IS NOT NULL 
        ORDER BY JSON_LENGTH(variations) DESC 
        LIMIT ${limit}`
    );
    
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      return result[0];
    }
    return [];
  } catch (error) {
    console.error("Error getting puzzles with variations:", error);
    return [];
  }
}

/**
 * Update puzzle attempt statistics
 */
export async function updatePuzzleAttemptStats(puzzleId: string, solved: boolean) {
  const db = await getDb();
  if (!db) return;

  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle) return;

  const currentAttempts = puzzle.numAttempts || 0;
  const currentSolved = puzzle.numSolved || 0;

  await db.update(puzzles).set({
    numAttempts: currentAttempts + 1,
    numSolved: solved ? currentSolved + 1 : currentSolved,
  }).where(eq(puzzles.id, puzzleId));
}

/**
 * Get puzzle success rate
 */
export async function getPuzzleSuccessRate(puzzleId: string): Promise<number> {
  const puzzle = await getPuzzleById(puzzleId);
  if (!puzzle || !puzzle.numAttempts || puzzle.numAttempts === 0) {
    return 0;
  }
  return (puzzle.numSolved || 0) / puzzle.numAttempts;
}

/**
 * Get puzzles by success rate (for difficulty assessment)
 */
export async function getPuzzlesBySuccessRate(
  minRate: number,
  maxRate: number,
  limit: number = 20
) {
  const db = await getDb();
  if (!db) return [];

  try {
    // Use raw SQL to calculate success rate
    const result = await db.execute(
      sql`SELECT * FROM puzzles 
        WHERE numAttempts > 0 
        AND (numSolved / numAttempts) BETWEEN ${minRate} AND ${maxRate}
        ORDER BY RAND()
        LIMIT ${limit}`
    );
    
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      return result[0];
    }
    return [];
  } catch (error) {
    console.error("Error getting puzzles by success rate:", error);
    return [];
  }
}

// ==================== PASSWORD RESET TOKENS ====================

/**
 * Create a password reset token for a user
 */
export async function createPasswordResetToken(userId: number, token: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
}

/**
 * Get a valid (unused, non-expired) password reset token
 */
export async function getValidPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const now = new Date();
  const result = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.token, token),
        sql`${passwordResetTokens.expiresAt} > ${now}`,
        sql`${passwordResetTokens.usedAt} IS NULL`
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * Mark a password reset token as used
 */
export async function markPasswordResetTokenUsed(tokenId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, tokenId));
}

/**
 * Delete all password reset tokens for a user (cleanup after reset)
 */
export async function deletePasswordResetTokensByUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
}
