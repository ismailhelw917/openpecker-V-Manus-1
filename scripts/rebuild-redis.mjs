/**
 * rebuild-redis.mjs
 * Wipes all Redis player/leaderboard data and rebuilds from the database.
 * Run with: node scripts/rebuild-redis.mjs
 */
import mysql from "mysql2/promise";
import Redis from "ioredis";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const LEADERBOARD_KEY = "global_leaderboard";
const PLAYER_META_PREFIX = "player:meta:";

async function main() {
  const redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT || "6379"),
  });

  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  console.log("=== OpenPecker Redis Rebuild ===\n");

  // ── Step 1: Wipe all existing Redis player data ──────────────────────────
  console.log("Step 1: Wiping all existing Redis data...");
  await redis.del(LEADERBOARD_KEY);

  const metaKeys = await redis.keys(`${PLAYER_META_PREFIX}*`);
  if (metaKeys.length > 0) {
    await redis.del(...metaKeys);
  }
  const activeKeys = await redis.keys("active_user:*");
  if (activeKeys.length > 0) {
    await redis.del(...activeKeys);
  }
  const oldOnlineKeys = await redis.keys("user:online:*");
  if (oldOnlineKeys.length > 0) {
    await redis.del(...oldOnlineKeys);
  }
  console.log(`  Deleted ${metaKeys.length} player:meta keys, ${activeKeys.length} active_user keys`);

  // ── Step 2: Query all players with puzzle attempts from DB ───────────────
  console.log("\nStep 2: Querying database for all players...");

  const [totalUsers] = await conn.execute("SELECT COUNT(*) as total FROM users");
  console.log(`  Total registered users: ${totalUsers[0].total}`);

  // Get players with userId (logged-in users)
  const [userPlayers] = await conn.execute(`
    SELECT 
      pa.userId,
      MAX(u.name) as userName,
      COUNT(*) as totalPuzzles,
      SUM(pa.isCorrect) as correctPuzzles,
      ROUND(SUM(pa.isCorrect) * 100.0 / COUNT(*), 2) as accuracy
    FROM puzzle_attempts pa
    LEFT JOIN users u ON pa.userId = u.id
    WHERE pa.userId IS NOT NULL
    GROUP BY pa.userId
    ORDER BY totalPuzzles DESC
  `);

  // Get guest players (deviceId only, no userId)
  const [guestPlayers] = await conn.execute(`
    SELECT 
      MAX(pa.deviceId) as deviceId,
      COUNT(*) as totalPuzzles,
      SUM(pa.isCorrect) as correctPuzzles,
      ROUND(SUM(pa.isCorrect) * 100.0 / COUNT(*), 2) as accuracy
    FROM puzzle_attempts pa
    WHERE pa.userId IS NULL AND pa.deviceId IS NOT NULL
    GROUP BY pa.deviceId
    ORDER BY totalPuzzles DESC
  `);

  console.log(`  Found ${userPlayers.length} registered players with puzzles`);
  console.log(`  Found ${guestPlayers.length} guest players with puzzles`);

  // ── Step 3: Rebuild Redis leaderboard with pipeline ──────────────────────
  console.log("\nStep 3: Rebuilding Redis leaderboard...");

  const pipe = redis.pipeline();
  let count = 0;

  // Add registered users
  for (const p of userPlayers) {
    const memberId = `user:${p.userId}`;
    const playerName = p.userName || `Player-${p.userId}`;
    const totalPuzzles = Number(p.totalPuzzles);
    const correctPuzzles = Number(p.correctPuzzles);
    const accuracy = Number(p.accuracy);

    pipe.zadd(LEADERBOARD_KEY, totalPuzzles, memberId);
    pipe.hset(`${PLAYER_META_PREFIX}${memberId}`, {
      playerName,
      accuracy: accuracy.toFixed(2),
      rating: 1200,
      totalMinutes: "0",
      totalPuzzles,
      correctPuzzles,
    });
    count++;
  }

  // Add guest players
  for (const p of guestPlayers) {
    const memberId = `device:${p.deviceId}`;
    const playerName = `Guest-${p.deviceId.substring(0, 8)}`;
    const totalPuzzles = Number(p.totalPuzzles);
    const correctPuzzles = Number(p.correctPuzzles);
    const accuracy = Number(p.accuracy);

    pipe.zadd(LEADERBOARD_KEY, totalPuzzles, memberId);
    pipe.hset(`${PLAYER_META_PREFIX}${memberId}`, {
      playerName,
      accuracy: accuracy.toFixed(2),
      rating: 1200,
      totalMinutes: "0",
      totalPuzzles,
      correctPuzzles,
    });
    count++;
  }

  await pipe.exec();
  console.log(`  Added ${count} players to global_leaderboard`);

  // ── Step 4: Verify ───────────────────────────────────────────────────────
  console.log("\nStep 4: Verification...");
  const leaderboardCount = await redis.zcard(LEADERBOARD_KEY);
  console.log(`  global_leaderboard entries: ${leaderboardCount}`);

  const top5 = await redis.zrevrange(LEADERBOARD_KEY, 0, 4, "WITHSCORES");
  console.log("\n  Top 5 players:");
  for (let i = 0; i < top5.length; i += 2) {
    const memberId = top5[i];
    const score = top5[i + 1];
    const meta = await redis.hgetall(`${PLAYER_META_PREFIX}${memberId}`);
    console.log(`    #${i / 2 + 1} ${meta?.playerName || memberId}: ${score} puzzles, ${meta?.accuracy}% acc`);
  }

  await conn.end();
  await redis.quit();
  console.log("\n✅ Redis rebuild complete!");
}

main().catch((err) => {
  console.error("❌ Rebuild failed:", err.message);
  process.exit(1);
});
