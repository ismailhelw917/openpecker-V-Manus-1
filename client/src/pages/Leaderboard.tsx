import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Zap, Target, Medal } from "lucide-react";

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'accuracy' | 'speed' | 'rating'>('accuracy');

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading, error } = trpc.stats.getLeaderboard.useQuery({
    limit: 50,
    sortBy,
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

  const getSortButtonClass = (type: string) => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium transition-all';
    const isActive = sortBy === type;
    if (isActive) {
      if (type === 'rating') {
        return `${baseClass} bg-yellow-500 text-white`;
      }
      return `${baseClass} bg-teal-600 text-white`;
    }
    return `${baseClass} bg-slate-100 text-slate-700 hover:bg-slate-200`;
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-teal-50 to-white px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-8 h-8 text-teal-600" />
            <h1 className="text-3xl font-bold text-slate-900">Leaderboard</h1>
          </div>
          <p className="text-slate-600">Master the Woodpecker method with the best trainers</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="bg-white border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-600 mb-1">Active Players</div>
            <div className="text-2xl font-bold text-teal-600">{summary.activePlayers}</div>
          </Card>
          <Card className="bg-white border border-slate-200 p-4">
            <div className="text-sm font-medium text-slate-600 mb-1">Total Registered</div>
            <div className="text-2xl font-bold text-teal-600">{summary.totalPlayers}</div>
          </Card>
        </div>

        {/* Sort Buttons */}
        <div className="flex gap-3 mb-8">
          <Button
            onClick={() => setSortBy('accuracy')}
            className={getSortButtonClass('accuracy')}
            variant="outline"
          >
            <Target className="w-4 h-4 mr-2" />
            Accuracy
          </Button>
          <Button
            onClick={() => setSortBy('speed')}
            className={getSortButtonClass('speed')}
            variant="outline"
          >
            <Zap className="w-4 h-4 mr-2" />
            Speed
          </Button>
          <Button
            onClick={() => setSortBy('rating')}
            className={getSortButtonClass('rating')}
            variant="outline"
          >
            <Medal className="w-4 h-4 mr-2" />
            Rating
          </Button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <Card className="bg-white border border-slate-200 p-12">
            <div className="text-center text-slate-600">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-4"></div>
              Loading leaderboard...
            </div>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="bg-red-50 border border-red-200 p-6">
            <div className="text-center text-red-700">
              Failed to load leaderboard: {error.message}
            </div>
          </Card>
        )}

        {/* Leaderboard Table */}
        {!isLoading && !error && players.length > 0 && (
          <Card className="bg-white border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Player</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Puzzles</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Accuracy</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Rating</th>
                    <th className="text-right py-3 px-4 font-semibold text-slate-700">
                      {sortBy === 'speed' ? 'Avg Time' : 'Total Time'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player: any, index: number) => (
                    <tr
                      key={index}
                      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                      }`}
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {player.rank <= 3 && (
                            <Medal className={`w-5 h-5 ${getMedalColor(player.rank)}`} />
                          )}
                          <span className="font-bold text-slate-900 w-8">{player.rank}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="font-medium text-slate-900">{player.playerName}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-slate-700">{player.puzzlesSolved}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-teal-600">{player.accuracy}%</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-slate-900">{player.rating}</span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className="text-slate-700">
                          {sortBy === 'speed'
                            ? player.puzzlesSolved > 0
                              ? `${(player.totalMinutes / player.puzzlesSolved).toFixed(1)}m`
                              : '-'
                            : `${player.totalMinutes}m`}
                        </span>
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
          <Card className="bg-white border border-slate-200 p-12">
            <div className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 font-medium">No players yet</p>
              <p className="text-slate-500 text-sm">Start training to appear on the leaderboard!</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
