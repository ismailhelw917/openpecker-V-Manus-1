import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initializeMatomo,
  setMatomoUserId,
  trackPageView,
  trackEvent,
  trackTrainingStart,
  trackPuzzleSolved,
  trackCycleComplete,
  trackLeaderboardView,
  trackStatsView,
  trackSessionStart,
  trackSessionEnd,
} from './matomo';

// Mock MatomoTracker
vi.mock('matomo-tracker', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setUserId: vi.fn(),
      trackPageView: vi.fn(),
      trackEvent: vi.fn(),
    })),
  };
});

describe('Matomo Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize Matomo tracker', () => {
    expect(() => {
      initializeMatomo();
    }).not.toThrow();
  });

  it('should set user ID', () => {
    initializeMatomo();
    expect(() => {
      setMatomoUserId(123);
    }).not.toThrow();
  });

  it('should track page views', () => {
    initializeMatomo();
    expect(() => {
      trackPageView('Test Page', '/test');
    }).not.toThrow();
  });

  it('should track events', () => {
    initializeMatomo();
    expect(() => {
      trackEvent('Category', 'Action', 'Name', 100);
    }).not.toThrow();
  });

  it('should track training start events', () => {
    initializeMatomo();
    expect(() => {
      trackTrainingStart('Sicilian Defence', 50);
    }).not.toThrow();
  });

  it('should track puzzle solved events', () => {
    initializeMatomo();
    expect(() => {
      trackPuzzleSolved(95.5, 45000);
    }).not.toThrow();
  });

  it('should track cycle completion events', () => {
    initializeMatomo();
    expect(() => {
      trackCycleComplete(50, 45, 90);
    }).not.toThrow();
  });

  it('should track leaderboard views', () => {
    initializeMatomo();
    expect(() => {
      trackLeaderboardView();
    }).not.toThrow();
  });

  it('should track stats views', () => {
    initializeMatomo();
    expect(() => {
      trackStatsView();
    }).not.toThrow();
  });

  it('should track session start events', () => {
    initializeMatomo();
    expect(() => {
      trackSessionStart();
    }).not.toThrow();
  });

  it('should track session end events', () => {
    initializeMatomo();
    expect(() => {
      trackSessionEnd(3600000);
    }).not.toThrow();
  });

  it('should handle multiple tracking calls gracefully', () => {
    initializeMatomo();
    
    expect(() => {
      setMatomoUserId(456);
      trackSessionStart();
      trackTrainingStart('Ruy Lopez', 100);
      trackPuzzleSolved(100, 30000);
      trackCycleComplete(100, 100, 100);
      trackLeaderboardView();
      trackSessionEnd(5400000);
    }).not.toThrow();
  });

  it('should handle initialization failures gracefully', () => {
    // This tests that initialization doesn't crash even if Matomo is unavailable
    expect(() => {
      initializeMatomo();
      trackEvent('Test', 'Event');
    }).not.toThrow();
  });
});
