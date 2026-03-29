import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStripeRoutes } from "./stripeHandler";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { resetDbConnection } from "../db";
import { trackVisitor, getVisitorStats } from "../visitor-tracking";
import { registerHeartbeatRoutes } from "./heartbeat";
import rateLimit from "express-rate-limit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  // Trust the reverse proxy (Manus/Cloudflare) so req.protocol reflects HTTPS
  // and secure cookies are set correctly on the live domain (openpecker.com).
  app.set("trust proxy", 1);
  const server = createServer(app);
  
  // Enable gzip compression for all responses (reduces payload by 60-80%)
  app.use(compression({ level: 6, threshold: 1024 }));
  
  // IMPORTANT: Register Stripe webhook BEFORE express.json() so it receives raw body
  // for signature verification. The stripeHandler uses express.raw() on the webhook route.
  registerStripeRoutes(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Parse cookies - REQUIRED for session authentication
  app.use(cookieParser());
  
  // Add rate limiting to prevent abuse and traffic spikes
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: express.Request) => req.path.startsWith('/api/track'),
  });
  
  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many requests, please try again later.',
  });
  
  app.use('/api/trpc', apiLimiter);
  app.use('/api/oauth', strictLimiter);
  
  // Add cache headers for static assets and HTML
  app.use((req, res, next) => {
    if (req.path.match(/\.(js|css|woff2|png|jpg|jpeg|gif|svg|ico)$/)) {
      // Cache static assets for 1 year (immutable)
      res.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (req.path === '/' || req.path.match(/\.html$/)) {
      // Cache HTML for 1 hour with revalidation
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
    next();
  });
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Heartbeat routes (active session tracking)
  registerHeartbeatRoutes(app);

  // Visitor tracking endpoints
  app.post("/api/track", async (req, res) => {
    try {
      const { fingerprint, page, referrer, screenSize, language } = req.body;
      if (!fingerprint || !page) {
        return res.status(400).json({ error: "Missing fingerprint or page" });
      }
      const userAgent = req.headers["user-agent"] || "";
      await trackVisitor({ fingerprint, page, referrer, screenSize, language, userAgent });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Tracking failed" });
    }
  });

  // Custom event tracking (button clicks, conversions)
  app.post("/api/track-event", async (req, res) => {
    try {
      const { eventName, eventCategory, eventValue, page, deviceId } = req.body;
      if (!eventName) return res.status(400).json({ error: "Missing eventName" });
      const { getDb } = await import("../db");
      const { sql } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        await db.execute(sql`
          INSERT INTO events (eventName, eventCategory, eventValue, page, deviceId, timestamp)
          VALUES (${eventName}, ${eventCategory || null}, ${eventValue || null}, ${page || null}, ${deviceId || null}, NOW())
        `);
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Event tracking failed" });
    }
  });

  app.get("/api/visitor-stats", async (_req, res) => {
    try {
      const stats = await getVisitorStats();
      res.json(stats);
    } catch {
      res.status(500).json({ error: "Stats unavailable" });
    }
  });

  // tRPC API with error handling and connection recovery
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error }) {
        const msg = error.message || "";
        if (msg.includes("Connection is closed") || msg.includes("ECONNRESET") || msg.includes("PROTOCOL_CONNECTION_LOST")) {
          console.log("[tRPC] DB connection error detected, resetting pool...");
          resetDbConnection().catch(() => {});
        }
      },
    })
  );
  
  // Health check endpoint for monitoring
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production environment, always use the preferred port (3000)
  // Dynamic port selection breaks OAuth redirect URI matching
  const port = preferredPort;
  // Only try alternative ports in local development if explicitly needed
  // const port = await findAvailablePort(preferredPort);
  // if (port !== preferredPort) {
  //   console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  // }

  server.listen(port, () => {
    console.log(`[Server] Running on http://localhost:${port}/`);
    console.log(`[Server] Rate limiting enabled: 1000 req/15min for API, 30 req/min for OAuth`);
    console.log(`[Server] Gzip compression: enabled (level 6)`);
    console.log(`[Server] Health check: GET /api/health`);
  });
}

startServer().catch(console.error);
