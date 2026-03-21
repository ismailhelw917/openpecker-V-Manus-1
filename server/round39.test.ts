import { describe, it, expect } from "vitest";

// Test the parseReturnPath logic (mirrors the server-side function)
function parseReturnPath(state: string): string {
  try {
    const decoded = atob(state);
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.returnPath === "string") {
      const path = parsed.returnPath;
      if (path.startsWith("/") && !path.startsWith("//")) {
        return path;
      }
    }
  } catch {
    // Legacy format
  }
  return "/";
}

describe("OAuth return path parsing", () => {
  it("should parse returnPath from new JSON state format", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.com/api/oauth/callback", returnPath: "/train" }));
    expect(parseReturnPath(state)).toBe("/train");
  });

  it("should default to / when returnPath is /", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.com/api/oauth/callback", returnPath: "/" }));
    expect(parseReturnPath(state)).toBe("/");
  });

  it("should handle legacy state format (just btoa of redirectUri)", () => {
    const state = btoa("https://example.com/api/oauth/callback");
    expect(parseReturnPath(state)).toBe("/");
  });

  it("should reject absolute URLs to prevent open redirect", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.com/api/oauth/callback", returnPath: "https://evil.com" }));
    expect(parseReturnPath(state)).toBe("/");
  });

  it("should reject protocol-relative URLs", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.com/api/oauth/callback", returnPath: "//evil.com" }));
    expect(parseReturnPath(state)).toBe("/");
  });

  it("should handle /settings return path", () => {
    const state = btoa(JSON.stringify({ redirectUri: "https://example.com/api/oauth/callback", returnPath: "/settings" }));
    expect(parseReturnPath(state)).toBe("/settings");
  });

  it("should handle invalid base64 gracefully", () => {
    expect(parseReturnPath("not-valid-base64!!!")).toBe("/");
  });
});

describe("Premium opening lock logic", () => {
  const openings = [
    { opening: "Sicilian Defence", puzzleCount: 500 },
    { opening: "French Defence", puzzleCount: 400 },
    { opening: "Italian Game", puzzleCount: 350 },
    { opening: "Ruy Lopez", puzzleCount: 300 },
    { opening: "Queen's Gambit", puzzleCount: 250 },
    { opening: "King's Indian", puzzleCount: 200 },
    { opening: "Caro-Kann", puzzleCount: 180 },
    { opening: "English Opening", puzzleCount: 150 },
    { opening: "Dutch Defence", puzzleCount: 120 },
    { opening: "Pirc Defence", puzzleCount: 100 },
    { opening: "Scandinavian", puzzleCount: 80 },
    { opening: "Alekhine Defence", puzzleCount: 60 },
  ];

  const freeOpeningLimit = Math.max(Math.ceil(openings.length * 0.25), 5);

  const isOpeningLocked = (openingName: string, isPremium: boolean): boolean => {
    if (isPremium) return false;
    const index = openings.findIndex(o => o.opening === openingName);
    return index >= freeOpeningLimit;
  };

  it("should allow first 25% of openings for free users (minimum 5)", () => {
    // 12 openings * 0.25 = 3, but minimum is 5
    expect(freeOpeningLimit).toBe(5);
  });

  it("should not lock first 5 openings for free users", () => {
    expect(isOpeningLocked("Sicilian Defence", false)).toBe(false);
    expect(isOpeningLocked("French Defence", false)).toBe(false);
    expect(isOpeningLocked("Italian Game", false)).toBe(false);
    expect(isOpeningLocked("Ruy Lopez", false)).toBe(false);
    expect(isOpeningLocked("Queen's Gambit", false)).toBe(false);
  });

  it("should lock openings beyond the free limit for free users", () => {
    expect(isOpeningLocked("King's Indian", false)).toBe(true);
    expect(isOpeningLocked("Caro-Kann", false)).toBe(true);
    expect(isOpeningLocked("English Opening", false)).toBe(true);
  });

  it("should not lock any openings for premium users", () => {
    expect(isOpeningLocked("King's Indian", true)).toBe(false);
    expect(isOpeningLocked("Caro-Kann", true)).toBe(false);
    expect(isOpeningLocked("English Opening", true)).toBe(false);
    expect(isOpeningLocked("Alekhine Defence", true)).toBe(false);
  });
});
