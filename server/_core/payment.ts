import Stripe from "stripe";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { ENV } from "./env";

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acpi",
});

// Premium product price ID (should be configured in Stripe dashboard)
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || "price_premium";

export async function createCheckoutSession(
  userId: number,
  priceId: string,
  email: string,
  origin: string,
  promoCode?: string
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not configured");
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price: priceId,
        quantity: 1,
      },
    ];

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancel`,
      customer_email: email,
      client_reference_id: userId.toString(),
      metadata: {
        user_id: userId.toString(),
        customer_email: email,
      },
      allow_promotion_codes: true,
    };

    // If promo code is provided, add it as a discount
    if (promoCode) {
      sessionParams.discounts = [
        {
          coupon: promoCode.toLowerCase(),
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log(`[Stripe] Created checkout session ${session.id} for user ${userId}`);

    return {
      sessionId: session.id,
      url: session.url,
    };
  } catch (error) {
    console.error("[Stripe] Error creating checkout session:", error);
    throw error;
  }
}

export async function handlePaymentSuccess(userId: number) {
  try {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Update user to premium
    await db
      .update(users)
      .set({ isPremium: 1 })
      .where(eq(users.id, userId));

    console.log(`[Stripe] User ${userId} upgraded to premium`);
  } catch (error) {
    console.error("[Stripe] Error handling payment success:", error);
    throw error;
  }
}

export async function verifyWebhookSignature(
  body: string,
  signature: string
): Promise<Stripe.Event> {
  try {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error("Stripe webhook secret not configured");
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    return event;
  } catch (error) {
    console.error("[Stripe] Webhook verification failed:", error);
    throw error;
  }
}

export async function handleWebhookEvent(event: Stripe.Event) {
  try {
    switch (event.type) {
      case "checkout.session.completed":
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.client_reference_id) {
          const userId = parseInt(session.client_reference_id);
          await handlePaymentSuccess(userId);
        }
        break;

      case "payment_intent.succeeded":
        console.log("[Stripe] Payment intent succeeded");
        break;

      case "charge.failed":
        console.log("[Stripe] Charge failed");
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error("[Stripe] Error handling webhook event:", error);
    throw error;
  }
}

/**
 * Create a Stripe coupon for promotional codes
 */
export async function createStripeCoupon(
  code: string,
  discountPercent: number,
  maxRedemptions?: number,
  expiresAt?: Date
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not configured");
    }

    const couponParams: Stripe.CouponCreateParams = {
      percent_off: discountPercent,
      duration: "repeating",
      duration_in_months: 12,
    };

    if (maxRedemptions) {
      couponParams.max_redemptions = maxRedemptions;
    }

    if (expiresAt) {
      couponParams.redeem_by = Math.floor(expiresAt.getTime() / 1000);
    }

    const coupon = await stripe.coupons.create(couponParams);

    // Create a promotion code that uses this coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toLowerCase(),
    });

    console.log(`[Stripe] Created coupon ${coupon.id} with promo code ${code}`);

    return {
      couponId: coupon.id,
      promoCode: promoCode.code,
    };
  } catch (error) {
    console.error("[Stripe] Error creating coupon:", error);
    throw error;
  }
}

/**
 * Create a free coupon for instant premium access
 */
export async function createFreePremiumCoupon(
  code: string,
  maxRedemptions?: number
) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not configured");
    }

    const couponParams: Stripe.CouponCreateParams = {
      percent_off: 100, // 100% off = free
      duration: "repeating",
      duration_in_months: 12,
    };

    if (maxRedemptions) {
      couponParams.max_redemptions = maxRedemptions;
    }

    const coupon = await stripe.coupons.create(couponParams);

    // Create a promotion code that uses this coupon
    const promoCode = await stripe.promotionCodes.create({
      coupon: coupon.id,
      code: code.toLowerCase(),
    });

    console.log(`[Stripe] Created free premium coupon ${coupon.id} with promo code ${code}`);

    return {
      couponId: coupon.id,
      promoCode: promoCode.code,
    };
  } catch (error) {
    console.error("[Stripe] Error creating free premium coupon:", error);
    throw error;
  }
}

/**
 * Get coupon details
 */
export async function getCouponDetails(couponId: string) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("Stripe secret key not configured");
    }

    const coupon = await stripe.coupons.retrieve(couponId);
    return coupon;
  } catch (error) {
    console.error("[Stripe] Error retrieving coupon:", error);
    throw error;
  }
}
