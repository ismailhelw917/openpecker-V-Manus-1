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
 * Track user events via Counter API
 */
export async function trackEvent(event: TrackingEvent): Promise<boolean> {
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
    });

    if (!response.ok) {
      console.error(`[Counter API] Error tracking event: ${response.status} ${response.statusText}`);
      return false;
    }

    console.log(`[Counter API] Event tracked: ${event.action}`);
    return true;
  } catch (error) {
    console.error('[Counter API] Error:', error);
    return false;
  }
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
