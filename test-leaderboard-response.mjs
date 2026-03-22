import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/trpc';

async function testLeaderboard() {
  try {
    console.log('Testing leaderboard endpoint...');
    
    const response = await fetch(`${BASE_URL}/stats.getLeaderboard?input={"limit":100,"sortBy":"accuracy"}`, {
      method: 'GET',
    });

    const data = await response.json();
    console.log('Response status:', response.status);
    console.log('Full response:', JSON.stringify(data, null, 2));
    
    // Check structure
    const result = data.result?.data;
    console.log('\nResult data:', result);
    console.log('Players:', result?.players);
    console.log('Summary:', result?.summary);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testLeaderboard();
