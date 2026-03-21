import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerGoogleOAuthRoutes } from "./_core/google-oauth";
import { registerStripeRoutes } from "./_core/stripeHandler";
import { trackVisitor, getVisitorStats } from "./visitor-tracking";

const app = express();

// IMPORTANT: Register Stripe routes BEFORE express.json() so webhook gets raw body
registerStripeRoutes(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OAuth routes
registerOAuthRoutes(app);
registerGoogleOAuthRoutes(app);

// Visitor tracking endpoint - lightweight, fire-and-forget
app.post("/api/track", async (req, res) => {
  try {
    const { fingerprint, page, referrer, screenSize, language } = req.body;
    if (!fingerprint || !page) {
      return res.status(400).json({ error: "fingerprint and page required" });
    }
    const userAgent = req.headers["user-agent"] || "";
    // Fire and forget - don't block the response
    trackVisitor({ fingerprint, page, referrer, screenSize, language, userAgent }).catch(() => {});
    res.json({ ok: true });
  } catch {
    res.json({ ok: true }); // Never fail the tracking endpoint
  }
});

// Visitor stats endpoint (public, cached)
app.get("/api/visitor-stats", async (req, res) => {
  try {
    const stats = await getVisitorStats();
    res.json(stats);
  } catch {
    res.json({ totalVisitors: 0, todayVisitors: 0, totalPageViews: 0, todayPageViews: 0 });
  }
});

// tRPC routes
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve static files from client/dist
app.use(express.static("client/dist"));

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile("client/dist/index.html", { root: process.cwd() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
