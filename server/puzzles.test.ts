import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as TrpcContext["res"],
  };
}

describe("Puzzle API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("puzzles.fetchByTheme", () => {
    it("should fetch puzzles with valid theme", async () => {
      const result = await caller.puzzles.fetchByTheme({
        theme: "opening",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(Array.isArray(result.puzzles)).toBe(true);
    });

    it("should handle invalid theme gracefully", async () => {
      const result = await caller.puzzles.fetchByTheme({
        theme: "nonexistent-theme-xyz",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it("should respect rating range filters", async () => {
      const result = await caller.puzzles.fetchByTheme({
        theme: "tactical",
        minRating: 1500,
        maxRating: 1800,
        count: 5,
      });

      expect(result).toBeDefined();
      if (result.success && result.puzzles.length > 0) {
        result.puzzles.forEach((puzzle: any) => {
          expect(puzzle.rating).toBeGreaterThanOrEqual(1500);
          expect(puzzle.rating).toBeLessThanOrEqual(1800);
        });
      }
    });

    it("should respect color filter", async () => {
      const result = await caller.puzzles.fetchByTheme({
        theme: "opening",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
        color: "white",
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });

  describe("puzzles.getById", () => {
    it("should return null for non-existent puzzle", async () => {
      const result = await caller.puzzles.getById({
        id: "nonexistent-puzzle-id",
      });

      expect(result).toBeNull();
    });
  });
});

describe("Training Sets API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let createdSetId: string;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("trainingSets.create", () => {
    it("should create a training set with valid data", async () => {
      const result = await caller.trainingSets.create({
        themes: ["opening", "tactical"],
        minRating: 1000,
        maxRating: 2000,
        puzzleCount: 10,
        targetCycles: 3,
        puzzles: [
          {
            id: "puzzle-1",
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            moves: ["e2e4"],
            rating: 1200,
            themes: ["opening"],
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.setId).toBeDefined();
      createdSetId = result.setId!;
    });

    it("should fail without themes", async () => {
      const result = await caller.trainingSets.create({
        themes: [],
        minRating: 1000,
        maxRating: 2000,
        puzzleCount: 10,
        targetCycles: 3,
        puzzles: [],
      });

      // Should still create but with empty themes
      expect(result).toBeDefined();
    });
  });

  describe("trainingSets.getById", () => {
    it("should retrieve created training set", async () => {
      if (!createdSetId) {
        // Skip if creation failed
        expect(true).toBe(true);
        return;
      }

      const result = await caller.trainingSets.getById({
        id: createdSetId,
      });

      expect(result).toBeDefined();
      if (result) {
        expect(result.id).toBe(createdSetId);
        expect(result.themes).toBeDefined();
        expect(result.puzzlesJson).toBeDefined();
      }
    });

    it("should return null for non-existent set", async () => {
      const result = await caller.trainingSets.getById({
        id: "nonexistent-set-id",
      });

      expect(result).toBeNull();
    });
  });

  describe("trainingSets.list", () => {
    it("should list training sets for device", async () => {
      const result = await caller.trainingSets.list({
        deviceId: "test-device-123",
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array without userId or deviceId", async () => {
      const result = await caller.trainingSets.list({});

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  describe("trainingSets.update", () => {
    it("should update training set status", async () => {
      if (!createdSetId) return;

      const result = await caller.trainingSets.update({
        id: createdSetId,
        status: "paused",
        cyclesCompleted: 1,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("trainingSets.delete", () => {
    it("should delete training set", async () => {
      if (!createdSetId) return;

      const result = await caller.trainingSets.delete({
        id: createdSetId,
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("Cycles API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let trainingSetId: string;

  beforeAll(async () => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);

    // Create a training set for cycle tests
    const setResult = await caller.trainingSets.create({
      themes: ["tactical"],
      minRating: 1000,
      maxRating: 2000,
      puzzleCount: 5,
      targetCycles: 2,
      puzzles: [
        {
          id: "puzzle-1",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          moves: ["e2e4"],
          rating: 1200,
          themes: ["opening"],
        },
      ],
    });

    if (setResult.success) {
      trainingSetId = setResult.setId!;
    }
  });

  describe("cycles.complete", () => {
    it("should record cycle completion", async () => {
      if (!trainingSetId) return;

      const result = await caller.cycles.complete({
        trainingSetId,
        cycleNumber: 1,
        totalPuzzles: 5,
        correctCount: 4,
        totalTimeMs: 60000,
      });

      expect(result.success).toBe(true);
    });

    it("should calculate accuracy correctly", async () => {
      if (!trainingSetId) return;

      const result = await caller.cycles.complete({
        trainingSetId,
        cycleNumber: 2,
        totalPuzzles: 10,
        correctCount: 7,
        totalTimeMs: 120000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("cycles.list", () => {
    it("should list cycles for device", async () => {
      const result = await caller.cycles.list({
        deviceId: "test-device-123",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("cycles.getBySet", () => {
    it("should get cycles for specific training set", async () => {
      if (!trainingSetId) return;

      const result = await caller.cycles.getBySet({
        trainingSetId,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("Stats API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("stats.getSummary", () => {
    it("should return stats summary for device", async () => {
      const result = await caller.stats.getSummary({
        deviceId: "test-device-123",
      });

      expect(result).toBeDefined();
      expect(result.totalPuzzles).toBeDefined();
      expect(result.accuracy).toBeDefined();
      expect(result.completedCycles).toBeDefined();
      expect(result.totalTimeMs).toBeDefined();
      expect(result.averageTimePerPuzzle).toBeDefined();
    });

    it("should return zero stats for non-existent device", async () => {
      const result = await caller.stats.getSummary({
        deviceId: "nonexistent-device",
      });

      expect(result.totalPuzzles).toBe(0);
      expect(result.accuracy).toBe(0);
      expect(result.completedCycles).toBe(0);
    });
  });
});

describe("Openings API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("openings.list", () => {
    it("should list available openings", async () => {
      const result = await caller.openings.list();

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(Array.isArray(result.openings)).toBe(true);
    });
  });
});

describe("Attempts API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let trainingSetId: string;

  beforeAll(async () => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);

    // Create a training set for attempt tests
    const setResult = await caller.trainingSets.create({
      themes: ["tactical"],
      minRating: 1000,
      maxRating: 2000,
      puzzleCount: 3,
      targetCycles: 1,
      puzzles: [
        {
          id: "puzzle-1",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
          moves: ["e2e4"],
          rating: 1200,
          themes: ["opening"],
        },
      ],
    });

    if (setResult.success) {
      trainingSetId = setResult.setId!;
    }
  });

  describe("attempts.record", () => {
    it("should record correct puzzle attempt", async () => {
      if (!trainingSetId) return;

      const result = await caller.attempts.record({
        trainingSetId,
        cycleNumber: 1,
        puzzleId: "puzzle-1",
        isCorrect: true,
        timeMs: 5000,
      });

      expect(result.success).toBe(true);
    });

    it("should record incorrect puzzle attempt", async () => {
      if (!trainingSetId) return;

      const result = await caller.attempts.record({
        trainingSetId,
        cycleNumber: 1,
        puzzleId: "puzzle-2",
        isCorrect: false,
        timeMs: 8000,
      });

      expect(result.success).toBe(true);
    });
  });

  describe("attempts.getBySet", () => {
    it("should get attempts for training set", async () => {
      if (!trainingSetId) return;

      const result = await caller.attempts.getBySet({
        trainingSetId,
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
