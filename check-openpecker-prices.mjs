import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function checkPrices() {
  console.log('=== OPENPECKER PRICE POINTS ===\n');
  
  const prices = await stripe.prices.list({ limit: 100 });
  
  const openpeckerPrices = [];
  
  for (const price of prices.data) {
    if (price.product) {
      const product = await stripe.products.retrieve(price.product);
      if (product.name.toLowerCase().includes('pecker') || product.name.toLowerCase().includes('open')) {
        openpeckerPrices.push({ price, product });
      }
    }
  }
  
  console.log(`Found ${openpeckerPrices.length} price points:\n`);
  
  openpeckerPrices.forEach((item, idx) => {
    const { price, product } = item;
    const amount = (price.unit_amount / 100).toFixed(2);
    const currency = price.currency.toUpperCase();
    const type = price.type === 'recurring' ? `Recurring (${price.recurring.interval})` : 'One-time';
    
    console.log(`${idx + 1}. ${product.name}`);
    console.log(`   Price: €${amount} ${currency}`);
    console.log(`   Type: ${type}`);
    console.log(`   Price ID: ${price.id}\n`);
  });
}

checkPrices().catch(console.error);
