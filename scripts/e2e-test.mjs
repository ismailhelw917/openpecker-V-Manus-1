/**
 * End-to-end test: Record puzzle attempts, complete a cycle,
 * verify all data points update (stats, ELO, leaderboard)
 */

const BASE_URL = 'http://localhost:3000';

async function trpcQuery(path, input) {
  const url = `${BASE_URL}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify(input))}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.error) throw new Error(`tRPC error on ${path}: ${JSON.stringify(json.error).substring(0, 200)}`);
  return json.result?.data?.json ?? json.result?.data;
}

async function trpcMutation(path, input) {
  const url = `${BASE_URL}/api/trpc/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json: input }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`tRPC error on ${path}: ${JSON.stringify(json.error).substring(0, 200)}`);
  return json.result?.data?.json ?? json.result?.data;
}

async function main() {
  console.log('=== E2E TEST: Full Training Flow ===\n');

  const deviceId = 'e2e-test-' + Date.now();
  const trainingSetId = 'e2e-set-' + Date.now();
  const puzzleIds = ['00sOU', '00sOe', '00sOi', '00sOu', '00sP3'];
  console.log(`DeviceId: ${deviceId}`);
  console.log(`TrainingSetId: ${trainingSetId}`);

  // Step 1: Leaderboard BEFORE
  console.log('\n--- Step 1: Leaderboard BEFORE ---');
  const lb1 = await trpcQuery('stats.getLeaderboard', { limit: 500, sortBy: 'accuracy' });
  console.log(`Active entries: ${lb1.entries.length}`);

  // Step 2: Record puzzle attempts (public endpoint: attempts.record)
  console.log('\n--- Step 2: Record Puzzle Attempts ---');
  let correctCount = 0;
  let totalTimeMs = 0;

  for (let i = 0; i < puzzleIds.length; i++) {
    const isCorrect = i % 3 !== 2; // ~67% accuracy
    const timeMs = 5000 + Math.floor(Math.random() * 10000);
    if (isCorrect) correctCount++;
    totalTimeMs += timeMs;

    try {
      await trpcMutation('attempts.record', {
        puzzleId: puzzleIds[i],
        trainingSetId: trainingSetId,
        isCorrect: isCorrect,
        timeMs: timeMs,
        deviceId: deviceId,
      });
      console.log(`  Puzzle ${i + 1}/${puzzleIds.length}: ${isCorrect ? '✅' : '❌'} (${(timeMs/1000).toFixed(1)}s)`);
    } catch (e) {
      console.error(`  Puzzle ${i + 1} failed:`, e.message.substring(0, 150));
    }
  }

  // Step 3: Complete a cycle (public endpoint: cycles.create)
  console.log('\n--- Step 3: Complete Cycle ---');
  const accuracy = Math.round((correctCount / puzzleIds.length) * 100);
  try {
    await trpcMutation('cycles.create', {
      trainingSetId: trainingSetId,
      cycleNumber: 1,
      totalPuzzles: puzzleIds.length,
      correctCount: correctCount,
      totalTimeMs: totalTimeMs,
      accuracy: accuracy,
      deviceId: deviceId,
    });
    console.log(`Cycle completed: ${correctCount}/${puzzleIds.length} correct (${accuracy}%), ${(totalTimeMs/1000).toFixed(1)}s`);
  } catch (e) {
    console.error('Cycle creation failed:', e.message.substring(0, 200));
  }

  // Step 4: Check leaderboard AFTER
  console.log('\n--- Step 4: Leaderboard AFTER ---');
  const lb2 = await trpcQuery('stats.getLeaderboard', { limit: 500, sortBy: 'accuracy' });
  console.log(`Active entries: ${lb2.entries.length}`);

  const testPlayer = lb2.entries.find(e => e.deviceId === deviceId);

  console.log('\n=== DATA POINT VERIFICATION ===');
  if (testPlayer) {
    console.log(`\n✅ TEST PLAYER FOUND ON LEADERBOARD (rank #${testPlayer.rank})`);
    const checks = [
      ['Name assigned', !!testPlayer.name, testPlayer.name],
      ['Total Puzzles > 0', Number(testPlayer.totalPuzzles) > 0, testPlayer.totalPuzzles],
      ['Accuracy > 0', Number(testPlayer.accuracy) > 0, testPlayer.accuracy + '%'],
      ['Rating computed', Number(testPlayer.rating) !== 1200, testPlayer.rating],
      ['Completed Cycles > 0', Number(testPlayer.completedCycles) > 0, testPlayer.completedCycles],
      ['Total Time > 0', Number(testPlayer.totalTimeMs) > 0, testPlayer.totalTimeMs + 'ms'],
    ];
    for (const [label, passed, value] of checks) {
      console.log(`  ${passed ? '✅' : '❌'} ${label}: ${value}`);
    }
  } else {
    console.log('\n❌ TEST PLAYER NOT FOUND ON LEADERBOARD');
  }

  console.log(`\nLeaderboard: ${lb1.entries.length} → ${lb2.entries.length} (${lb2.entries.length > lb1.entries.length ? '✅ increased' : '❌ no change'})`);
  console.log('\n=== E2E TEST COMPLETE ===');
}

main().catch(console.error);
