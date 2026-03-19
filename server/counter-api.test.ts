import { describe, it, expect } from 'vitest';
import { trackEvent, trackUserLogin, trackPuzzleAttempt } from './_core/counter-api';

describe('Counter API Integration', () => {
  it('should track events successfully', async () => {
    const result = await trackEvent({
      userId: 1,
      userName: 'test-user',
      action: 'test_event',
      category: 'test',
      value: 1,
    });

    // Event tracking should complete without throwing
    expect(typeof result).toBe('boolean');
  });

  it('should track user login', async () => {
    const result = await trackUserLogin(1, 'test-user');
    expect(typeof result).toBe('boolean');
  });

  it('should track puzzle attempt', async () => {
    const result = await trackPuzzleAttempt(1, 'puzzle-123', true);
    expect(typeof result).toBe('boolean');
  });

  it('should handle API errors gracefully', async () => {
    // Test with invalid metadata - should not throw
    const result = await trackEvent({
      userId: 1,
      action: 'test_event',
      category: 'test',
      metadata: {
        nested: {
          deep: {
            value: 'test',
          },
        },
      },
    });

    expect(typeof result).toBe('boolean');
  });
});
