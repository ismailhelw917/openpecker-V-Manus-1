import { getDb } from './server/db.ts';
import { promoCodes } from './drizzle/schema.ts';
import { nanoid } from 'nanoid';

async function createPromoCodes() {
  const db = await getDb();
  if (!db) {
    console.error('Database not available');
    process.exit(1);
  }

  try {
    // Promo code 1: openpecker50 - Free premium (100% off), max 100 uses
    const promo1 = {
      id: nanoid(),
      code: 'openpecker50',
      benefitType: 'free_premium',
      discountPercent: 100,
      description: 'Get instant premium access for free',
      maxUses: 100,
      currentUses: 0,
      isActive: true,
      createdAt: new Date(),
    };

    // Promo code 2: openpecker80 - 80% off, max 400 uses
    const promo2 = {
      id: nanoid(),
      code: 'openpecker80',
      benefitType: 'discount',
      discountPercent: 80,
      description: 'Get 80% off premium access - limited to first 400 users',
      maxUses: 400,
      currentUses: 0,
      isActive: true,
      createdAt: new Date(),
    };

    // Insert into database
    await db.insert(promoCodes).values([promo1, promo2]);

    console.log('✅ Promo codes created successfully:');
    console.log(`  - openpecker50: Free premium (100 uses max)`);
    console.log(`  - openpecker80: 80% off (400 uses max)`);
    process.exit(0);
  } catch (error) {
    console.error('Error creating promo codes:', error);
    process.exit(1);
  }
}

createPromoCodes();
