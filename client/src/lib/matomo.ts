import MatomoTracker from 'matomo-tracker';

// Initialize Matomo tracker
// Using Manus built-in analytics endpoint if available, otherwise use public Matomo instance
const MATOMO_URL = import.meta.env.VITE_ANALYTICS_ENDPOINT || 'https://analytics.example.com/';
const MATOMO_SITE_ID = import.meta.env.VITE_ANALYTICS_WEBSITE_ID || '1';

let tracker: MatomoTracker | null = null;

export function initializeMatomo() {
  try {
    tracker = new MatomoTracker({
      trackerUrl: MATOMO_URL,
      siteId: parseInt(MATOMO_SITE_ID),
      userId: undefined, // Will be set after auth
    });
    console.log('[Matomo] Analytics initialized');
  } catch (error) {
    console.warn('[Matomo] Failed to initialize:', error);
  }
}

export function setMatomoUserId(userId: number | string) {
  if (tracker) {
    tracker.setUserId(String(userId));
    console.log('[Matomo] User ID set:', userId);
  }
}

export function trackPageView(title: string, path: string) {
  if (tracker) {
    try {
      tracker.trackPageView({
        documentTitle: title,
        href: window.location.origin + path,
      });
      console.log('[Matomo] Page view tracked:', title, path);
    } catch (error) {
      console.warn('[Matomo] Failed to track page view:', error);
    }
  }
}

export function trackEvent(category: string, action: string, name?: string, value?: number) {
  if (tracker) {
    try {
      tracker.trackEvent({
        category,
        action,
        name,
        value,
      });
      console.log('[Matomo] Event tracked:', { category, action, name, value });
    } catch (error) {
      console.warn('[Matomo] Failed to track event:', error);
    }
  }
}

export function trackTrainingStart(opening: string, puzzleCount: number) {
  trackEvent('Training', 'Start', opening, puzzleCount);
}

export function trackPuzzleSolved(accuracy: number, timeMs: number) {
  trackEvent('Puzzle', 'Solved', `Accuracy: ${accuracy.toFixed(2)}%`, timeMs);
}

export function trackCycleComplete(totalPuzzles: number, correctCount: number, accuracy: number) {
  trackEvent('Cycle', 'Complete', `${totalPuzzles} puzzles`, Math.round(accuracy));
}

export function trackLeaderboardView() {
  trackPageView('Leaderboard', '/leaderboard');
}

export function trackStatsView() {
  trackPageView('Statistics', '/stats');
}

export function trackSessionStart() {
  trackEvent('Session', 'Start');
}

export function trackSessionEnd(durationMs: number) {
  trackEvent('Session', 'End', 'Session Duration', durationMs);
}
