/**
 * Realistic online user count generator
 *
 * Calibrated to match real Google Analytics data:
 *   - 688 daily active users (Monday, March 23)
 *   - Primary audience: India (635), Singapore (20), US (9), France (11)
 *   - India timezone: UTC+5:30 → peak hours roughly 07:00–22:00 IST
 *
 * Concurrency model:
 *   - Off-peak (night in India): ~5–8% of daily actives online → ~35–55
 *   - Normal hours: ~12–18% of daily actives online → ~80–125
 *   - Peak hours (IST 10:00–20:00): ~25–40% of daily actives → ~170–275
 *
 * A random-walk algorithm adds natural second-to-second fluctuations.
 */

const DAILY_ACTIVES = 688; // from GA: Monday March 23

/** Return the fraction of daily actives expected online at a given UTC hour */
function getConcurrencyFraction(utcHour: number): number {
  // India Standard Time = UTC + 5.5
  const istHour = (utcHour + 5.5) % 24;

  if (istHour >= 0 && istHour < 6) {
    // Deep night in India (midnight–6 AM IST) — very low traffic
    return 0.05 + Math.random() * 0.03; // 5–8%
  } else if (istHour >= 6 && istHour < 9) {
    // Early morning ramp-up
    return 0.08 + Math.random() * 0.06; // 8–14%
  } else if (istHour >= 9 && istHour < 12) {
    // Morning peak
    return 0.22 + Math.random() * 0.10; // 22–32%
  } else if (istHour >= 12 && istHour < 14) {
    // Midday
    return 0.18 + Math.random() * 0.08; // 18–26%
  } else if (istHour >= 14 && istHour < 20) {
    // Afternoon / evening peak
    return 0.28 + Math.random() * 0.12; // 28–40%
  } else if (istHour >= 20 && istHour < 22) {
    // Late evening wind-down
    return 0.15 + Math.random() * 0.08; // 15–23%
  } else {
    // 22:00–midnight IST
    return 0.07 + Math.random() * 0.04; // 7–11%
  }
}

let lastCount: number | null = null;
let lastUpdateTime = 0;
let testMode = false;

/**
 * Generate a realistic online user count based on time-of-day and daily actives.
 */
export function getMockOnlineCount(): number {
  const now = Date.now();
  const updateInterval = testMode ? 0 : 2_000; // 2 s in production

  if (lastCount !== null && now - lastUpdateTime < updateInterval) {
    return lastCount;
  }

  const utcHour = new Date().getUTCHours();
  const fraction = getConcurrencyFraction(utcHour);
  const target = Math.round(DAILY_ACTIVES * fraction);

  if (lastCount === null) {
    // First call — initialise to target
    lastCount = target;
  } else {
    // Random walk: drift ±4 per tick, but pull toward the time-based target
    const drift = Math.floor(Math.random() * 9) - 4; // -4 to +4
    const pull = Math.sign(target - lastCount) * Math.ceil(Math.abs(target - lastCount) * 0.05);
    lastCount = Math.max(20, lastCount + drift + pull);
  }

  lastUpdateTime = now;
  return lastCount;
}

/** Reset counter (useful for testing) */
export function resetMockOnlineCount(): void {
  lastCount = null;
  lastUpdateTime = 0;
}

/** Enable test mode for faster updates */
export function setTestMode(enabled: boolean): void {
  testMode = enabled;
}
