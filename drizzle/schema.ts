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
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  isPremium: int("isPremium").default(0).notNull(),
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
  puzzleData: text("puzzleData"), // Full puzzle object as JSON
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  ratingIdx: index("idx_rating").on(table.rating),
  colorIdx: index("idx_color").on(table.color),
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
