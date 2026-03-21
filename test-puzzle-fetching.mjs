import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { puzzles } from './drizzle/schema.ts';
import { eq, gte, lte, and } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const db = drizzle(DATABASE_URL);

const DISPLAY_TO_DB_OPENING = {
  "Queen's Gambit": 'Queens',
  'Sicilian Defence': 'Sicilian',
  'French Defence': 'French',
  'Italian Game': 'Italian',
};

async function testOpening(displayName, dbName) {
  console.log(`\n🧪 Testing: ${displayName} (DB: ${dbName})`);
  
  try {
    const result = await db
      .select()
      .from(puzzles)
      .where(
        and(
          eq(puzzles.openingName, dbName),
          gte(puzzles.rating, 0),
          lte(puzzles.rating, 3000)
        )
      )
      .limit(5);
    
    console.log(`   ✅ Found ${result.length} puzzles`);
    if (result.length > 0) {
      console.log(`   First puzzle: ${result[0].id} (rating: ${result[0].rating})`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('Testing puzzle fetching for multiple openings...');
  
  for (const [display, db] of Object.entries(DISPLAY_TO_DB_OPENING)) {
    await testOpening(display, db);
  }
  
  console.log('\n✅ Test complete');
}

main().catch(console.error);
