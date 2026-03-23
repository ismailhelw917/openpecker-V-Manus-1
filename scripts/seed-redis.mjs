/**
 * One-time script: seed existing puzzle_attempts into Redis leaderboard sorted set.
 * Run: node scripts/seed-redis.mjs
 */
import Redis from "ioredis";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const redis = new Redis({ host: "127.0.0.1", port: 6379 });

const db = await mysql.createConnection(process.env.DATABASE_URL);

console.log("Seeding Redis leaderboard from puzzle_attempts...");

// Registered users
const [userRows] = await db.execute(`
  SELECT u.id, u.name,
    COUNT(pa.id) AS total,
    SUM(pa.isCorrect) AS correct
  FROM users u
  JOIN puzzle_attempts pa ON pa.userId = u.id
  GROUP BY u.id, u.name
  HAVING COUNT(pa.id) > 0
`);

for (const row of userRows) {
  const id = `user:${row.id}`;
  const total = Number(row.total);
  const correct = Number(row.correct);
  const accuracy = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
  const pipe = redis.pipeline();
  pipe.zadd("leaderboard:puzzles", total, id);
  pipe.hset(`player:meta:${id}`, {
    playerName: row.name || `Player-${row.id}`,
    accuracy: accuracy.toFixed(2),
    rating: 1200,
    totalMinutes: 0,
    totalPuzzles: total,
    correctPuzzles: correct,
  });
  await pipe.exec();
  console.log(`  user:${row.id} (${row.name}) → ${total} puzzles, ${accuracy}% accuracy`);
}

// Guest devices
const [guestRows] = await db.execute(`
  SELECT deviceId,
    COUNT(id) AS total,
    SUM(isCorrect) AS correct
  FROM puzzle_attempts
  WHERE userId IS NULL AND deviceId IS NOT NULL
  GROUP BY deviceId
  HAVING COUNT(id) > 0
`);

for (const row of guestRows) {
  const id = `device:${row.deviceId}`;
  const total = Number(row.total);
  const correct = Number(row.correct);
  const accuracy = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
  const pipe = redis.pipeline();
  pipe.zadd("leaderboard:puzzles", total, id);
  pipe.hset(`player:meta:${id}`, {
    playerName: `Guest-${row.deviceId.substring(0, 8)}`,
    accuracy: accuracy.toFixed(2),
    rating: 1200,
    totalMinutes: 0,
    totalPuzzles: total,
    correctPuzzles: correct,
  });
  await pipe.exec();
  console.log(`  device:${row.deviceId.substring(0, 8)} → ${total} puzzles, ${accuracy}% accuracy`);
}

const total = await redis.zcard("leaderboard:puzzles");
console.log(`\nDone! Redis leaderboard has ${total} players.`);

await db.end();
redis.disconnect();
