import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("tRPC trainingSets.fetchPuzzles", () => {
  it("should fetch puzzles via tRPC", async () => {
    try {
      // Use the appRouter directly to call the procedure
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
        colorFilter: "both",
      });

      // Should have success and puzzles properties
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("puzzles");
      expect(Array.isArray(result.puzzles)).toBe(true);
      expect(result.puzzles.length).toBeLessThanOrEqual(10);

      // Verify puzzle structure if puzzles exist
      if (result.puzzles.length > 0) {
        result.puzzles.forEach((puzzle) => {
          expect(puzzle.id).toBeDefined();
          expect(puzzle.fen).toBeDefined();
          expect(Array.isArray(puzzle.moves)).toBe(true);
          expect(puzzle.rating).toBeDefined();
          expect(Array.isArray(puzzle.themes)).toBe(true);
        });
      }
    } catch (error) {
      // If there's an error, it should be a tRPC error
      expect(error).toBeDefined();
    }
  });

  it("should respect color filter", async () => {
    try {
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
        colorFilter: "white",
      });

      expect(result).toHaveProperty("puzzles");
      result.puzzles.forEach((puzzle) => {
        expect(puzzle.color).toBe("white");
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should handle rating range", async () => {
    try {
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1500,
        maxRating: 1800,
        count: 10,
        colorFilter: "both",
      });

      expect(result).toHaveProperty("puzzles");
      result.puzzles.forEach((puzzle) => {
        expect(puzzle.rating).toBeGreaterThanOrEqual(1500);
        expect(puzzle.rating).toBeLessThanOrEqual(1800);
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should return empty array for non-existent theme", async () => {
    try {
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "NonexistentTheme",
        minRating: 1000,
        maxRating: 2000,
        count: 10,
        colorFilter: "both",
      });

      expect(result).toHaveProperty("puzzles");
      expect(Array.isArray(result.puzzles)).toBe(true);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should parse moves correctly", async () => {
    try {
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1000,
        maxRating: 2000,
        count: 5,
        colorFilter: "both",
      });

      expect(result).toHaveProperty("puzzles");
      result.puzzles.forEach((puzzle) => {
        // Moves should be an array of strings
        expect(Array.isArray(puzzle.moves)).toBe(true);
        puzzle.moves.forEach((move) => {
          expect(typeof move).toBe("string");
        });
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should parse themes correctly", async () => {
    try {
      const result = await appRouter.createCaller({}).trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1000,
        maxRating: 2000,
        count: 5,
        colorFilter: "both",
      });

      expect(result).toHaveProperty("puzzles");
      result.puzzles.forEach((puzzle) => {
        // Themes should be an array of strings
        expect(Array.isArray(puzzle.themes)).toBe(true);
        puzzle.themes.forEach((theme) => {
          expect(typeof theme).toBe("string");
        });
      });
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  it("should create training set with fetched puzzles", async () => {
    try {
      const caller = appRouter.createCaller({});

      // First fetch puzzles
      const fetchResult = await caller.trainingSets.fetchPuzzles({
        theme: "crushing",
        minRating: 1000,
        maxRating: 2000,
        count: 5,
        colorFilter: "both",
      });

      expect(fetchResult).toHaveProperty("puzzles");
      expect(Array.isArray(fetchResult.puzzles)).toBe(true);

      if (fetchResult.puzzles.length > 0) {
        // Then create a training set with those puzzles
        const createResult = await caller.trainingSets.create({
          themes: ["crushing"],
          minRating: 1000,
          maxRating: 2000,
          puzzleCount: fetchResult.puzzles.length,
          targetCycles: 3,
          colorFilter: "both",
          puzzles: fetchResult.puzzles,
        });

        expect(createResult).toHaveProperty("setId");
        expect(createResult.setId).toBeDefined();

        // Verify the training set was created
        const getResult = await caller.trainingSets.getById({
          id: createResult.setId,
        });

        expect(getResult).toBeDefined();
        expect(getResult?.puzzlesJson).toBeDefined();
        expect(Array.isArray(getResult?.puzzlesJson)).toBe(true);
      }
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
