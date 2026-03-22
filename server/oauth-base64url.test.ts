import { describe, it, expect } from 'vitest';

/**
 * Test for URL-safe base64 state encoding fix
 * Verifies that state encoding/decoding handles URL-safe base64 correctly
 * and doesn't lose data due to + / = character corruption
 */

function encodeStateBase64Url(obj: any): string {
  const json = JSON.stringify(obj);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function decodeStateBase64Url(state: string): any {
  try {
    const urlSafeBase64 = state.replace(/-/g, '+').replace(/_/g, '/');
    const padded = urlSafeBase64 + '='.repeat((4 - (urlSafeBase64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

describe('OAuth Base64URL Encoding - URL-safe state parameter', () => {
  it('should encode and decode state with redirectUri and returnPath', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback', 
      returnPath: '/stats' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('should not contain + / = characters in encoded state', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback', 
      returnPath: '/train' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });

  it('should handle special characters in returnPath', () => {
    const stateObj = { 
      redirectUri: 'https://openpecker.com/api/oauth/callback', 
      returnPath: '/stats?showPaywall=true&tab=overview' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('should handle production URLs', () => {
    const stateObj = { 
      redirectUri: 'https://openpecker.com/api/oauth/callback', 
      returnPath: '/rank' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('should handle complex JSON with nested data', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback',
      returnPath: '/sets',
      metadata: { timestamp: Date.now() }
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded.redirectUri).toBe(stateObj.redirectUri);
    expect(decoded.returnPath).toBe(stateObj.returnPath);
    expect(decoded.metadata).toBeDefined();
  });

  it('should survive URL encoding/decoding cycle', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback', 
      returnPath: '/stats' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    
    // Simulate URL encoding (as would happen in query params)
    const urlEncoded = encodeURIComponent(encoded);
    const urlDecoded = decodeURIComponent(urlEncoded);
    
    const decoded = decodeStateBase64Url(urlDecoded);
    expect(decoded).toEqual(stateObj);
  });

  it('should handle manus.space domain', () => {
    const stateObj = { 
      redirectUri: 'https://openpecker-eorxrxcp.manus.space/api/oauth/callback', 
      returnPath: '/train' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('should handle ephemeral dev URLs', () => {
    const stateObj = { 
      redirectUri: 'https://3000-i8ygrqe2k0jmuzvhglep3-9facd3d1.sg1.manus.computer/api/oauth/callback', 
      returnPath: '/sets' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('should handle empty returnPath', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback', 
      returnPath: '/' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    const decoded = decodeStateBase64Url(encoded);
    
    expect(decoded).toEqual(stateObj);
  });

  it('encoded state should be URL-safe (no special chars)', () => {
    const stateObj = { 
      redirectUri: 'http://localhost:3000/api/oauth/callback', 
      returnPath: '/stats' 
    };
    const encoded = encodeStateBase64Url(stateObj);
    
    // Should only contain alphanumeric, -, and _
    expect(/^[A-Za-z0-9_-]*$/.test(encoded)).toBe(true);
  });
});
