import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { trackEvent } from '@/lib/counter-api';

/**
 * Hook to validate and repair stats data
 */
export function useStatsValidation(userId: number | undefined, stats: any) {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  const validateMutation = trpc.dataValidation.validateStats.useMutation();
  const repairMutation = trpc.dataValidation.repairStats.useMutation();

  useEffect(() => {
    if (userId && stats) {
      validateMutation.mutate(
        { userId, stats },
        {
          onSuccess: (result) => {
            setValidationResult(result);
            if (!result.isValid) {
              trackEvent('stats_validation_failed', {
                userId: userId.toString(),
                issues: result.issues.join(','),
              });
            }
          },
          onError: (error) => {
            trackEvent('stats_validation_error', {
              userId: userId.toString(),
              error: error.message,
            });
          },
        }
      );
    }
  }, [userId, stats]);

  const repairStats = async () => {
    if (!userId || !stats) return;
    setIsRepairing(true);
    repairMutation.mutate(
      { userId, stats },
      {
        onSuccess: (repaired) => {
          setIsRepairing(false);
          trackEvent('stats_repaired', {
            userId: userId.toString(),
          });
        },
        onError: (error) => {
          setIsRepairing(false);
          trackEvent('stats_repair_failed', {
            userId: userId.toString(),
            error: error.message,
          });
        },
      }
    );
  };

  return {
    validationResult,
    isValid: validationResult?.isValid ?? true,
    issues: validationResult?.issues ?? [],
    repairStats,
    isRepairing,
  };
}

/**
 * Hook to validate and repair sets data
 */
export function useSetsValidation(userId: number | undefined, sets: any[]) {
  const [validationResult, setValidationResult] = useState<any>(null);

  const validateMutation = trpc.dataValidation.validateSets.useMutation();

  useEffect(() => {
    if (userId && sets && sets.length > 0) {
      validateMutation.mutate(
        { userId, sets },
        {
          onSuccess: (result) => {
            setValidationResult(result);
            if (!result.isValid) {
              trackEvent('sets_validation_failed', {
                userId: userId.toString(),
                issues: result.issues.join(','),
                invalidSetCount: result.invalidSetCount.toString(),
              });
            }
          },
        }
      );
    }
  }, [userId, sets]);

  return {
    validationResult,
    isValid: validationResult?.isValid ?? true,
    issues: validationResult?.issues ?? [],
    invalidSetCount: validationResult?.invalidSetCount ?? 0,
  };
}

/**
 * Hook to validate and repair leaderboard data
 */
export function useLeaderboardValidation(players: any[]) {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isRepairing, setIsRepairing] = useState(false);

  const validateMutation = trpc.dataValidation.validateLeaderboard.useMutation();
  const repairMutation = trpc.dataValidation.repairLeaderboard.useMutation();

  useEffect(() => {
    if (players && players.length > 0) {
      validateMutation.mutate(
        { players },
        {
          onSuccess: (result) => {
            setValidationResult(result);
            if (!result.isValid) {
              trackEvent('leaderboard_validation_failed', {
                totalPlayers: players.length.toString(),
                issues: result.issues.join(','),
                duplicateCount: result.duplicateCount.toString(),
              });
            }
          },
        }
      );
    }
  }, [players]);

  const repairLeaderboard = async () => {
    if (!players || players.length === 0) return;
    setIsRepairing(true);
    repairMutation.mutate(
      { players },
      {
        onSuccess: (repaired) => {
          setIsRepairing(false);
          trackEvent('leaderboard_repaired', {
            originalCount: players.length.toString(),
            repairedCount: repaired.length.toString(),
          });
        },
      }
    );
  };

  return {
    validationResult,
    isValid: validationResult?.isValid ?? true,
    issues: validationResult?.issues ?? [],
    duplicateCount: validationResult?.duplicateCount ?? 0,
    repairLeaderboard,
    isRepairing,
  };
}

/**
 * Hook to check overall data consistency
 */
export function useDataConsistencyCheck() {
  const [report, setReport] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkMutation = trpc.dataValidation.checkConsistency.useQuery();

  const runCheck = async () => {
    setIsChecking(true);
    try {
      const result = await checkMutation.refetch();
      setReport(result.data);
      trackEvent('data_consistency_checked', {
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsChecking(false);
    }
  };

  return {
    report,
    isChecking,
    runCheck,
  };
}
