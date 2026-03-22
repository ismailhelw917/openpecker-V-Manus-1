// Simple analytics tracking using window.gtag or custom events
// This avoids Node.js dependencies and works in the browser

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

let analyticsEnabled = false;

export function initializeMatomo() {
  // Check if analytics endpoint is configured
  const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT;
  const siteId = import.meta.env.VITE_ANALYTICS_WEBSITE_ID;
  
  if (endpoint && siteId) {
    analyticsEnabled = true;
    console.log('[Analytics] Initialized with endpoint:', endpoint);
  } else {
    console.log('[Analytics] No analytics endpoint configured');
  }
}

export function setMatomoUserId(userId: number | string) {
  if (analyticsEnabled && window.gtag) {
    window.gtag('config', { 'user_id': String(userId) });
    console.log('[Analytics] User ID set:', userId);
  }
}

export function trackPageView(title: string, path: string) {
  if (analyticsEnabled && window.gtag) {
    window.gtag('pageview', {
      page_title: title,
      page_path: path,
    });
    console.log('[Analytics] Page view tracked:', title, path);
  }
}

export function trackEvent(category: string, action: string, name?: string, value?: number) {
  if (analyticsEnabled && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: name,
      value: value,
    });
    console.log('[Analytics] Event tracked:', { category, action, name, value });
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

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
