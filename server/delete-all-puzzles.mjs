import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function deletePuzzlesInBatches() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }

  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    console.log('🔍 Checking puzzle count...');
    const [[{ count }]] = await connection.query('SELECT COUNT(*) as count FROM puzzles');
    console.log(`📊 Total puzzles to delete: ${count.toLocaleString()}`);

    if (count === 0) {
      console.log('✅ No puzzles to delete - database is already clean!');
      return;
    }

    const batchSize = 100000;
    const totalBatches = Math.ceil(count / batchSize);
    let deleted = 0;

    for (let i = 0; i < totalBatches; i++) {
      try {
        const result = await connection.query(
          'DELETE FROM puzzles WHERE id IN (SELECT id FROM puzzles LIMIT ?)',
          [batchSize]
        );
        
        deleted += result[0].affectedRows || 0;
        const progress = ((i + 1) / totalBatches * 100).toFixed(1);
        const remaining = count - deleted;
        
        console.log(`[${i + 1}/${totalBatches}] (${progress}%) - Deleted: ${deleted.toLocaleString()}, Remaining: ${remaining.toLocaleString()}`);
        
        // Small delay between batches to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error in batch ${i + 1}:`, error.message);
        // Continue with next batch
      }
    }

    // Verify all puzzles are deleted
    const [[{ finalCount }]] = await connection.query('SELECT COUNT(*) as finalCount FROM puzzles');
    
    if (finalCount === 0) {
      console.log('✅ SUCCESS! All 5.4 million puzzles have been deleted.');
      console.log(`📊 Final puzzle count: ${finalCount}`);
    } else {
      console.log(`⚠️  WARNING: ${finalCount.toLocaleString()} puzzles remain in database`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

deletePuzzlesInBatches();
