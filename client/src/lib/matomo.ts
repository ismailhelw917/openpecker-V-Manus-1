// Analytics tracking via Google Analytics (gtag loaded in index.html)
// The analyticsEnabled flag was previously blocking all events because
// VITE_ANALYTICS_ENDPOINT (Matomo) was never configured.
// GA is always available via window.gtag — use it directly.

export function initializeMatomo() {
  // No-op: GA is initialized via the gtag script in index.html
  console.log('[Analytics] GA ready via window.gtag');
}

export function setMatomoUserId(userId: number | string) {
  if (window.gtag) {
    window.gtag('config', 'G-7LXNZ8ZS5D', { user_id: String(userId) });
  }
}

export function trackPageView(title: string, path: string) {
  if (window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: title,
      page_path: path,
    });
  }
}

export function trackEvent(category: string, action: string, name?: string, value?: number) {
  if (window.gtag) {
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
