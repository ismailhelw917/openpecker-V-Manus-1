import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { sql } from "drizzle-orm";

/**
 * Heartbeat endpoint - tracks active users with real-time data
 * Called every 30 seconds from the frontend to keep user active
 */
export function registerHeartbeatRoutes(app: Express) {
  app.post("/api/heartbeat", async (req: Request, res: Response) => {
    try {
      const { sessionId, name, email, isGuest, currentPath, deviceId } = req.body;

      if (!sessionId || !name) {
        res.status(400).json({ error: "sessionId and name are required" });
        return;
      }

      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      // Upsert active session using raw SQL
      await db.execute(sql`
        INSERT INTO active_sessions (id, name, email, isGuest, currentPath, deviceId, lastActive, createdAt)
        VALUES (${sessionId}, ${name}, ${email}, ${isGuest ? 1 : 0}, ${currentPath}, ${deviceId}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        email = VALUES(email),
        isGuest = VALUES(isGuest),
        currentPath = VALUES(currentPath),
        lastActive = NOW()
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[Heartbeat] Failed", error);
      res.status(500).json({ error: "Heartbeat failed" });
    }
  });

  /**
   * Cleanup endpoint - remove inactive sessions older than 60 seconds
   */
  app.post("/api/heartbeat/cleanup", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      await db.execute(sql`
        DELETE FROM active_sessions 
        WHERE lastActive < DATE_SUB(NOW(), INTERVAL 60 SECOND)
      `);

      res.json({ success: true });
    } catch (error) {
      console.error("[Heartbeat Cleanup] Failed", error);
      res.status(500).json({ error: "Cleanup failed" });
    }
  });

  /**
   * Get active sessions - returns currently active players
   */
  app.get("/api/heartbeat/active", async (req: Request, res: Response) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(500).json({ error: "Database unavailable" });
        return;
      }

      const sessions = await db.execute(sql`
        SELECT id, name, email, isGuest, currentPath, lastActive
        FROM active_sessions
        WHERE lastActive > DATE_SUB(NOW(), INTERVAL 60 SECOND)
        ORDER BY lastActive DESC
      `);

      res.json({ sessions });
    } catch (error) {
      console.error("[Heartbeat Active] Failed", error);
      res.status(500).json({ error: "Failed to fetch active sessions" });
    }
  });
}
