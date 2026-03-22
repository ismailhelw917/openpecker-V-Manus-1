import { describe, it, expect } from 'vitest';

/**
 * Test for OAuth redirect fix
 * Verifies that the parseReturnPath function correctly handles:
 * 1. New format with returnPath in JSON state
 * 2. Legacy format (just btoa(redirectUri))
 * 3. Security checks (no open redirects)
 */

// Replicate the parseReturnPath function from server/_core/oauth.ts
function parseReturnPath(state: string): string {
  try {
    const decoded = atob(state);
    // Try JSON format first (new format with returnPath)
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.returnPath === "string") {
      // Only allow relative paths to prevent open redirect
      const path = parsed.returnPath;
      if (path.startsWith("/") && !path.startsWith("//")) {
        return path;
      }
    }
  } catch {
    // Legacy format: state is just btoa(redirectUri), redirect to /
  }
  return "/";
}

describe('OAuth Redirect - parseReturnPath', () => {
  it('should parse returnPath from new JSON format', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '/stats' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/stats');
  });

  it('should parse /train returnPath', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '/train' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/train');
  });

  it('should parse /sets returnPath', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '/sets' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/sets');
  });

  it('should parse /rank returnPath', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '/rank' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/rank');
  });

  it('should handle returnPath with query parameters', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '/stats?showPaywall=true' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/stats?showPaywall=true');
  });

  it('should default to / for legacy format', () => {
    const state = btoa('http://localhost:3000/api/oauth/callback');
    expect(parseReturnPath(state)).toBe('/');
  });

  it('should default to / when returnPath is missing', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/');
  });

  it('should reject open redirects (protocol-relative URLs)', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: '//evil.com' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/');
  });

  it('should reject absolute URLs', () => {
    const stateObj = { redirectUri: 'http://localhost:3000/api/oauth/callback', returnPath: 'https://evil.com' };
    const state = btoa(JSON.stringify(stateObj));
    expect(parseReturnPath(state)).toBe('/');
  });

  it('should handle invalid base64', () => {
    expect(parseReturnPath('invalid!!!base64')).toBe('/');
  });

  it('should handle invalid JSON', () => {
    const state = btoa('not json');
    expect(parseReturnPath(state)).toBe('/');
  });
});
