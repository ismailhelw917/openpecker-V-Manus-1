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

  // Seed from DB on first read if not yet seeded
  if (!fallbackSeeded) {
    await seedFallbackFromDB();
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

// ─── Seed in-memory fallback from DB ─────────────────────────────────────────
// When Redis is unavailable (production), the in-memory Maps start empty.
// This seeds them from the database so the leaderboard always has data.
let fallbackSeeded = false;

async function seedFallbackFromDB(): Promise<void> {
  if (fallbackSeeded) return;
  fallbackSeeded = true; // Prevent re-entry
  try {
    const { getLeaderboardPlayers } = await import('./players');
    const players = await getLeaderboardPlayers(100, 'accuracy');
    console.log(`[Redis fallback] Seeding in-memory leaderboard from DB: ${players.length} players`);
    for (const p of players as any[]) {
      const memberId = p.userId ? `user:${p.userId}` : `device:${p.deviceId}`;
      const totalPuzzles = Number(p.totalPuzzles || 0);
      const totalCorrect = Number(p.totalCorrect || 0);
      const accuracy = totalPuzzles > 0 ? (totalCorrect / totalPuzzles) * 100 : 0;
      fallbackLeaderboard.set(memberId, totalPuzzles);
      fallbackMeta.set(memberId, {
        playerName: p.name || (p.deviceId ? `Guest-${String(p.deviceId).slice(0, 8)}` : 'Unknown'),
        accuracy: Math.round(accuracy * 100) / 100,
        rating: Number(p.rating || 1200),
        totalMinutes: Math.round(Number(p.totalTimeMs || 0) / 60000 * 10) / 10,
        totalPuzzles,
        correctPuzzles: totalCorrect,
      });
    }
    console.log(`[Redis fallback] Seeded ${fallbackLeaderboard.size} players into in-memory leaderboard`);
  } catch (err) {
    console.error('[Redis fallback] Failed to seed from DB:', err);
    fallbackSeeded = false; // Allow retry on next call
  }
}

// ─── Wipe and reseed Redis leaderboard from DB on startup ───────────────────
// This ensures stale or test data never persists across deployments.
async function wipeAndReseedRedis(): Promise<void> {
  const redis = getRedis();
  if (!redis || !redisAvailable) return;
  try {
    // Wipe the leaderboard sorted set and all player meta hashes
    const keys = await redis.keys(`${PLAYER_META_PREFIX}*`);
    const pipe = redis.pipeline();
    pipe.del(LEADERBOARD_KEY);
    for (const key of keys) pipe.del(key);
    await pipe.exec();
    console.log(`[Redis] Wiped leaderboard + ${keys.length} meta keys`);

    // Reseed from DB
    const { getLeaderboardPlayers } = await import('./players');
    const players = await getLeaderboardPlayers(100, 'accuracy');
    console.log(`[Redis] Reseeding from DB: ${players.length} players`);
    for (const p of players as any[]) {
      const memberId = p.userId ? `user:${p.userId}` : `device:${p.deviceId}`;
      const totalPuzzles = Number(p.totalPuzzles || 0);
      if (totalPuzzles === 0) continue; // Skip zero-puzzle users
      const totalCorrect = Number(p.totalCorrect || 0);
      const accuracy = totalPuzzles > 0 ? (totalCorrect / totalPuzzles) * 100 : 0;
      await redisUpdateScore(memberId, {
        playerName: p.name || (p.deviceId ? `Guest-${String(p.deviceId).slice(0, 8)}` : 'Unknown'),
        accuracy: Math.round(accuracy * 100) / 100,
        rating: Number(p.rating || 1200),
        totalMinutes: Math.round(Number(p.totalTimeMs || 0) / 60000 * 10) / 10,
        totalPuzzles,
        correctPuzzles: totalCorrect,
      });
    }
    console.log('[Redis] Reseed complete — leaderboard is now clean');
  } catch (err) {
    console.error('[Redis] Wipe+reseed failed:', err);
  }
}

// ─── Initialise Redis connection eagerly ─────────────────────────────────────
// This ensures the connection is attempted at startup, not on first use.
getRedis();

// After a short delay: wipe+reseed Redis (if available) OR seed in-memory fallback
setTimeout(async () => {
  if (redisAvailable) {
    console.log('[Redis] Available — wiping stale data and reseeding from DB');
    await wipeAndReseedRedis();
  } else {
    console.log('[Redis] Not available — seeding in-memory fallback from DB');
    await seedFallbackFromDB();
  }
}, 3000);
