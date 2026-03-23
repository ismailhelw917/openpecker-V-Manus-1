import type { Express, Request, Response } from "express";
import { recordHeartbeat, getOnlineCount } from "../leaderboard-optimized";

/**
 * Heartbeat system v2
 * 
 * Frontend sends a ping every 30 seconds.
 * Backend upserts into user_heartbeats with current timestamp.
 * "Online Now" = COUNT(*) WHERE lastPing > NOW() - 45 seconds.
 * 
 * No cleanup cron needed — stale entries are simply excluded by the 45s window.
 */
export function registerHeartbeatRoutes(app: Express) {
  /**
   * POST /api/heartbeat — record a user ping
   */
  app.post("/api/heartbeat", async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, name } = req.body;

      if (!userId && !deviceId) {
        res.status(400).json({ error: "userId or deviceId required" });
        return;
      }

      await recordHeartbeat({
        userId: userId ? Number(userId) : null,
        deviceId: deviceId || null,
        playerName: name || undefined,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("[Heartbeat] Failed", error);
      res.status(500).json({ error: "Heartbeat failed" });
    }
  });

  /**
   * GET /api/heartbeat/active — get online user count
   */
  app.get("/api/heartbeat/active", async (_req: Request, res: Response) => {
    try {
      const count = await getOnlineCount();
      res.json({ onlineCount: count });
    } catch (error) {
      console.error("[Heartbeat Active] Failed", error);
      res.status(500).json({ error: "Failed to fetch online count" });
    }
  });
}
