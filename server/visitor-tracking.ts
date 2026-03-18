/**
 * Visitor tracking module
 * Tracks unique visitors and page views using browser fingerprints
 * Stores data in the visitor_tracking table
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

interface TrackVisitorInput {
  fingerprint: string;
  page: string;
  referrer?: string;
  screenSize?: string;
  language?: string;
  userAgent?: string;
}

interface VisitorStats {
  totalVisitors: number;
  todayVisitors: number;
  totalPageViews: number;
  todayPageViews: number;
  recentVisitors: number; // last 15 minutes
}

// In-memory cache for stats (refresh every 60 seconds)
let cachedStats: VisitorStats | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Record a page visit from a visitor
 */
export async function trackVisitor(input: TrackVisitorInput): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.execute(sql`
      INSERT INTO visitor_tracking (fingerprint, page, referrer, userAgent, screenSize, language)
      VALUES (${input.fingerprint}, ${input.page}, ${input.referrer || null}, ${input.userAgent || null}, ${input.screenSize || null}, ${input.language || null})
    `);
  } catch (error) {
    // Silently fail - tracking should never break the app
    console.error("[VISITOR TRACKING] Error:", error);
  }
}

/**
 * Get visitor statistics with caching
 */
export async function getVisitorStats(): Promise<VisitorStats> {
  const now = Date.now();
  if (cachedStats && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedStats;
  }

  const db = await getDb();
  if (!db) {
    return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, todayPageViews: 0, recentVisitors: 0 };
  }

  try {
    const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(DISTINCT fingerprint) FROM visitor_tracking) as totalVisitors,
        (SELECT COUNT(DISTINCT fingerprint) FROM visitor_tracking WHERE timestamp >= CURDATE()) as todayVisitors,
        (SELECT COUNT(*) FROM visitor_tracking) as totalPageViews,
        (SELECT COUNT(*) FROM visitor_tracking WHERE timestamp >= CURDATE()) as todayPageViews,
        (SELECT COUNT(DISTINCT fingerprint) FROM visitor_tracking WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)) as recentVisitors
    `);

    const rows = (result as any)[0] || result;
    const row = Array.isArray(rows) ? rows[0] : rows;

    cachedStats = {
      totalVisitors: Number(row?.totalVisitors) || 0,
      todayVisitors: Number(row?.todayVisitors) || 0,
      totalPageViews: Number(row?.totalPageViews) || 0,
      todayPageViews: Number(row?.todayPageViews) || 0,
      recentVisitors: Number(row?.recentVisitors) || 0,
    };
    lastCacheTime = now;

    return cachedStats;
  } catch (error) {
    console.error("[VISITOR STATS] Error:", error);
    return { totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, todayPageViews: 0, recentVisitors: 0 };
  }
}
