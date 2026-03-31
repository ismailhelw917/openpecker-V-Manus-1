/**
 * Cookie-based user activity tracking
 * Tracks user behavior, engagement, and session data
 */

export interface UserActivityData {
  sessionId: string;
  userId?: string;
  startTime: number;
  lastActivityTime: number;
  pageViews: string[];
  puzzlesSolved: number;
  sessionDuration: number;
  deviceInfo: {
    userAgent: string;
    language: string;
    timezone: string;
  };
  events: ActivityEvent[];
}

export interface ActivityEvent {
  type: 'page_view' | 'puzzle_start' | 'puzzle_complete' | 'session_start' | 'session_end' | 'click' | 'scroll';
  timestamp: number;
  data?: Record<string, any>;
}

const ACTIVITY_COOKIE_NAME = 'openpecker_activity';
const ACTIVITY_COOKIE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes of inactivity

/**
 * Initialize user activity tracking
 */
export function initializeActivityTracking(): UserActivityData {
  const existingData = getActivityData();

  if (existingData && isSessionValid(existingData)) {
    return existingData;
  }

  // Create new session
  const newSession: UserActivityData = {
    sessionId: generateSessionId(),
    startTime: Date.now(),
    lastActivityTime: Date.now(),
    pageViews: [window.location.pathname],
    puzzlesSolved: 0,
    sessionDuration: 0,
    deviceInfo: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    events: [
      {
        type: 'session_start',
        timestamp: Date.now(),
        data: { page: window.location.pathname },
      },
    ],
  };

  saveActivityData(newSession);
  return newSession;
}

/**
 * Track a page view
 */
export function trackPageView(page: string): void {
  const data = getActivityData();
  if (!data) return;

  if (!data.pageViews.includes(page)) {
    data.pageViews.push(page);
  }

  data.events.push({
    type: 'page_view',
    timestamp: Date.now(),
    data: { page },
  });

  updateActivityData(data);
}

/**
 * Track puzzle session start
 */
export function trackPuzzleSessionStart(openingName: string, variation: string): void {
  const data = getActivityData();
  if (!data) return;

  data.events.push({
    type: 'session_start',
    timestamp: Date.now(),
    data: { openingName, variation },
  });

  updateActivityData(data);
}

/**
 * Track puzzle completion
 */
export function trackPuzzleComplete(correct: boolean, timeSpent: number): void {
  const data = getActivityData();
  if (!data) return;

  if (correct) {
    data.puzzlesSolved++;
  }

  data.events.push({
    type: 'puzzle_complete',
    timestamp: Date.now(),
    data: { correct, timeSpent },
  });

  updateActivityData(data);
}

/**
 * Track user clicks
 */
export function trackClick(elementId: string, elementClass: string): void {
  const data = getActivityData();
  if (!data) return;

  data.events.push({
    type: 'click',
    timestamp: Date.now(),
    data: { elementId, elementClass },
  });

  updateActivityData(data);
}

/**
 * Track scroll events (throttled)
 */
let lastScrollTrack = 0;
export function trackScroll(scrollPercentage: number): void {
  const now = Date.now();
  if (now - lastScrollTrack < 5000) return; // Throttle to every 5 seconds

  const data = getActivityData();
  if (!data) return;

  data.events.push({
    type: 'scroll',
    timestamp: Date.now(),
    data: { scrollPercentage },
  });

  updateActivityData(data);
  lastScrollTrack = now;
}

/**
 * Update activity timestamp (called on user interaction)
 */
export function updateActivityTimestamp(): void {
  const data = getActivityData();
  if (!data) return;

  data.lastActivityTime = Date.now();
  data.sessionDuration = Date.now() - data.startTime;

  saveActivityData(data);
}

/**
 * Get current activity data from cookie
 */
export function getActivityData(): UserActivityData | null {
  try {
    const cookieValue = getCookie(ACTIVITY_COOKIE_NAME);
    if (!cookieValue) return null;

    return JSON.parse(decodeURIComponent(cookieValue));
  } catch (error) {
    console.error('Error parsing activity cookie:', error);
    return null;
  }
}

/**
 * Save activity data to cookie
 */
function saveActivityData(data: UserActivityData): void {
  try {
    const cookieValue = encodeURIComponent(JSON.stringify(data));
    setCookie(ACTIVITY_COOKIE_NAME, cookieValue, ACTIVITY_COOKIE_EXPIRY);
  } catch (error) {
    console.error('Error saving activity cookie:', error);
  }
}

/**
 * Update activity data (refresh timestamp and save)
 */
function updateActivityData(data: UserActivityData): void {
  data.lastActivityTime = Date.now();
  data.sessionDuration = Date.now() - data.startTime;
  saveActivityData(data);
}

/**
 * Check if session is still valid (not expired)
 */
function isSessionValid(data: UserActivityData): boolean {
  const timeSinceLastActivity = Date.now() - data.lastActivityTime;
  return timeSinceLastActivity < SESSION_TIMEOUT;
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set a cookie with expiry
 */
function setCookie(name: string, value: string, expiryMs: number): void {
  const date = new Date();
  date.setTime(date.getTime() + expiryMs);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

/**
 * Get cookie value by name
 */
function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');

  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.startsWith(nameEQ)) {
      return cookie.substring(nameEQ.length);
    }
  }

  return null;
}

/**
 * Delete cookie
 */
export function deleteCookie(name: string): void {
  setCookie(name, '', -1);
}

/**
 * Get session summary for analytics
 */
export function getSessionSummary(): {
  sessionId: string;
  duration: number;
  pageViews: number;
  puzzlesSolved: number;
  eventCount: number;
} | null {
  const data = getActivityData();
  if (!data) return null;

  return {
    sessionId: data.sessionId,
    duration: data.sessionDuration,
    pageViews: data.pageViews.length,
    puzzlesSolved: data.puzzlesSolved,
    eventCount: data.events.length,
  };
}
