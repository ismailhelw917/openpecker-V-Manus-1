import Redis from "ioredis";

// ─── In-memory fallback (used when Redis is unavailable) ─────────────────────
// These Maps act as a temporary bridge so live features never query the DB.

/** Fallback leaderboard: memberId → score (total puzzles) */
const fallbackLeaderboard = new Map<string, number>();
/** Fallback player metadata */
const fallbackMeta = new Map<string, PlayerMeta>();
/** Fallback active users: id → expiresAt (ms timestamp) */
const fallbackActiveUsers = new Map<string, number>();

let redisAvailable = false;

// ─── Redis client ─────────────────────────────────────────────────────────────
let redisClient: Redis | null = null;

export function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      lazyConnect: false,
      connectTimeout: 2000,
      retryStrategy: (times) => {
        if (times > 3) {
          redisAvailable = false;
          return null; // Stop retrying — fall back to in-memory Map
        }
        return Math.min(times * 200, 1000);
      },
      maxRetriesPerRequest: 1,
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
      redisAvailable = false;
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected on port 6379");
      redisAvailable = true;
    });

    redisClient.on("ready", () => {
      redisAvailable = true;
    });

    return redisClient;
  } catch (err) {
    console.warn("[Redis] Failed to create client, using in-memory fallback:", err);
    redisAvailable = false;
    return null;
  }
}

// ─── Key names (spec-aligned) ─────────────────────────────────────────────────
/** Sorted set for global leaderboard — scores = total puzzles solved */
const LEADERBOARD_KEY = "global_leaderboard";
/** Hash prefix for player metadata */
const PLAYER_META_PREFIX = "player:meta:";
/** Heartbeat key prefix — active_user:[ID] with 60s TTL */
const ACTIVE_USER_PREFIX = "active_user:";
/** Heartbeat TTL in seconds */
const HEARTBEAT_TTL = 60;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PlayerMeta {
  playerName: string;
  accuracy: number;
  rating: number;
  totalMinutes: number;
  totalPuzzles: number;
  correctPuzzles: number;
}

// ─── Leaderboard helpers ──────────────────────────────────────────────────────

/**
 * Update a player's score and metadata.
 * Uses Redis ZADD + HSET pipeline; falls back to in-memory Map.
 */
export async function redisUpdateScore(
  memberId: string,
  meta: PlayerMeta
): Promise<void> {
  const redis = getRedis();

  if (redis && redisAvailable) {
    try {
      const pipe = redis.pipeline();
      // ZADD global_leaderboard <score> <memberId>
      pipe.zadd(LEADERBOARD_KEY, meta.totalPuzzles, memberId);
      // Store metadata as a hash
      pipe.hset(`${PLAYER_META_PREFIX}${memberId}`, {
        playerName: meta.playerName,
        accuracy: meta.accuracy.toFixed(2),
        rating: meta.rating,
        totalMinutes: meta.totalMinutes.toFixed(1),
        totalPuzzles: meta.totalPuzzles,
        correctPuzzles: meta.correctPuzzles,
      });
      await pipe.exec();
      return;
    } catch (err) {
      console.warn("[Redis] ZADD failed, using in-memory fallback:", err);
      redisAvailable = false;
    }
  }

  // In-memory fallback
  fallbackLeaderboard.set(memberId, meta.totalPuzzles);
  fallbackMeta.set(memberId, meta);
}

/**
 * Get top N players from the sorted set.
 * Uses Redis ZREVRANGE; falls back to in-memory Map sorted by score.
 */
export async function redisGetLeaderboard(limit = 100): Promise<
  Array<{
    rank: number;
    playerId: string;
    playerName: string;
    puzzlesSolved: number;
    accuracy: number;
    rating: number;
    totalMinutes: number;
  }>
> {
  const redis = getRedis();

  if (redis && redisAvailable) {
    try {
      // ZREVRANGE global_leaderboard 0 (limit-1) WITHSCORES
      const members = await redis.zrevrange(LEADERBOARD_KEY, 0, limit - 1, "WITHSCORES");
      const results = [];

      for (let i = 0; i < members.length; i += 2) {
        const memberId = members[i];
        const score = parseInt(members[i + 1]);
        const meta = await redis.hgetall(`${PLAYER_META_PREFIX}${memberId}`);
        results.push({
          rank: results.length + 1,
          playerId: memberId,
          playerName: meta?.playerName || memberId,
          puzzlesSolved: score,
          accuracy: parseFloat(meta?.accuracy || "0"),
          rating: parseInt(meta?.rating || "1200"),
          totalMinutes: parseFloat(meta?.totalMinutes || "0"),
        });
      }
      return results;
    } catch (err) {
      console.warn("[Redis] ZREVRANGE failed, using in-memory fallback:", err);
      redisAvailable = false;
    }
  }

  // In-memory fallback: sort Map by score descending
  const sorted = Array.from(fallbackLeaderboard.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return sorted.map(([memberId, score], idx) => {
    const meta = fallbackMeta.get(memberId);
    return {
      rank: idx + 1,
      playerId: memberId,
      playerName: meta?.playerName || memberId,
      puzzlesSolved: score,
      accuracy: meta?.accuracy ?? 0,
      rating: meta?.rating ?? 1200,
      totalMinutes: meta?.totalMinutes ?? 0,
    };
  });
}

/**
 * Get a player's rank (1-based).
 */
export async function redisGetPlayerRank(memberId: string): Promise<number | null> {
  const redis = getRedis();

  if (redis && redisAvailable) {
    try {
      const rank = await redis.zrevrank(LEADERBOARD_KEY, memberId);
      return rank !== null ? rank + 1 : null;
    } catch (err) {
      console.warn("[Redis] ZREVRANK failed:", err);
    }
  }

  // In-memory fallback
  const sorted = Array.from(fallbackLeaderboard.entries()).sort((a, b) => b[1] - a[1]);
  const idx = sorted.findIndex(([id]) => id === memberId);
  return idx >= 0 ? idx + 1 : null;
}

// ─── Heartbeat helpers ────────────────────────────────────────────────────────

/**
 * Record a heartbeat for a user/device.
 * Sets key active_user:[ID] with 60s TTL in Redis.
 * Falls back to in-memory Map with expiry timestamp.
 */
export async function redisHeartbeat(id: string, name?: string): Promise<void> {
  const redis = getRedis();
  const key = `${ACTIVE_USER_PREFIX}${id}`;

  if (redis && redisAvailable) {
    try {
      // SETEX active_user:[ID] 60 <name>
      await redis.setex(key, HEARTBEAT_TTL, name || id);
      return;
    } catch (err) {
      console.warn("[Redis] SETEX heartbeat failed, using in-memory fallback:", err);
      redisAvailable = false;
    }
  }

  // In-memory fallback: store expiry timestamp
  fallbackActiveUsers.set(id, Date.now() + HEARTBEAT_TTL * 1000);
}

/**
 * Count currently online users.
 * Redis: SCAN active_user:* keys.
 * Fallback: count non-expired entries in the Map.
 */
export async function redisOnlineCount(): Promise<number> {
  const redis = getRedis();

  if (redis && redisAvailable) {
    try {
      let count = 0;
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          "MATCH",
          `${ACTIVE_USER_PREFIX}*`,
          "COUNT",
          100
        );
        count += keys.length;
        cursor = nextCursor;
      } while (cursor !== "0");
      return count;
    } catch (err) {
      console.warn("[Redis] SCAN online count failed, using in-memory fallback:", err);
      redisAvailable = false;
    }
  }

  // In-memory fallback: count non-expired entries
  const now = Date.now();
  let count = 0;
  for (const [id, expiresAt] of Array.from(fallbackActiveUsers.entries())) {
    if (expiresAt > now) {
      count++;
    } else {
      fallbackActiveUsers.delete(id); // Lazy cleanup
    }
  }
  return count;
}

// ─── Initialise Redis connection eagerly ─────────────────────────────────────
// This ensures the connection is attempted at startup, not on first use.
getRedis();
