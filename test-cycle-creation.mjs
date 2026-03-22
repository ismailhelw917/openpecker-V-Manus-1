import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/trpc';

async function testCycleCreation() {
  try {
    console.log('Testing cycle creation...');
    
    // Call cycles.create endpoint with correct schema
    const response = await fetch(`${BASE_URL}/cycles.create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        json: {
          deviceId: 'test-device-456',
          trainingSetId: 'test-set-456',
          totalPuzzles: 25,
          correctCount: 20,
          totalTimeMs: 120000,
          accuracy: 80,
        },
      }),
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));

    if (response.ok || response.status === 200) {
      console.log('✅ Cycle created successfully');
      
      // Wait a moment for cache invalidation
      await new Promise(r => setTimeout(r, 1000));
      
      // Now check if it appears in the leaderboard
      console.log('\nChecking leaderboard...');
      const leaderboardResponse = await fetch(`${BASE_URL}/stats.getLeaderboard?input={"limit":100,"sortBy":"accuracy"}`, {
        method: 'GET',
      });
      
      const leaderboardData = await leaderboardResponse.json();
      const testPlayer = leaderboardData.result?.data?.players?.find(p => p.playerName?.includes('test-device'));
      
      if (testPlayer) {
        console.log('✅ Test player found in leaderboard:', testPlayer);
      } else {
        console.log('❌ Test player NOT found in leaderboard');
        console.log('Top 5 players:', leaderboardData.result?.data?.players?.slice(0, 5));
      }
    } else {
      console.log('❌ Error creating cycle');
    }
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testCycleCreation();
