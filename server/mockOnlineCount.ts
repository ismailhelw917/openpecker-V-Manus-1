/**
 * Mock online user count generator
 * Simulates realistic user activity with fluctuations
 * Starts at 127 and varies between 95 and 180 users
 */

let lastCount = 127;
let lastUpdateTime = Date.now();

/**
 * Generate a realistic mock online user count
 * Uses a random walk algorithm to create natural-looking fluctuations
 */
export function getMockOnlineCount(): number {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;

  // Update every 2-5 seconds for realistic fluctuations
  if (timeSinceLastUpdate < 2000) {
    return lastCount;
  }

  lastUpdateTime = now;

  // Random walk: change by -3 to +3 users
  const change = Math.floor(Math.random() * 7) - 3; // -3 to +3
  let newCount = lastCount + change;

  // Keep count between 95 and 180
  const minUsers = 95;
  const maxUsers = 180;

  if (newCount < minUsers) {
    newCount = minUsers + Math.floor(Math.random() * 10); // Bounce back up
  } else if (newCount > maxUsers) {
    newCount = maxUsers - Math.floor(Math.random() * 10); // Pull back down
  }

  lastCount = newCount;
  return newCount;
}

/**
 * Reset the mock counter (useful for testing)
 */
export function resetMockOnlineCount(): void {
  lastCount = 127;
  lastUpdateTime = Date.now();
}
