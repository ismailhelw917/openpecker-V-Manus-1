import { useEffect, useState, useMemo } from 'react';
import { trpc } from '../lib/trpc';

type SortBy = 'accuracy' | 'speed' | 'rating';

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>('accuracy');
  const utils = trpc.useUtils();
  
  const { data: leaderboardData = [], isLoading, refetch } = trpc.stats.getLeaderboard.useQuery({
    limit: 1000,
    sortBy,
  });

  // Auto-refresh leaderboard every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const displayData = useMemo(() => {
    return leaderboardData.map((user: any, index: number) => ({
      ...user,
      rank: index + 1,
    }));
  }, [leaderboardData]);

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-amber-400 mb-2">Leaderboard</h1>
          <p className="text-slate-400">All players ranked by performance</p>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setSortBy('accuracy')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              sortBy === 'accuracy'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            By Accuracy
          </button>
          <button
            onClick={() => setSortBy('speed')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              sortBy === 'speed'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            By Speed
          </button>
          <button
            onClick={() => setSortBy('rating')}
            className={`px-6 py-2 rounded-lg font-semibold transition-all ${
              sortBy === 'rating'
                ? 'bg-amber-500 text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            By Rating
          </button>
        </div>

        {/* Leaderboard Table */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading leaderboard...</p>
          </div>
        ) : displayData.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-800">
            <p className="text-slate-400">No players yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-4 px-6 text-amber-400 font-bold">Rank</th>
                  <th className="text-left py-4 px-6 text-amber-400 font-bold">Name</th>
                  <th className="text-left py-4 px-6 text-amber-400 font-bold">Status</th>
                  <th className="text-center py-4 px-6 text-amber-400 font-bold">Accuracy</th>
                  <th className="text-center py-4 px-6 text-amber-400 font-bold">Speed (s/puzzle)</th>
                  <th className="text-center py-4 px-6 text-amber-400 font-bold">Rating</th>
                  <th className="text-center py-4 px-6 text-amber-400 font-bold">Puzzles</th>
                </tr>
              </thead>
              <tbody>
                {displayData.map((user: any) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-800 hover:bg-slate-900/50 transition-colors"
                  >
                    <td className="py-4 px-6">
                      <span className="text-lg font-bold text-amber-400">#{user.rank}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-slate-200 font-semibold">{user.name}</span>
                    </td>
                    <td className="py-4 px-6">
                      {user.isPremium ? (
                        <span className="inline-block px-3 py-1 bg-amber-500/20 border border-amber-500/50 text-amber-400 rounded-full text-sm font-semibold">
                          ⭐ Premium
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 bg-slate-700/50 border border-slate-600/50 text-slate-400 rounded-full text-sm font-semibold">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-teal-400 font-bold text-lg">{user.accuracy}%</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-slate-300">{user.speed}s</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-amber-400 font-bold">{user.rating}</span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="text-slate-300">{user.totalPuzzles}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
