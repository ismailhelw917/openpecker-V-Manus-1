import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) {
  console.error('STRIPE_SECRET_KEY not set');
  process.exit(1);
}

const stripe = new Stripe(apiKey);

async function createCoupons() {
  try {
    // First check existing coupons
    const existingCoupons = await stripe.coupons.list({ limit: 10 });
    console.log('Existing coupons:', existingCoupons.data.map(c => `${c.id} (${c.percent_off}% off)`));

    // Create 70% off coupon with the code as the ID
    let coupon70;
    try {
      coupon70 = await stripe.coupons.create({
        id: 'CHESS70',
        percent_off: 70,
        duration: 'forever',
        name: 'OpenPecker 70% OFF - Facebook Launch',
        max_redemptions: 100,
      });
      console.log('\n70% coupon created:', coupon70.id);
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('\n70% coupon CHESS70 already exists');
        coupon70 = await stripe.coupons.retrieve('CHESS70');
      } else {
        throw e;
      }
    }

    // Create promotion code for 70% coupon
    try {
      const promo70 = await stripe.promotionCodes.create({
        coupon: 'CHESS70',
        code: 'CHESS70',
        max_redemptions: 100,
        active: true,
      });
      console.log('70% promo code created:', promo70.code);
    } catch (e) {
      console.log('70% promo code note:', e.message);
    }

    // Create 60% off coupon
    let coupon60;
    try {
      coupon60 = await stripe.coupons.create({
        id: 'CHESS60',
        percent_off: 60,
        duration: 'forever',
        name: 'OpenPecker 60% OFF - Facebook Launch',
        max_redemptions: 200,
      });
      console.log('\n60% coupon created:', coupon60.id);
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('\n60% coupon CHESS60 already exists');
        coupon60 = await stripe.coupons.retrieve('CHESS60');
      } else {
        throw e;
      }
    }

    // Create promotion code for 60% coupon
    try {
      const promo60 = await stripe.promotionCodes.create({
        coupon: 'CHESS60',
        code: 'CHESS60',
        max_redemptions: 200,
        active: true,
      });
      console.log('60% promo code created:', promo60.code);
    } catch (e) {
      console.log('60% promo code note:', e.message);
    }

    console.log('\n=== SUMMARY ===');
    console.log('70% OFF code: CHESS70 (max 100 uses)');
    console.log('60% OFF code: CHESS60 (max 200 uses)');
    console.log('\nCheckout has allow_promotion_codes: true, so users can enter these at checkout.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

createCoupons();
