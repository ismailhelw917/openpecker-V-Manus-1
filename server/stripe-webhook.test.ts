import { describe, it, expect } from "vitest";

describe("Stripe Webhook Secret Configuration", () => {
  it("should have STRIPE_WEBHOOK_SECRET_2 environment variable set", () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_2;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("");
    expect(typeof secret).toBe("string");
    // Webhook secrets start with whsec_
    expect(secret!.startsWith("whsec_")).toBe(true);
  });

  it("should have a valid webhook secret format", () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_2!;
    // Stripe webhook secrets are typically 30+ characters
    expect(secret.length).toBeGreaterThan(20);
    // Should only contain alphanumeric chars and underscores after prefix
    expect(secret).toMatch(/^whsec_[A-Za-z0-9]+$/);
  });
});
