import Redis from "ioredis";

// Single Redis client instance shared across the server
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      lazyConnect: false,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      },
      maxRetriesPerRequest: 2,
    });

    redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected on port 6379");
    });
  }
  return redisClient;
}

// ─── Leaderboard helpers ────────────────────────────────────────────────────
const LEADERBOARD_KEY = "leaderboard:puzzles";
const PLAYER_META_PREFIX = "player:meta:";

export interface PlayerMeta {
  playerName: string;
  accuracy: number;
  rating: number;
  totalMinutes: number;
  totalPuzzles: number;
  correctPuzzles: number;
}

/** Update a player's score and metadata in Redis */
export async function redisUpdateScore(
  playerId: string,
  meta: PlayerMeta
): Promise<void> {
  const redis = getRedis();
  const pipe = redis.pipeline();
  // Score = total puzzles solved (sorted set score)
  pipe.zadd(LEADERBOARD_KEY, meta.totalPuzzles, playerId);
  // Store metadata as a hash
  pipe.hset(`${PLAYER_META_PREFIX}${playerId}`, {
    playerName: meta.playerName,
    accuracy: meta.accuracy.toFixed(2),
    rating: meta.rating,
    totalMinutes: meta.totalMinutes.toFixed(1),
    totalPuzzles: meta.totalPuzzles,
    correctPuzzles: meta.correctPuzzles,
  });
  await pipe.exec();
}

/** Get top N players from the sorted set */
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
  // ZREVRANGE returns members from highest to lowest score
  const members = await redis.zrevrange(LEADERBOARD_KEY, 0, limit - 1, "WITHSCORES");

  const results = [];
  for (let i = 0; i < members.length; i += 2) {
    const playerId = members[i];
    const score = parseInt(members[i + 1]);
    const meta = await redis.hgetall(`${PLAYER_META_PREFIX}${playerId}`);
    results.push({
      rank: results.length + 1,
      playerId,
      playerName: meta?.playerName || playerId,
      puzzlesSolved: score,
      accuracy: parseFloat(meta?.accuracy || "0"),
      rating: parseInt(meta?.rating || "1200"),
      totalMinutes: parseFloat(meta?.totalMinutes || "0"),
    });
  }
  return results;
}

/** Get a player's rank (1-based) */
export async function redisGetPlayerRank(playerId: string): Promise<number | null> {
  const redis = getRedis();
  const rank = await redis.zrevrank(LEADERBOARD_KEY, playerId);
  return rank !== null ? rank + 1 : null;
}

// ─── Heartbeat helpers ───────────────────────────────────────────────────────
const ONLINE_PREFIX = "user:online:";
const ONLINE_TTL = 45; // seconds

/** Record a heartbeat for a user/device — sets key with 45s TTL */
export async function redisHeartbeat(id: string, name?: string): Promise<void> {
  const redis = getRedis();
  const key = `${ONLINE_PREFIX}${id}`;
  await redis.setex(key, ONLINE_TTL, name || id);
}

/** Count currently online users by scanning user:online:* keys */
export async function redisOnlineCount(): Promise<number> {
  const redis = getRedis();
  let count = 0;
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", `${ONLINE_PREFIX}*`, "COUNT", 100);
    count += keys.length;
    cursor = nextCursor;
  } while (cursor !== "0");
  return count;
}
