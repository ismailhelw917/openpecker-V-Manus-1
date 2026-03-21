import { describe, it, expect, beforeEach } from "vitest";
import { getGoogleAuthUrl } from "./_core/google-oauth";

/**
 * Test Google OAuth flow
 */
describe("Google OAuth Flow", () => {
  beforeEach(() => {
    // Set environment variables for testing
    process.env.NODE_ENV = "development";
  });

  it("should generate valid Google auth URL", () => {
    const authUrl = getGoogleAuthUrl("/train");
    
    expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authUrl).toContain("client_id=");
    expect(authUrl).toContain("redirect_uri=");
    expect(authUrl).toContain("response_type=code");
    expect(authUrl).toContain("scope=openid+email+profile");
    expect(authUrl).toContain("state=");
    expect(authUrl).toContain("access_type=offline");
  });

  it("should encode return path in state parameter", () => {
    const returnPath = "/train";
    const authUrl = getGoogleAuthUrl(returnPath);
    
    // Extract state parameter
    const stateMatch = authUrl.match(/state=([^&]+)/);
    expect(stateMatch).toBeTruthy();
    
    if (stateMatch) {
      const state = decodeURIComponent(stateMatch[1]);
      const stateObj = JSON.parse(atob(state));
      expect(stateObj.returnPath).toBe(returnPath);
    }
  });

  it("should use correct redirect URI for development", () => {
    process.env.NODE_ENV = "development";
    const authUrl = getGoogleAuthUrl();
    
    expect(authUrl).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Foauth%2Fgoogle%2Fcallback");
  });

  it("should use correct redirect URI for production", () => {
    process.env.NODE_ENV = "production";
    const authUrl = getGoogleAuthUrl();
    
    expect(authUrl).toContain("redirect_uri=https%3A%2F%2Fopenpecker.com%2Fapi%2Foauth%2Fgoogle%2Fcallback");
  });

  it("should default to root path when no return path provided", () => {
    const authUrl = getGoogleAuthUrl();
    
    const stateMatch = authUrl.match(/state=([^&]+)/);
    expect(stateMatch).toBeTruthy();
    
    if (stateMatch) {
      const state = decodeURIComponent(stateMatch[1]);
      const stateObj = JSON.parse(atob(state));
      expect(stateObj.returnPath).toBe("/");
    }
  });

  it("should include Google Client ID in auth URL", () => {
    const authUrl = getGoogleAuthUrl();
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    expect(authUrl).toContain(`client_id=${encodeURIComponent(clientId || "")}`);
  });
});
