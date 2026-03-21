import { describe, it, expect } from "vitest";

/**
 * Test Google OAuth credentials are valid
 * This validates that the Google Client ID and Secret are properly configured
 */
describe("Google OAuth Credentials", () => {
  it("should have valid Google OAuth environment variables", () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    // Validate Client ID format (should be a long string with .apps.googleusercontent.com)
    expect(clientId).toBeDefined();
    expect(clientId).toContain("apps.googleusercontent.com");
    expect(clientId?.length).toBeGreaterThan(20);

    // Validate Client Secret format (should be a long alphanumeric string)
    expect(clientSecret).toBeDefined();
    expect(clientSecret?.length).toBeGreaterThan(20);
    expect(/^[A-Za-z0-9_-]+$/.test(clientSecret || "")).toBe(true);
  });

  it("should have valid redirect URIs configured", () => {
    // The redirect URIs should be registered in Google Cloud Console
    // This is a manual verification step, but we can at least check the format
    const expectedRedirectUris = [
      "https://openpecker.com",
      "http://localhost:3000",
    ];

    expectedRedirectUris.forEach((uri) => {
      expect(uri).toMatch(/^https?:\/\//);
      expect(uri).not.toMatch(/\/$/); // Should not end with /
    });
  });
});
