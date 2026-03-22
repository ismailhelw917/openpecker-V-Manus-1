import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Medal } from "lucide-react";

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'accuracy' | 'speed' | 'rating'>('accuracy');

  // Fetch leaderboard data - always sorted by puzzles solved
  const { data: leaderboardData, isLoading, error } = trpc.stats.getLeaderboard.useQuery({
    limit: 100,
    sortBy: 'accuracy',
  });

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

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-500';
    if (rank === 2) return 'text-gray-400';
    if (rank === 3) return 'text-orange-600';
    return 'text-slate-400';
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Trophy className="w-6 sm:w-8 h-6 sm:h-8 text-teal-600" />
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Leaderboard</h1>
          </div>
          <p className="text-sm sm:text-base text-slate-600">Master the Woodpecker method with the best trainers</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-white border border-slate-200 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Active Players</div>
            <div className="text-xl sm:text-2xl font-bold text-teal-600">{summary.activePlayers}</div>
          </Card>
          <Card className="bg-white border border-slate-200 p-3 sm:p-4">
            <div className="text-xs sm:text-sm font-medium text-slate-600 mb-1">Total Registered</div>
            <div className="text-xl sm:text-2xl font-bold text-teal-600">{summary.totalPlayers}</div>
          </Card>
        </div>

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
              <table className="w-full text-sm sm:text-base">
                <thead className="bg-teal-600 border-b border-teal-700">
                  <tr>
                    <th className="text-left py-3 sm:py-4 px-3 sm:px-6 font-semibold text-white w-12 sm:w-16">Rank</th>
                    <th className="text-left py-3 sm:py-4 px-3 sm:px-6 font-semibold text-white min-w-32 sm:min-w-40">Player</th>
                    <th className="text-right py-3 sm:py-4 px-3 sm:px-6 font-semibold text-white w-20 sm:w-24">Puzzles</th>
                    <th className="hidden sm:table-cell text-right py-3 sm:py-4 px-3 sm:px-6 font-semibold text-white w-24 sm:w-28">Accuracy</th>
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
                      <td className="py-3 sm:py-4 px-3 sm:px-6 w-12 sm:w-16">
                        <div className="flex items-center gap-2 sm:gap-3">
                          {player.rank <= 3 && (
                            <Medal className={`w-5 h-5 sm:w-6 sm:h-6 ${getMedalColor(player.rank)}`} />
                          )}
                          <span className="font-bold text-white text-sm sm:text-base">{player.rank}</span>
                        </div>
                      </td>
                      <td className="py-3 sm:py-4 px-3 sm:px-6 min-w-32 sm:min-w-40">
                        <span className="font-medium text-white text-sm sm:text-base truncate block">{player.playerName}</span>
                      </td>
                      <td className="py-3 sm:py-4 px-3 sm:px-6 text-right w-20 sm:w-24">
                        <span className="text-white font-semibold text-sm sm:text-base">{player.puzzlesSolved}</span>
                      </td>
                      <td className="hidden sm:table-cell py-3 sm:py-4 px-3 sm:px-6 text-right w-24 sm:w-28">
                        <span className="font-semibold text-yellow-300 text-sm sm:text-base">{player.accuracy}%</span>
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
