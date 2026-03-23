import type { Express, Request, Response } from "express";
import { redisHeartbeat, redisOnlineCount } from "../redis";

/**
 * Heartbeat system — Redis edition
 *
 * Frontend sends a ping every 30 seconds.
 * Backend calls SETEX active_user:[ID] 60 <name>
 * "Online Now" = count of active_user:* keys (all have 60s TTL, auto-expire)
 */
export function registerHeartbeatRoutes(app: Express) {
  /**
   * POST /api/heartbeat — record a user ping
   * Body: { userId?, deviceId?, name? }
   */
  app.post("/api/heartbeat", async (req: Request, res: Response) => {
    try {
      const { userId, deviceId, name } = req.body;
      if (!userId && !deviceId) {
        res.status(400).json({ error: "userId or deviceId required" });
        return;
      }
      // Build a stable ID: prefer userId, fall back to deviceId
      const id = userId ? `user:${userId}` : `device:${deviceId}`;
      await redisHeartbeat(id, name || id);
      res.json({ success: true });
    } catch (error) {
      console.error("[Heartbeat] Redis failed", error);
      // Don't crash the client — return 200 so the app keeps working
      res.json({ success: false, error: "Heartbeat failed" });
    }
  });

  /**
   * GET /api/heartbeat/active — get online user count
   */
  app.get("/api/heartbeat/active", async (_req: Request, res: Response) => {
    try {
      const count = await redisOnlineCount();
      res.json({ onlineCount: count });
    } catch (error) {
      console.error("[Heartbeat Active] Failed", error);
      res.json({ onlineCount: 0 });
    }
  });
}
