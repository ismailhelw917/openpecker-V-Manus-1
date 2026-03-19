/**
 * Counter API Integration for User Tracking
 * https://counter.dev/
 */

const COUNTER_API_KEY = process.env.COUNTER_API_KEY || 'ut_RDvVPl9tOkYq9NfLPSNz8lZmOSI6pUTI0iXa7pAb';
const COUNTER_API_URL = 'https://api.counter.dev/v1/events';

export interface TrackingEvent {
  userId?: string | number;
  userName?: string;
  action: string;
  category?: string;
  value?: string | number;
  metadata?: Record<string, any>;
}

/**
 * Track user events via Counter API (non-blocking)
 */
export async function trackEvent(event: TrackingEvent): Promise<boolean> {
  // Fire and forget - don't block on Counter API calls
  setImmediate(async () => {
    try {
      const payload = {
        key: COUNTER_API_KEY,
        event: event.action,
        category: event.category || 'general',
        value: event.value || 1,
        userId: event.userId,
        userName: event.userName,
        metadata: event.metadata,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(COUNTER_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${COUNTER_API_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        console.error(`[Counter API] Error tracking event: ${response.status} ${response.statusText}`);
      } else {
        console.log(`[Counter API] Event tracked: ${event.action}`);
      }
    } catch (error) {
      console.error('[Counter API] Error:', error);
    }
  });
  
  // Always return true immediately - don't block
  return true;
}

/**
 * Track user login
 */
export async function trackUserLogin(userId: number, userName: string) {
  return trackEvent({
    userId,
    userName,
    action: 'user_login',
    category: 'auth',
  });
}

/**
 * Track puzzle attempt
 */
export async function trackPuzzleAttempt(userId: number, puzzleId: string, correct: boolean) {
  return trackEvent({
    userId,
    action: 'puzzle_attempt',
    category: 'puzzle',
    value: correct ? 1 : 0,
    metadata: {
      puzzleId,
      correct,
    },
  });
}

/**
 * Track training session start
 */
export async function trackSessionStart(userId: number, openingName: string) {
  return trackEvent({
    userId,
    action: 'session_start',
    category: 'training',
    metadata: {
      opening: openingName,
    },
  });
}

/**
 * Track training session completion
 */
export async function trackSessionComplete(userId: number, openingName: string, accuracy: number) {
  return trackEvent({
    userId,
    action: 'session_complete',
    category: 'training',
    value: accuracy,
    metadata: {
      opening: openingName,
      accuracy,
    },
  });
}

/**
 * Track page view
 */
export async function trackPageView(userId: number, page: string) {
  return trackEvent({
    userId,
    action: 'page_view',
    category: 'navigation',
    metadata: {
      page,
    },
  });
}

/**
 * Track user registration
 */
export async function trackUserRegistration(userId: number, userName: string, email: string) {
  return trackEvent({
    userId,
    userName,
    action: 'user_registration',
    category: 'auth',
    metadata: {
      email,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track leaderboard player name
 */
export async function trackLeaderboardPlayer(userId: number, userName: string, rating: number, accuracy: number) {
  return trackEvent({
    userId,
    userName,
    action: 'leaderboard_update',
    category: 'leaderboard',
    value: rating,
    metadata: {
      rating,
      accuracy,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track daily website visitor
 */
export async function trackDailyVisitor(userId: number | null, sessionId: string) {
  return trackEvent({
    userId: userId || undefined,
    action: 'daily_visit',
    category: 'analytics',
    metadata: {
      sessionId,
      date: new Date().toISOString().split('T')[0],
    },
  });
}

/**
 * Track online user session
 */
export async function trackOnlineUser(userId: number, userName: string) {
  return trackEvent({
    userId,
    userName,
    action: 'user_online',
    category: 'online',
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track puzzle by opening category
 */
export async function trackPuzzleByOpening(puzzleId: string, openingName: string, rating: number) {
  return trackEvent({
    action: 'puzzle_categorized',
    category: 'puzzle_opening',
    value: rating,
    metadata: {
      puzzleId,
      opening: openingName,
      rating,
      timestamp: new Date().toISOString(),
    },
  });
}
