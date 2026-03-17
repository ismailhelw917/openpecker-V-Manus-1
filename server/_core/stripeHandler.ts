import express from "express";

// Stripe price IDs for different plans
const STRIPE_PRICES = {
  price_monthly: "price_1QzXxmDvGpIqZpAf5vZ7pK2m", // €4.99/month
  price_lifetime: "price_1QzXxmDvGpIqZpAf9aB8cL3n", // €49 lifetime
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

      // For now, return a placeholder response
      // In production, this would create an actual Stripe session
      const checkoutUrl = `https://checkout.stripe.com/pay/cs_test_${Date.now()}`;

      console.log(`Creating checkout session for user ${userId} with price ${actualPriceId}`);

      return res.json({
        url: checkoutUrl,
        sessionId: `cs_test_${Date.now()}`,
      });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        error: "Failed to create checkout session",
      });
    }
  });

  // Webhook endpoint for Stripe events
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      try {
        // For now, just acknowledge the webhook
        // In production, this would verify the signature and process the event

        const event = req.body;

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const userId = parseInt(session.client_reference_id);

          // TODO: Update user premium status in database
          console.log(`Payment completed for user ${userId}`);
        }

        return res.json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error);
        return res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );
}
