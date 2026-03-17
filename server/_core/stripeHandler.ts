import express from "express";
import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Lazy-load Stripe instance to ensure environment variables are available
let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeInstance = new Stripe(apiKey);
  }
  return stripeInstance;
}

// Stripe price IDs for different plans
const STRIPE_PRICES = {
  price_monthly: process.env.STRIPE_PRICE_MONTHLY || "price_1QzXxmDvGpIqZpAf5vZ7pK2m",
  price_lifetime: process.env.STRIPE_PRICE_LIFETIME || "price_1QzXxmDvGpIqZpAf9aB8cL3n",
};

export function registerStripeRoutes(app: express.Express) {
  // Create checkout session endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { priceId, userId, email } = req.body;

      if (!priceId || !userId || !email) {
        return res.status(400).json({
          error: "Missing required fields: priceId, userId, email",
        });
      }

      // Map price key to actual Stripe price ID
      let actualPriceId = priceId;
      if (priceId in STRIPE_PRICES) {
        actualPriceId = STRIPE_PRICES[priceId as keyof typeof STRIPE_PRICES];
      } else if (!Object.values(STRIPE_PRICES).includes(priceId)) {
        return res.status(400).json({ error: "Invalid price ID" });
      }

      // Get the origin from request headers for proper redirect URLs
      const origin = req.headers.origin || "https://openpecker.manus.space";

      // Create Stripe checkout session
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: actualPriceId,
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings`,
        customer_email: email,
        client_reference_id: userId.toString(),
        metadata: {
          userId: userId.toString(),
          email,
        },
      });

      console.log(`Created Stripe checkout session ${session.id} for user ${userId}`);

      return res.json({
        url: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to create checkout session",
      });
    }
  });

  // Webhook endpoint for Stripe events
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        const sig = req.headers["stripe-signature"] as string;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

        if (!sig || !webhookSecret) {
          console.warn("Missing webhook signature or secret");
          return res.json({ received: true });
        }

        let event: Stripe.Event;

        try {
          const stripe = getStripe();
          event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            webhookSecret
          );
        } catch (err) {
          console.error("Webhook signature verification failed:", err);
          return res.status(400).json({ error: "Webhook signature verification failed" });
        }

        // Handle checkout.session.completed event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = parseInt(session.client_reference_id || "0");

          if (userId > 0) {
            try {
              // Update user premium status
              const db = await getDb();
              if (db) {
                await db
                  .update(users)
                  .set({ isPremium: 1 })
                  .where(eq(users.id, userId));

                console.log(`Payment completed for user ${userId}, premium status updated`);
              }
            } catch (dbError) {
              console.error("Failed to update user premium status:", dbError);
            }
          }
        }

        // Handle payment_intent.succeeded event
        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`Payment intent succeeded: ${paymentIntent.id}`);
        }

        return res.json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error);
        return res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );

  // Retrieve checkout session details (for verifying payment)
  app.get("/api/checkout-session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      return res.json({
        id: session.id,
        status: session.payment_status,
        customerId: session.customer,
        clientReferenceId: session.client_reference_id,
      });
    } catch (error) {
      console.error("Error retrieving checkout session:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to retrieve session",
      });
    }
  });
}
