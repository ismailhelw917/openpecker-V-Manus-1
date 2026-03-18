import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";

const app = express();

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

// Stripe webhook (must be before express.json())
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  // This is handled by the webhook handler
  res.json({ received: true });
});

// Stripe checkout session endpoint
app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { priceId, planName, userId, email } = req.body;
    
    // Stripe checkout logic here
    res.json({ url: "https://checkout.stripe.com/..." });
  } catch (error) {
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

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
