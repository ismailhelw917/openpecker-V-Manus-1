import { 
  int, 
  mysqlEnum, 
  mysqlTable, 
  text, 
  timestamp, 
  varchar,
  decimal,
  index
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"), // For email/password login
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isPremium: int("isPremium").default(0).notNull(),
  hasRegistered: int("hasRegistered").default(0).notNull(),
  deviceId: varchar("deviceId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Puzzles table - stores puzzle metadata and FEN positions
 * Can be populated from BigQuery or local SQLite
 */
export const puzzles = mysqlTable("puzzles", {
  id: varchar("id", { length: 64 }).primaryKey(),
  fen: text("fen").notNull(),
  moves: text("moves").notNull(), // JSON array of moves or space-separated UCI moves
  rating: int("rating"),
  themes: text("themes").notNull(), // JSON array of theme strings
  color: varchar("color", { length: 10 }), // 'white' or 'black'
  openingName: varchar("openingName", { length: 255 }), // Opening name (e.g., 'Sicilian Defense')
  openingVariation: varchar("openingVariation", { length: 255 }), // Opening variation (e.g., 'Najdorf Variation')
  ecoCode: varchar("ecoCode", { length: 10 }), // ECO code (e.g., 'C20', 'E94')
  puzzleData: text("puzzleData"), // Full puzzle object as JSON
  opening: varchar("opening", { length: 255 }), // Hierarchical opening (e.g., 'Sicilian Defense')
  subset: varchar("subset", { length: 255 }), // Hierarchical subset (e.g., 'Sicilian Najdorf')
  variation: varchar("variation", { length: 255 }), // Hierarchical variation (e.g., 'Najdorf Variation')
  puzzleName: varchar("puzzleName", { length: 255 }), // Puzzle name (e.g., 'Mate in 2', 'Fork Discovery')
  subVariation: varchar("subVariation", { length: 255 }), // Sub-variation or theme (e.g., 'Queen Sacrifice', 'Back Rank Mate')
  difficulty: int("difficulty").default(1500), // Calculated difficulty rating (0-2000+)
  variations: text("variations"), // JSON tree structure of puzzle variations
  numAttempts: int("numAttempts").default(0), // Number of times puzzle has been attempted
  numSolved: int("numSolved").default(0), // Number of times puzzle has been solved
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ratingIdx: index("idx_rating").on(table.rating),
  colorIdx: index("idx_color").on(table.color),
  openingIdx: index("idx_opening").on(table.openingName),
  ecoIdx: index("idx_eco").on(table.ecoCode),
}));

export type Puzzle = typeof puzzles.$inferSelect;
export type InsertPuzzle = typeof puzzles.$inferInsert;

/**
 * Openings table - stores opening names and FEN positions
 */
export const openings = mysqlTable("openings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  fen: text("fen").notNull(),
  ecoCode: varchar("ecoCode", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Opening = typeof openings.$inferSelect;
export type InsertOpening = typeof openings.$inferInsert;

/**
 * Global settings table - stores app-wide configuration like feature flags
 */
export const globalSettings = mysqlTable("global_settings", {
  id: int("id").primaryKey().default(1), // Only one row
  showGiftPremiumBanner: int("showGiftPremiumBanner").default(1).notNull(), // 1 = show, 0 = hide
  giftPremiumMaxUsers: int("giftPremiumMaxUsers").default(100).notNull(), // Max users for gift premium
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GlobalSettings = typeof globalSettings.$inferSelect;
export type InsertGlobalSettings = typeof globalSettings.$inferInsert;

/**
 * Training sets - represents a configured training session
 * Stores parameters and puzzle list for a training session
 */
export const trainingSets = mysqlTable("training_sets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  openingName: varchar("openingName", { length: 255 }),
  openingFen: text("openingFen"),
  themes: text("themes").notNull(), // JSON array
  minRating: int("minRating").default(1000),
  maxRating: int("maxRating").default(2000),
  puzzleCount: int("puzzleCount").default(20),
  targetCycles: int("targetCycles").default(3),
  colorFilter: varchar("colorFilter", { length: 10 }).default("both"), // 'white', 'black', 'both'
  
  // Progress tracking
  status: mysqlEnum("status", ["active", "paused", "completed"]).default("active"),
  cyclesCompleted: int("cyclesCompleted").default(0),
  currentPuzzleIndex: int("currentPuzzleIndex").default(0),
  currentCycle: int("currentCycle").default(1),
  correctCount: int("correctCount").default(0),
  bestAccuracy: decimal("bestAccuracy", { precision: 5, scale: 2 }),
  totalAttempts: int("totalAttempts").default(0),
  
  // Puzzle data
  puzzlesJson: text("puzzlesJson").notNull(), // JSON array of puzzle objects
  
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastPlayedAt: timestamp("lastPlayedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_userId").on(table.userId),
  deviceIdIdx: index("idx_deviceId").on(table.deviceId),
  statusIdx: index("idx_status").on(table.status),
}));

export type TrainingSet = typeof trainingSets.$inferSelect;
export type InsertTrainingSet = typeof trainingSets.$inferInsert;

/**
 * Cycle history - tracks completion of each cycle within a training set
 */
export const cycleHistory = mysqlTable("cycle_history", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  trainingSetId: varchar("trainingSetId", { length: 64 }).notNull(),
  cycleNumber: int("cycleNumber").notNull(),
  totalPuzzles: int("totalPuzzles").notNull(),
  correctCount: int("correctCount").notNull(),
  totalTimeMs: int("totalTimeMs"),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_userId").on(table.userId),
  deviceIdIdx: index("idx_deviceId").on(table.deviceId),
  trainingSetIdIdx: index("idx_trainingSetId").on(table.trainingSetId),
}));

export type CycleRecord = typeof cycleHistory.$inferSelect;
export type InsertCycleRecord = typeof cycleHistory.$inferInsert;

/**
 * Puzzle attempts - tracks individual puzzle solving attempts
 */
export const puzzleAttempts = mysqlTable("puzzle_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  trainingSetId: varchar("trainingSetId", { length: 64 }).notNull(),
  cycleNumber: int("cycleNumber").notNull(),
  puzzleId: varchar("puzzleId", { length: 64 }).notNull(),
  isCorrect: int("isCorrect").notNull(), // 0 or 1
  timeMs: int("timeMs"),
  attemptNumber: int("attemptNumber").default(1),
  completedAt: timestamp("completedAt").defaultNow().notNull(),
}, (table) => ({
  trainingSetIdIdx: index("idx_trainingSetId").on(table.trainingSetId),
  puzzleIdIdx: index("idx_puzzleId").on(table.puzzleId),
}));

export type PuzzleAttempt = typeof puzzleAttempts.$inferSelect;
export type InsertPuzzleAttempt = typeof puzzleAttempts.$inferInsert;

/**
 * Page Views - tracks every page visit
 */
export const pageViews = mysqlTable("pageViews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  page: varchar("page", { length: 255 }).notNull(), // e.g., '/train', '/sets', '/stats'
  referrer: varchar("referrer", { length: 255 }),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  sessionId: varchar("sessionId", { length: 64 }),
  duration: int("duration"), // milliseconds spent on page
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_pageViews_userId").on(table.userId),
  deviceIdIdx: index("idx_pageViews_deviceId").on(table.deviceId),
  pageIdx: index("idx_pageViews_page").on(table.page),
  timestampIdx: index("idx_pageViews_timestamp").on(table.timestamp),
}));

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;

/**
 * Events - tracks user interactions and custom events
 */
export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  eventName: varchar("eventName", { length: 255 }).notNull(), // e.g., 'puzzle_solved', 'set_created', 'cycle_completed'
  eventCategory: varchar("eventCategory", { length: 100 }), // e.g., 'training', 'user', 'engagement'
  eventValue: varchar("eventValue", { length: 255 }),
  eventData: text("eventData"), // JSON with additional event properties
  page: varchar("page", { length: 255 }),
  sessionId: varchar("sessionId", { length: 64 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_events_userId").on(table.userId),
  deviceIdIdx: index("idx_events_deviceId").on(table.deviceId),
  eventNameIdx: index("idx_events_eventName").on(table.eventName),
  timestampIdx: index("idx_events_timestamp").on(table.timestamp),
}));

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

/**
 * Sessions - tracks user sessions
 */
export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  startTime: timestamp("startTime").defaultNow().notNull(),
  endTime: timestamp("endTime"),
  duration: int("duration"), // milliseconds
  pageCount: int("pageCount").default(0),
  eventCount: int("eventCount").default(0),
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
}, (table) => ({
  userIdIdx: index("idx_sessions_userId").on(table.userId),
  deviceIdIdx: index("idx_sessions_deviceId").on(table.deviceId),
  startTimeIdx: index("idx_sessions_startTime").on(table.startTime),
}));

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

/**
 * Daily Stats - aggregated daily statistics
 */
export const dailyStats = mysqlTable("dailyStats", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
  totalUsers: int("totalUsers").default(0),
  totalSessions: int("totalSessions").default(0),
  totalPageViews: int("totalPageViews").default(0),
  totalEvents: int("totalEvents").default(0),
  avgSessionDuration: int("avgSessionDuration").default(0), // milliseconds
  bounceRate: decimal("bounceRate", { precision: 5, scale: 2 }).default("0"), // percentage
  topPages: text("topPages"), // JSON array of {page, views}
  topEvents: text("topEvents"), // JSON array of {eventName, count}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  dateIdx: index("idx_dailyStats_date").on(table.date),
}));

export type DailyStat = typeof dailyStats.$inferSelect;
export type InsertDailyStat = typeof dailyStats.$inferInsert;

/**
 * Promo Codes - stores promotional codes with usage limits and benefits
 */
export const promoCodes = mysqlTable("promo_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  description: text("description"),
  benefitType: mysqlEnum("benefitType", ["lifetime_premium", "discount"]).notNull(),
  discountPercent: int("discountPercent"), // e.g., 80 for 80% discount
  maxUses: int("maxUses").notNull(), // Maximum consecutive uses
  currentUses: int("currentUses").default(0).notNull(),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = deactivated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  codeIdx: index("idx_promo_code").on(table.code),
}));

export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = typeof promoCodes.$inferInsert;

/**
 * Promo Code Redemptions - tracks which users redeemed which promo codes
 */
export const promoRedemptions = mysqlTable("promo_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  promoCodeId: int("promoCodeId").notNull(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  redeemedAt: timestamp("redeemedAt").defaultNow().notNull(),
}, (table) => ({
  promoCodeIdIdx: index("idx_redemption_promoCodeId").on(table.promoCodeId),
  userIdIdx: index("idx_redemption_userId").on(table.userId),
  deviceIdIdx: index("idx_redemption_deviceId").on(table.deviceId),
}));

export type PromoRedemption = typeof promoRedemptions.$inferSelect;
export type InsertPromoRedemption = typeof promoRedemptions.$inferInsert;

/**
 * Visitor Tracking - lightweight page view tracking with browser fingerprints
 * Used for accurate visitor counting (replaces inflated device-based user counts)
 */
export const visitorTracking = mysqlTable("visitor_tracking", {
  id: int("id").autoincrement().primaryKey(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  page: varchar("page", { length: 255 }).notNull(),
  referrer: varchar("referrer", { length: 512 }),
  userAgent: text("userAgent"),
  screenSize: varchar("screenSize", { length: 20 }),
  language: varchar("language", { length: 10 }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => ({
  fingerprintIdx: index("idx_vt_fingerprint").on(table.fingerprint),
  timestampIdx: index("idx_vt_timestamp").on(table.timestamp),
  pageIdx: index("idx_vt_page").on(table.page),
}));

export type VisitorTracking = typeof visitorTracking.$inferSelect;
export type InsertVisitorTracking = typeof visitorTracking.$inferInsert;

/**
 * Unified Players Table - single source of truth for all players (registered + anonymous)
 * Replaces fragmented user/device tracking across multiple tables
 */
export const players = mysqlTable("players", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"), // FK to users table (NULL for anonymous)
  deviceId: varchar("deviceId", { length: 64 }), // For anonymous players
  name: varchar("name", { length: 255 }).notNull(), // Real name or 'Guest-xxxxx'
  email: varchar("email", { length: 320 }), // Only for registered players
  type: mysqlEnum("type", ["registered", "anonymous"]).notNull(), // 'registered' = OAuth, 'anonymous' = device-based
  isPremium: int("isPremium").default(0).notNull(),
  totalPuzzles: int("totalPuzzles").default(0).notNull(),
  totalCorrect: int("totalCorrect").default(0).notNull(),
  totalTimeMs: int("totalTimeMs").default(0).notNull(),
  completedCycles: int("completedCycles").default(0).notNull(),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0"),
  rating: int("rating").default(1200).notNull(),
  lastActivityAt: timestamp("lastActivityAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_players_userId").on(table.userId),
  deviceIdIdx: index("idx_players_deviceId").on(table.deviceId),
  typeIdx: index("idx_players_type").on(table.type),
  lastActivityIdx: index("idx_players_lastActivity").on(table.lastActivityAt),
}));

export type Player = typeof players.$inferSelect;
export type InsertPlayer = typeof players.$inferInsert;

/**
 * Online Sessions - tracks currently active players in real-time
 * Used for accurate "online now" count
 */
export const onlineSessions = mysqlTable("online_sessions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  playerId: int("playerId").notNull(), // FK to players table
  userId: int("userId"), // FK to users table (for quick lookup)
  deviceId: varchar("deviceId", { length: 64 }), // For quick lookup
  sessionId: varchar("sessionId", { length: 64 }), // Training session ID (optional for general sessions)
  status: mysqlEnum("status", ["active", "paused", "idle"]).default("active").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat").defaultNow().notNull(), // Last activity timestamp
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  playerIdIdx: index("idx_online_playerId").on(table.playerId),
  userIdIdx: index("idx_online_userId").on(table.userId),
  deviceIdIdx: index("idx_online_deviceId").on(table.deviceId),
  lastHeartbeatIdx: index("idx_online_lastHeartbeat").on(table.lastHeartbeat),
  statusIdx: index("idx_online_status").on(table.status),
}));

export type OnlineSession = typeof onlineSessions.$inferSelect;
export type InsertOnlineSession = typeof onlineSessions.$inferInsert;

/**
 * User Opening Stats - Aggregated statistics per user per opening/variation
 * Macro-level data for Stats page, CSV export, and Leaderboard
 */
export const userOpeningStats = mysqlTable("user_opening_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  opening: varchar("opening", { length: 255 }).notNull(), // e.g., 'Sicilian Defence'
  variation: varchar("variation", { length: 255 }), // e.g., 'Old Sicilian'
  totalPuzzles: int("totalPuzzles").default(0).notNull(),
  correctPuzzles: int("correctPuzzles").default(0).notNull(),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0").notNull(),
  avgTimeMs: int("avgTimeMs").default(0).notNull(),
  totalTimeMs: int("totalTimeMs").default(0).notNull(),
  ratingChange: int("ratingChange").default(0), // Rating change from baseline
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index("idx_uos_userId").on(table.userId),
  deviceIdIdx: index("idx_uos_deviceId").on(table.deviceId),
  openingIdx: index("idx_uos_opening").on(table.opening),
  userOpeningIdx: index("idx_uos_user_opening").on(table.userId, table.opening),
}));

export type UserOpeningStat = typeof userOpeningStats.$inferSelect;
export type InsertUserOpeningStat = typeof userOpeningStats.$inferInsert;

/**
 * Stats Exports - Track CSV exports for users
 * Used for audit trail and download history
 */
export const statsExports = mysqlTable("stats_exports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  deviceId: varchar("deviceId", { length: 64 }),
  exportType: mysqlEnum("exportType", ["full", "opening", "monthly"]).default("full").notNull(),
  csvUrl: text("csvUrl").notNull(), // S3 presigned URL
  recordCount: int("recordCount").notNull(),
  fileSize: int("fileSize"), // bytes
  exportedAt: timestamp("exportedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"), // When presigned URL expires
}, (table) => ({
  userIdIdx: index("idx_se_userId").on(table.userId),
  deviceIdIdx: index("idx_se_deviceId").on(table.deviceId),
  exportedAtIdx: index("idx_se_exportedAt").on(table.exportedAt),
}));

export type StatsExport = typeof statsExports.$inferSelect;
export type InsertStatsExport = typeof statsExports.$inferInsert;
