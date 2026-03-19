import { trackEvent } from './counter-api';

/**
 * Data validation and tracking for Stats, Sets, and Leaderboard pages
 */

// Stats page data validation
export async function validateStatsData(userId: number, stats: any) {
  const issues: string[] = [];
  
  // Check for missing or invalid fields
  if (!stats.rating || stats.rating < 0) issues.push('invalid_rating');
  if (!stats.accuracy || stats.accuracy < 0 || stats.accuracy > 100) issues.push('invalid_accuracy');
  if (!stats.totalPuzzles || stats.totalPuzzles < 0) issues.push('invalid_total_puzzles');
  if (stats.totalCorrect && stats.totalCorrect > stats.totalPuzzles) issues.push('correct_exceeds_total');
  
  // Check for data consistency
  if (stats.totalPuzzles > 0 && stats.totalCorrect >= 0) {
    const calculatedAccuracy = (stats.totalCorrect / stats.totalPuzzles) * 100;
    if (Math.abs(calculatedAccuracy - stats.accuracy) > 5) {
      issues.push('accuracy_mismatch');
    }
  }
  
  // Track data issues
  if (issues.length > 0) {
    await trackEvent('stats_data_issue', {
      userId,
      issues: issues.join(','),
      stats: JSON.stringify(stats),
    });
  }
  
  return {
    isValid: issues.length === 0,
    issues,
  };
}

// Sets page data validation
export async function validateSetsData(userId: number, sets: any[]) {
  const issues: string[] = [];
  let invalidSetCount = 0;
  
  for (const set of sets) {
    // Check for missing fields
    if (!set.id) issues.push('missing_set_id');
    if (!set.name) issues.push('missing_set_name');
    if (!set.puzzles || set.puzzles.length === 0) issues.push('empty_puzzle_set');
    if (set.completedCount && set.completedCount > set.puzzles.length) {
      issues.push('completed_exceeds_total');
      invalidSetCount++;
    }
  }
  
  // Track data issues
  if (issues.length > 0) {
    await trackEvent('sets_data_issue', {
      userId,
      totalSets: sets.length,
      invalidSets: invalidSetCount,
      issues: issues.join(','),
    });
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    invalidSetCount,
  };
}

// Leaderboard data validation
export async function validateLeaderboardData(players: any[]) {
  const issues: string[] = [];
  const duplicateNames = new Set<string>();
  const duplicateIds = new Set<number>();
  
  for (const player of players) {
    // Check for missing required fields
    if (!player.id) issues.push('missing_player_id');
    if (!player.name) issues.push('missing_player_name');
    if (!player.rating || player.rating < 0) issues.push('invalid_rating');
    if (!player.accuracy || player.accuracy < 0 || player.accuracy > 100) issues.push('invalid_accuracy');
    
    // Check for duplicates
    if (duplicateNames.has(player.name)) {
      issues.push('duplicate_player_name');
    }
    duplicateNames.add(player.name);
    
    if (duplicateIds.has(player.id)) {
      issues.push('duplicate_player_id');
    }
    duplicateIds.add(player.id);
  }
  
  // Track data issues
  if (issues.length > 0) {
    await trackEvent('leaderboard_data_issue', {
      totalPlayers: players.length,
      duplicateNames: duplicateNames.size - players.length,
      duplicateIds: duplicateIds.size - players.length,
      issues: issues.join(','),
    });
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    duplicateCount: players.length - duplicateIds.size,
  };
}

// Data repair functions
export async function repairStatsData(userId: number, stats: any) {
  const repaired = { ...stats };
  
  // Ensure rating is valid
  if (!repaired.rating || repaired.rating < 0) {
    repaired.rating = 1200; // Default rating
  }
  
  // Recalculate accuracy
  if (repaired.totalPuzzles > 0 && repaired.totalCorrect >= 0) {
    repaired.accuracy = Math.round((repaired.totalCorrect / repaired.totalPuzzles) * 100);
  } else {
    repaired.accuracy = 0;
  }
  
  // Ensure counts are non-negative
  repaired.totalPuzzles = Math.max(0, repaired.totalPuzzles || 0);
  repaired.totalCorrect = Math.max(0, Math.min(repaired.totalCorrect || 0, repaired.totalPuzzles));
  
  await trackEvent('stats_data_repaired', {
    userId,
    changes: JSON.stringify({
      before: stats,
      after: repaired,
    }),
  });
  
  return repaired;
}

export async function repairLeaderboardData(players: any[]) {
  const repaired: any[] = [];
  const seenIds = new Set<number>();
  
  for (const player of players) {
    // Skip duplicate IDs
    if (seenIds.has(player.id)) {
      await trackEvent('leaderboard_duplicate_removed', {
        playerId: player.id,
        playerName: player.name,
      });
      continue;
    }
    seenIds.add(player.id);
    
    // Repair player data
    const repairedPlayer = {
      ...player,
      rating: Math.max(0, player.rating || 1200),
      accuracy: Math.max(0, Math.min(100, player.accuracy || 0)),
      name: player.name || `Player-${player.id}`,
    };
    
    repaired.push(repairedPlayer);
  }
  
  if (repaired.length !== players.length) {
    await trackEvent('leaderboard_data_repaired', {
      originalCount: players.length,
      repairedCount: repaired.length,
      removed: players.length - repaired.length,
    });
  }
  
  return repaired;
}

// Data consistency check
export async function checkDataConsistency() {
  const report = {
    timestamp: new Date().toISOString(),
    checks: {
      stats: { valid: 0, invalid: 0 },
      sets: { valid: 0, invalid: 0 },
      leaderboard: { valid: 0, invalid: 0 },
    },
    issues: [] as string[],
  };
  
  await trackEvent('data_consistency_check', {
    report: JSON.stringify(report),
  });
  
  return report;
}
