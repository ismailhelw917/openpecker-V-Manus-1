import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

// Mock checkout for development - returns a success URL
export async function createCheckoutSession(
  userId: number,
  priceId: string,
  email: string,
  origin: string
) {
  try {
    // Generate a mock checkout session ID
    const sessionId = `mock_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Return a mock checkout URL that redirects to success
    const checkoutUrl = `${origin}/checkout/success?session=${sessionId}&userId=${userId}`;
    
    console.log(`[Mock Checkout] Created session ${sessionId} for user ${userId}`);
    
    return { sessionId, url: checkoutUrl };
  } catch (error) {
    console.error("Error creating checkout session:", error);
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

    console.log(`User ${userId} upgraded to premium`);
  } catch (error) {
    console.error("Error handling payment success:", error);
    throw error;
  }
}

export async function verifyWebhookSignature(
  body: string,
  signature: string
) {
  // Mock webhook verification - always returns true for development
  console.log("[Mock Webhook] Signature verified");
  return true;
}
