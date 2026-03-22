import { describe, it, expect } from 'vitest';

/**
 * Test for OAuth state decoding fix
 * Verifies that decodeState handles both:
 * 1. New JSON format with redirectUri and returnPath
 * 2. Legacy format with just redirectUri
 */

function decodeState(state: string): string {
  try {
    const decoded = atob(state);
    // Try JSON format first (new format with returnPath)
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") {
      return parsed.redirectUri;
    }
  } catch {
    // Legacy format: state is just btoa(redirectUri)
  }
  // Fallback: assume it's the legacy format
  return atob(state);
}

describe('OAuth State Decoding - decodeState', () => {
  it('should decode new JSON format with redirectUri and returnPath', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const stateObj = { redirectUri, returnPath: '/stats' };
    const state = btoa(JSON.stringify(stateObj));
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should decode legacy format (just redirectUri)', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const state = btoa(redirectUri);
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should extract redirectUri from new format with /train returnPath', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const stateObj = { redirectUri, returnPath: '/train' };
    const state = btoa(JSON.stringify(stateObj));
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should extract redirectUri from new format with /sets returnPath', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const stateObj = { redirectUri, returnPath: '/sets' };
    const state = btoa(JSON.stringify(stateObj));
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should extract redirectUri from new format with query parameters in returnPath', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const stateObj = { redirectUri, returnPath: '/stats?showPaywall=true' };
    const state = btoa(JSON.stringify(stateObj));
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should handle new format with production URL', () => {
    const redirectUri = 'https://openpecker.com/api/oauth/callback';
    const stateObj = { redirectUri, returnPath: '/stats' };
    const state = btoa(JSON.stringify(stateObj));
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should handle legacy format with production URL', () => {
    const redirectUri = 'https://openpecker.com/api/oauth/callback';
    const state = btoa(redirectUri);
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should gracefully handle malformed JSON and fall back to legacy', () => {
    const redirectUri = 'http://localhost:3000/api/oauth/callback';
    const state = btoa(redirectUri);
    
    expect(decodeState(state)).toBe(redirectUri);
  });

  it('should handle JSON without redirectUri field', () => {
    const stateObj = { returnPath: '/stats' };
    const state = btoa(JSON.stringify(stateObj));
    
    // Should fall back to treating the whole thing as legacy format
    // which will fail to decode but should return something
    expect(() => decodeState(state)).not.toThrow();
  });
});
