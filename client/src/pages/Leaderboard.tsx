import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'accuracy' | 'speed' | 'rating'>('accuracy');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch leaderboard data - always sorted by puzzles solved
  const { data: leaderboardData, isLoading, error, refetch } = trpc.stats.getLeaderboard.useQuery({
    limit: 100,
    sortBy: 'accuracy',
  });

  // Listen for real-time leaderboard updates
  useEffect(() => {
    // Simulate listening for leaderboard updates
    // In a real Nakama setup, this would connect to Nakama's notification system
    const handleLeaderboardUpdate = () => {
      console.log('[Leaderboard] Received update notification, refreshing...');
      refetch();
    };

    // Check for updates every 3 seconds (fallback polling)
    const interval = setInterval(() => {
      handleLeaderboardUpdate();
    }, 3000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Handle response data
  const players = leaderboardData?.players || [];
  const summary = leaderboardData?.summary || {
    activePlayers: 0,
    totalPlayers: 0,
    topAccuracy: 0,
    topRating: 1200,
    averageAccuracy: 0,
    averageRating: 1200,
    totalPuzzlesSolvedGlobally: 0,
  };

  // Trigger refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      refetch();
    }
  }, [refreshTrigger, refetch]);

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-slate-400';
  };

  return (
    <div className="min-h-screen bg-yellow-400 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Trophy className="w-6 sm:w-8 h-6 sm:h-8 text-teal-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Leaderboard</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-300">Master the Woodpecker method with the best trainers</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Rank Tab - Gold Background */}
        <div className="mb-6 sm:mb-8">
          <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-lg p-3 sm:p-4 text-white">
            <div className="flex items-center gap-2">
              <Medal className="w-5 h-5 sm:w-6 sm:h-6" />
              <h2 className="text-lg sm:text-xl font-bold">Top 100 Players</h2>
            </div>
            <p className="text-xs sm:text-sm text-yellow-50 mt-1">Ranked by puzzles solved</p>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card className="bg-white border border-slate-200 p-8 sm:p-12">
            <div className="text-center text-slate-600">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
              Loading leaderboard...
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-red-50 border border-red-200 p-4 sm:p-6">
            <div className="text-center text-red-700 text-sm sm:text-base">
              Failed to load leaderboard: {error.message}
            </div>
          </Card>
        )}

        {/* Leaderboard Table - Mobile Optimized */}
        {!isLoading && !error && players.length > 0 && (
          <Card className="bg-white border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-teal-600 border-b border-teal-700">
                  <tr>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white text-xs sm:text-sm whitespace-nowrap w-10 sm:w-12">Rank</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white text-xs sm:text-sm whitespace-nowrap flex-1">Player</th>
                    <th className="text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white text-xs sm:text-sm whitespace-nowrap w-16 sm:w-20">Puzzles</th>
                    <th className="hidden sm:table-cell text-right py-2 sm:py-3 px-2 sm:px-4 font-semibold text-white text-xs sm:text-sm whitespace-nowrap w-16 sm:w-20">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player: any, index: number) => (
                    <tr
                      key={index}
                      className={`border-b border-teal-600 hover:bg-teal-400 transition-colors ${
                        index % 2 === 0 ? 'bg-teal-500' : 'bg-teal-400'
                      }`}
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4 w-10 sm:w-12">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {player.rank <= 3 && (
                            <Medal className={`w-4 h-4 sm:w-5 sm:h-5 ${getMedalColor(player.rank)}`} />
                          )}
                          <span className="font-bold text-white text-xs sm:text-sm">{player.rank}</span>
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 flex-1">
                        <span className="font-medium text-white text-xs sm:text-sm truncate block">{player.playerName}</span>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right w-16 sm:w-20">
                        <span className="text-white font-semibold text-xs sm:text-sm">{player.puzzlesSolved}</span>
                      </td>
                      <td className="hidden sm:table-cell py-2 sm:py-3 px-2 sm:px-4 text-right w-16 sm:w-20">
                        <span className="font-semibold text-yellow-300 text-xs sm:text-sm">{player.accuracy}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && players.length === 0 && (
          <Card className="bg-white border border-slate-200 p-8 sm:p-12">
            <div className="text-center">
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 font-medium text-sm sm:text-base">No players yet</p>
              <p className="text-slate-500 text-xs sm:text-sm">Start training to appear on the leaderboard!</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
