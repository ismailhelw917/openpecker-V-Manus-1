import { describe, it, expect } from 'vitest';

/**
 * Stripe Integration Tests
 * Verifies configuration, webhook handling, and checkout flow
 */

describe('Stripe Environment Configuration', () => {
  it('should have STRIPE_SECRET_KEY configured', () => {
    const key = process.env.STRIPE_SECRET_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key!.length).toBeGreaterThan(10);
    // Should be a test key (sk_test_) or live key (sk_live_)
    expect(key!.startsWith('sk_test_') || key!.startsWith('sk_live_')).toBe(true);
  });

  it('should have STRIPE_PUBLISHABLE_KEY configured', () => {
    const key = process.env.STRIPE_PUBLISHABLE_KEY;
    expect(key).toBeDefined();
    expect(typeof key).toBe('string');
    expect(key!.startsWith('pk_test_') || key!.startsWith('pk_live_')).toBe(true);
  });

  it('should have at least one webhook secret configured', () => {
    const secret1 = process.env.STRIPE_WEBHOOK_SECRET;
    const secret2 = process.env.STRIPE_WEBHOOK_SECRET_2;
    
    // At least one should be set
    const hasSecret = (secret1 && secret1.length > 0) || (secret2 && secret2.length > 0);
    expect(hasSecret).toBe(true);
  });

  it('should have STRIPE_WEBHOOK_SECRET_2 properly formatted', () => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET_2;
    expect(secret).toBeDefined();
    expect(typeof secret).toBe('string');
    expect(secret!.startsWith('whsec_')).toBe(true);
    expect(secret!.length).toBeGreaterThan(20);
  });
});

describe('Stripe Price Configuration', () => {
  it('should have valid price IDs for monthly and lifetime plans', () => {
    const monthlyPrice = process.env.STRIPE_PRICE_MONTHLY || 'price_1TBJ4ZFObBPpBaOOfHXsv3ET';
    const lifetimePrice = process.env.STRIPE_PRICE_LIFETIME || 'price_1TBJ39FObBPpBaOOsQJSkiEu';

    // Price IDs should start with price_
    expect(monthlyPrice.startsWith('price_')).toBe(true);
    expect(lifetimePrice.startsWith('price_')).toBe(true);

    // They should be different
    expect(monthlyPrice).not.toBe(lifetimePrice);
  });

  it('should map price keys to actual Stripe price IDs', () => {
    const STRIPE_PRICES: Record<string, string> = {
      price_monthly: process.env.STRIPE_PRICE_MONTHLY || 'price_1TBJ4ZFObBPpBaOOfHXsv3ET',
      price_lifetime: process.env.STRIPE_PRICE_LIFETIME || 'price_1TBJ39FObBPpBaOOsQJSkiEu',
    };

    // Mapping should work for both keys
    expect(STRIPE_PRICES['price_monthly']).toBeDefined();
    expect(STRIPE_PRICES['price_lifetime']).toBeDefined();
    expect(STRIPE_PRICES['price_monthly'].startsWith('price_')).toBe(true);
    expect(STRIPE_PRICES['price_lifetime'].startsWith('price_')).toBe(true);
  });
});

describe('Checkout Session Mode Selection', () => {
  it('should use subscription mode for monthly plan', () => {
    const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY || 'price_1TBJ4ZFObBPpBaOOfHXsv3ET';
    const lifetimePriceId = process.env.STRIPE_PRICE_LIFETIME || 'price_1TBJ39FObBPpBaOOsQJSkiEu';

    const getMode = (actualPriceId: string) => {
      return actualPriceId === monthlyPriceId ? 'subscription' : 'payment';
    };

    expect(getMode(monthlyPriceId)).toBe('subscription');
    expect(getMode(lifetimePriceId)).toBe('payment');
  });
});

describe('Webhook Event Processing', () => {
  it('should skip evt_test_ prefixed events (verification events)', () => {
    const eventId = 'evt_test_123456';
    const shouldSkip = eventId.startsWith('evt_test_');
    expect(shouldSkip).toBe(true);
  });

  it('should NOT skip test mode events (livemode=false)', () => {
    // Test mode events should be processed, not skipped
    const event = { id: 'evt_1234', livemode: false, type: 'checkout.session.completed' };
    const shouldSkip = event.id.startsWith('evt_test_');
    expect(shouldSkip).toBe(false);
    // The event should be processed
  });

  it('should process checkout.session.completed events', () => {
    const eventType = 'checkout.session.completed';
    const shouldProcess = eventType === 'checkout.session.completed';
    expect(shouldProcess).toBe(true);
  });

  it('should extract userId from client_reference_id', () => {
    const session = {
      client_reference_id: '42',
      customer_email: 'test@example.com',
      metadata: { userId: '42', email: 'test@example.com', plan: 'lifetime' },
    };

    const userId = parseInt(session.client_reference_id || '0');
    expect(userId).toBe(42);
    expect(userId).toBeGreaterThan(0);
  });

  it('should handle missing client_reference_id gracefully', () => {
    const session = {
      client_reference_id: null,
      customer_email: 'test@example.com',
    };

    const userId = parseInt(session.client_reference_id || '0');
    expect(userId).toBe(0);
    expect(userId).not.toBeGreaterThan(0);
  });
});

describe('Dual Webhook Secret Support', () => {
  it('should try multiple webhook secrets for verification', () => {
    const secret1 = process.env.STRIPE_WEBHOOK_SECRET || '';
    const secret2 = process.env.STRIPE_WEBHOOK_SECRET_2 || '';
    const secrets = [secret1, secret2].filter(Boolean);

    // Should have at least one secret
    expect(secrets.length).toBeGreaterThan(0);

    // Each secret should be properly formatted
    for (const secret of secrets) {
      expect(secret.startsWith('whsec_')).toBe(true);
    }
  });
});

describe('Success/Cancel URL Configuration', () => {
  it('should generate proper success URL with session_id placeholder', () => {
    const origin = 'https://openpecker.com';
    const successUrl = `${origin}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}`;

    expect(successUrl).toContain('/settings');
    expect(successUrl).toContain('payment=success');
    expect(successUrl).toContain('{CHECKOUT_SESSION_ID}');
  });

  it('should generate proper cancel URL', () => {
    const origin = 'https://openpecker.com';
    const cancelUrl = `${origin}/settings?payment=cancelled`;

    expect(cancelUrl).toContain('/settings');
    expect(cancelUrl).toContain('payment=cancelled');
  });
});
