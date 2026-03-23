import { describe, it, expect, beforeAll, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock context
function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
      get: (name: string) => {
        if (name === 'host') return 'openpecker.com';
        return undefined;
      },
    } as unknown as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Puzzle API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("puzzles.getByThemeAndRating", () => {
    it("should fetch puzzles with valid theme", async () => {
      const result = await caller.puzzles.getByThemeAndRating({
        theme: "opening",
        minRating: 1000,
        maxRating: 2000,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array for nonexistent theme", async () => {
      const result = await caller.puzzles.getByThemeAndRating({
        theme: "nonexistent-theme-xyz-abc-123",
        minRating: 1000,
        maxRating: 2000,
        limit: 10,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it("should respect rating range filters", async () => {
      const result = await caller.puzzles.getByThemeAndRating({
        theme: "crushing",
        minRating: 1500,
        maxRating: 1800,
        limit: 5,
      });

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        result.forEach((puzzle: any) => {
          expect(puzzle.rating).toBeGreaterThanOrEqual(1500);
          expect(puzzle.rating).toBeLessThanOrEqual(1800);
        });
      }
    });
  });

   describe("puzzles.getById", () => {
    it("should return undefined for non-existent puzzle", async () => {
      const result = await caller.puzzles.getById({ id: "nonexistent-puzzle-id-xyz-abc-999" });
      expect(result).toBeFalsy();
    });
  });
});

describe("Training Sets API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("trainingSets.getById", () => {
    it("should return undefined for non-existent set", async () => {
      const result = await caller.trainingSets.getById({
        id: "nonexistent-set-id-xyz-123",
      });

      expect(result).toBeFalsy();
    });
  });

  describe("trainingSets.getByUser", () => {
    it("should list training sets for device", async () => {
      const result = await caller.trainingSets.getByUser({
        deviceId: "test-device-123",
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it("should return empty array for non-existent device", async () => {
      const result = await caller.trainingSets.getByUser({
        deviceId: "nonexistent-device-xyz-abc-999",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("Cycles API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("cycles.create", () => {
    it("should record cycle completion with deviceId", async () => {
      const result = await caller.cycles.create({
        deviceId: "test-device-cycles-123",
        trainingSetId: "test-set-cycles-123",
        totalPuzzles: 5,
        correctCount: 4,
        totalTimeMs: 60000,
        accuracy: 80,
      });

      expect(result).toBeDefined();
    });
  });

  describe("cycles.getByUser", () => {
    it("should list cycles for device", async () => {
      const result = await caller.cycles.getByUser({
        deviceId: "test-device-123",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("cycles.getBySet", () => {
    it("should get cycles for specific training set", async () => {
      const result = await caller.cycles.getBySet({
        trainingSetId: "nonexistent-set-xyz-123",
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

  describe("openings.getAll", () => {
    it("should list available openings", async () => {
      const result = await caller.openings.getAll();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("openings.getNames", () => {
    it("should return opening names with puzzle counts", async () => {
      const result = await caller.openings.getNames();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe("Attempts API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeAll(() => {
    const ctx = createMockContext();
    caller = appRouter.createCaller(ctx);
  });

  describe("attempts.record", () => {
    it("should record a correct puzzle attempt with deviceId", async () => {
      const result = await caller.attempts.record({
        deviceId: "test-device-attempts-123",
        trainingSetId: "test-set-attempts-123",
        puzzleId: "test-puzzle-1",
        isCorrect: true,
        timeMs: 5000,
      });
      // The procedure returns the raw DB insert result (not { success: true })
      expect(result).toBeDefined();
    });

    it("should record an incorrect puzzle attempt", async () => {
      const result = await caller.attempts.record({
        deviceId: "test-device-attempts-123",
        trainingSetId: "test-set-attempts-123",
        puzzleId: "test-puzzle-2",
        isCorrect: false,
        timeMs: 8000,
      });
      expect(result).toBeDefined();
    });
  });

  describe("attempts.getBySet", () => {
    it("should get attempts for training set", async () => {
      const result = await caller.attempts.getBySet({
        trainingSetId: "nonexistent-set-xyz-123",
      });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
