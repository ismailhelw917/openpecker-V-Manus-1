import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStripeRoutes } from "./_core/stripeHandler";

const app = express();

// IMPORTANT: Register Stripe routes BEFORE express.json() so webhook gets raw body
registerStripeRoutes(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OAuth routes
registerOAuthRoutes(app);

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
