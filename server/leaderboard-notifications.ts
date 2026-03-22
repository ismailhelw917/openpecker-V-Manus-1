/**
 * Real-Time Leaderboard Notifications
 * Manages subscriptions and broadcasts leaderboard updates to connected clients
 */

import { EventEmitter } from 'events';

export interface LeaderboardUpdateNotification {
  code: number; // 1001 = leaderboard update
  leaderboard_id: string;
  username: string;
  score: number;
  subscore: number;
  rank: number;
  message: string;
  timestamp: number;
}

// Global event emitter for leaderboard updates
const leaderboardEventEmitter = new EventEmitter();

// Set max listeners to prevent memory leaks with many subscribers
leaderboardEventEmitter.setMaxListeners(1000);

/**
 * Subscribe to leaderboard updates
 * Returns a function to unsubscribe
 */
export function subscribeToLeaderboardUpdates(
  callback: (notification: LeaderboardUpdateNotification) => void
): () => void {
  leaderboardEventEmitter.on('leaderboard-update', callback);

  // Return unsubscribe function
  return () => {
    leaderboardEventEmitter.off('leaderboard-update', callback);
  };
}

/**
 * Broadcast a leaderboard update to all subscribers
 * Called when a puzzle is completed or cycle is finished
 */
export function broadcastLeaderboardUpdate(
  leaderboardId: string,
  username: string,
  score: number,
  subscore: number,
  rank: number
): void {
  const notification: LeaderboardUpdateNotification = {
    code: 1001,
    leaderboard_id: leaderboardId,
    username,
    score,
    subscore,
    rank,
    message: `${username} updated their score to ${score}!`,
    timestamp: Date.now(),
  };

  // Emit to all subscribers
  leaderboardEventEmitter.emit('leaderboard-update', notification);

  console.log(
    `[Leaderboard Notification] Broadcast update: ${username} scored ${score} on ${leaderboardId}`
  );
}

/**
 * Get the number of active subscribers
 */
export function getSubscriberCount(): number {
  return leaderboardEventEmitter.listenerCount('leaderboard-update');
}

/**
 * Clear all subscribers (useful for testing or cleanup)
 */
export function clearAllSubscribers(): void {
  leaderboardEventEmitter.removeAllListeners('leaderboard-update');
}
