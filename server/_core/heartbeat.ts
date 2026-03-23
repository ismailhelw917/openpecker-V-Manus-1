import type { Express, Request, Response } from "express";
import { redisHeartbeat, redisOnlineCount } from "../redis";

/**
 * Heartbeat system — Redis edition
 *
 * Frontend sends a ping every 30 seconds.
 * Backend calls SETEX user:online:[ID] 45 <name>
 * "Online Now" = count of user:online:* keys (all have TTL, auto-expire after 45s)
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

      const id = userId ? `user:${userId}` : `device:${deviceId}`;
      await redisHeartbeat(id, name || id);

      res.json({ success: true });
    } catch (error) {
      console.error("[Heartbeat] Redis failed", error);
      res.status(500).json({ error: "Heartbeat failed" });
    }
  });

  /**
   * GET /api/heartbeat/active — get online user count from Redis
   */
  app.get("/api/heartbeat/active", async (_req: Request, res: Response) => {
    try {
      const count = await redisOnlineCount();
      res.json({ onlineCount: count });
    } catch (error) {
      console.error("[Heartbeat Active] Redis failed", error);
      res.status(500).json({ error: "Failed to fetch online count" });
    }
  });
}
