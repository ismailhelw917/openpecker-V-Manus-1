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
  moves: text("moves").notNull(), // JSON array of moves
  rating: int("rating"),
  themes: text("themes").notNull(), // JSON array of theme strings
  color: varchar("color", { length: 10 }), // 'white' or 'black'
  openingName: varchar("openingName", { length: 255 }), // Opening name (e.g., 'Sicilian Defense')
  openingVariation: varchar("openingVariation", { length: 255 }), // Opening variation (e.g., 'Najdorf Variation')
  puzzleData: text("puzzleData"), // Full puzzle object as JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ratingIdx: index("idx_rating").on(table.rating),
  colorIdx: index("idx_color").on(table.color),
  openingIdx: index("idx_opening").on(table.openingName),
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
