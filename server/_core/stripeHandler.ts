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
  price_monthly: process.env.STRIPE_PRICE_MONTHLY || "price_1TBJ39FObBPpBaOOsQJSkiEu",
  price_lifetime: process.env.STRIPE_PRICE_LIFETIME || "price_1TBJ4ZFObBPpBaOOfHXsv3ET",
};

export function registerStripeRoutes(app: express.Express) {
  // Create checkout session endpoint (needs its own JSON parser since registered before global express.json)
  app.post("/api/create-checkout-session", express.json(), async (req, res) => {
    try {
      const { priceId, userId, email, promoCode, discountPercent } = req.body;

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
      
      // Determine mode based on the price type in Stripe
      const isMonthly = priceId === "price_monthly" || actualPriceId === STRIPE_PRICES.price_monthly;
      
      // Retrieve the price to check if it's recurring or one-time
      let mode: "payment" | "subscription" = "payment";
      try {
        const priceObj = await stripe.prices.retrieve(actualPriceId);
        if (priceObj.type === "recurring") {
          mode = "subscription";
        }
      } catch (e) {
        // Default to payment mode if price retrieval fails
        console.warn("Could not retrieve price type, defaulting to payment mode", e);
      }

      // Create or retrieve Stripe Customer to skip email collection on checkout
      let stripeCustomerId: string | undefined;
      try {
        // Search for existing customer by email
        const existingCustomers = await stripe.customers.list({ email, limit: 1 });
        if (existingCustomers.data.length > 0) {
          stripeCustomerId = existingCustomers.data[0].id;
        } else {
          // Create a new customer
          const customer = await stripe.customers.create({
            email,
            metadata: { userId: userId.toString() },
          });
          stripeCustomerId = customer.id;
        }
      } catch (e) {
        console.warn("Could not create/retrieve Stripe customer, falling back to customer_email", e);
      }
      
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        line_items: [
          {
            price: actualPriceId,
            quantity: 1,
          },
        ],
        mode,
        success_url: `${origin}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings?payment=cancelled`,
        client_reference_id: userId.toString(),
        metadata: {
          userId: userId.toString(),
          email,
          plan: isMonthly ? "monthly" : "lifetime",
        },
      };

      // Apply promo code as Stripe coupon if provided, otherwise allow manual entry
      if (promoCode && discountPercent > 0) {
        try {
          // Try to find or create a Stripe coupon matching the promo code
          const stripe = getStripe();
          let couponId: string | undefined;
          
          // First try to find existing coupon by the promo code name
          try {
            const coupon = await stripe.coupons.retrieve(promoCode.toLowerCase());
            couponId = coupon.id;
          } catch {
            // Coupon doesn't exist, create it
            try {
              const newCoupon = await stripe.coupons.create({
                id: promoCode.toLowerCase(),
                percent_off: discountPercent,
                duration: 'once',
                name: `Promo: ${promoCode.toUpperCase()} (${discountPercent}% off)`,
              });
              couponId = newCoupon.id;
            } catch (createErr) {
              console.warn('[Checkout] Could not create Stripe coupon:', createErr);
            }
          }
          
          if (couponId) {
            sessionParams.discounts = [{ coupon: couponId }];
            console.log(`[Checkout] Applied promo code ${promoCode} as coupon ${couponId}`);
          } else {
            // Fallback: let user enter promo on Stripe page
            sessionParams.allow_promotion_codes = true;
          }
        } catch (promoErr) {
          console.warn('[Checkout] Promo code application failed, enabling manual entry:', promoErr);
          sessionParams.allow_promotion_codes = true;
        }
      } else {
        // No promo code from app, let users enter on Stripe checkout page
        sessionParams.allow_promotion_codes = true;
      }

      // Use customer ID if available (skips email collection), otherwise fall back to customer_email
      if (stripeCustomerId) {
        sessionParams.customer = stripeCustomerId;
      } else {
        sessionParams.customer_email = email;
      }

      // Add timeout to prevent indefinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stripe checkout session creation timeout')), 10000)
      );
      const session = await Promise.race([
        stripe.checkout.sessions.create(sessionParams),
        timeoutPromise
      ]) as Stripe.Checkout.Session;

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
        const webhookSecret1 = process.env.STRIPE_WEBHOOK_SECRET || "";
        const webhookSecret2 = process.env.STRIPE_WEBHOOK_SECRET_2 || "";
        const secrets = [webhookSecret1, webhookSecret2].filter(Boolean);

        if (!sig || secrets.length === 0) {
          console.warn("Missing webhook signature or secret");
          return res.json({ received: true });
        }

        let event: Stripe.Event | null = null;
        const stripe = getStripe();

        // Try each webhook secret until one works
        for (const secret of secrets) {
          try {
            event = stripe.webhooks.constructEvent(req.body, sig, secret);
            break; // Verification succeeded
          } catch (err) {
            // Try next secret
          }
        }

        if (!event) {
          console.error("Webhook signature verification failed with all secrets");
          return res.status(400).json({ error: "Webhook signature verification failed" });
        }

        // Handle test verification events (evt_test_ prefix only)
        if (event.id.startsWith('evt_test_')) {
          console.log(`[Webhook] Test verification event detected (${event.type}, id=${event.id})`);
          return res.json({ verified: true });
        }

        // Log test mode events but still process them
        if ((event as any).livemode === false) {
          console.log(`[Webhook] Processing test mode event: ${event.type} (${event.id})`);
        }

        console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

        // Handle checkout.session.completed event
        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = parseInt(session.client_reference_id || "0");
          const customerEmail = session.customer_email || session.metadata?.email || "unknown";
          const amountTotal = session.amount_total ? (session.amount_total / 100).toFixed(2) : "unknown";
          const currency = session.currency || "eur";

          console.log(`[Webhook] Checkout completed: user=${userId}, email=${customerEmail}, amount=${amountTotal} ${currency}, session=${session.id}`);

          if (userId > 0) {
            try {
              // Update user premium status
              const db = await getDb();
              if (db) {
                await db
                  .update(users)
                  .set({ isPremium: 1 })
                  .where(eq(users.id, userId));

                console.log(`[Webhook] Premium status updated for user ${userId}`);
              }
            } catch (dbError) {
              console.error("[Webhook] Failed to update user premium status:", dbError);
            }
          } else {
            console.warn(`[Webhook] No valid userId in checkout session ${session.id}`);
          }
        }

        // Handle payment_intent.succeeded event
        if (event.type === "payment_intent.succeeded") {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          const amount = (paymentIntent.amount / 100).toFixed(2);
          console.log(`[Webhook] Payment intent succeeded: ${paymentIntent.id}, amount=${amount} ${paymentIntent.currency}`);
        }

        // Handle payment_intent.payment_failed event
        if (event.type === "payment_intent.payment_failed") {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.error(`[Webhook] Payment failed: ${paymentIntent.id}, error=${paymentIntent.last_payment_error?.message || "unknown"}`);
        }

        return res.json({ received: true });
      } catch (error) {
        console.error("Webhook error:", error);
        return res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );

  // Retrieve checkout session details (for verifying payment)
  app.get("/api/checkout-session/:sessionId", express.json(), async (req, res) => {
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
