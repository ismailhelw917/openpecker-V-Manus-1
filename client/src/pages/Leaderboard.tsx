import { useEffect, useMemo, useState } from 'react';
import { trpc } from '../lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { useVisitorStats } from '@/hooks/useVisitorStats';

type SortBy = 'accuracy' | 'speed' | 'rating';

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<SortBy>('accuracy');
  const { user } = useAuth();
  const { stats: visitorStats } = useVisitorStats(30_000);
  
  // Stabilize query input to prevent infinite re-renders
  const queryInput = useMemo(() => ({
    limit: 500,
    sortBy: sortBy || 'accuracy',
  }), [sortBy]);
  
  const { data: leaderboardResult, isLoading, refetch } = trpc.stats.getLeaderboard.useQuery(queryInput);

  const entries = leaderboardResult?.entries || [];
  const onlineCount = leaderboardResult?.onlineCount || 0;

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Show all online players on the leaderboard
  const activeEntries = useMemo(() => {
    return entries; // Show all players, not just those with activity
  }, [entries]);

  const currentUserId = user?.id;

  // Format large numbers nicely
  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1 sm:mb-2">
            <h1 className="text-2xl sm:text-4xl font-bold text-amber-400">Leaderboard</h1>
            {/* Live Online Indicator */}
            <div className="flex items-center gap-2 bg-slate-900/70 border border-slate-700 rounded-full px-3 py-1.5 sm:px-4 sm:py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span className="text-green-400 font-semibold text-sm sm:text-base">
                {visitorStats.recentVisitors > onlineCount ? visitorStats.recentVisitors : onlineCount}
              </span>
              <span className="text-slate-400 text-xs sm:text-sm">online</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <p className="text-sm sm:text-base text-slate-400">
              {activeEntries.length} player{activeEntries.length !== 1 ? 's' : ''} ranked by performance
            </p>
            {visitorStats.totalVisitors > 0 && (
              <p className="text-sm sm:text-base text-slate-500">
                &middot; {formatCount(visitorStats.totalVisitors)} total visitors
                {visitorStats.todayVisitors > 0 && (
                  <span className="text-teal-400/80"> ({formatCount(visitorStats.todayVisitors)} today)</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-2 sm:gap-4 mb-6 sm:mb-8">
          {(['accuracy', 'speed', 'rating'] as SortBy[]).map((option) => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-3 sm:px-6 py-2 rounded-lg text-sm sm:text-base font-semibold transition-all ${
                sortBy === option
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {option === 'accuracy' ? 'Accuracy' : option === 'speed' ? 'Speed' : 'Rating'}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading leaderboard...</p>
          </div>
        ) : activeEntries.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-lg border border-slate-800">
            <p className="text-slate-400 text-lg mb-2">No players yet</p>
            <p className="text-slate-500 text-sm">Start training to appear on the leaderboard!</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium (desktop) */}
            {activeEntries.length >= 3 && (
              <div className="hidden sm:grid grid-cols-3 gap-4 mb-8">
                {[activeEntries[1], activeEntries[0], activeEntries[2]].map((entry: any, i: number) => {
                  const podiumOrder = [2, 1, 3];
                  const podiumRank = podiumOrder[i];
                  const isGold = podiumRank === 1;
                  const isSilver = podiumRank === 2;
                  const isMe = entry.id === currentUserId && entry.id > 0;
                  return (
                    <div
                      key={`podium-${entry.id}-${i}`}
                      className={`rounded-xl p-4 text-center border-2 transition-all ${
                        isGold
                          ? 'bg-gradient-to-b from-amber-900/40 to-amber-950/20 border-amber-400/60 shadow-lg shadow-amber-400/10 -mt-4'
                          : isSilver
                          ? 'bg-gradient-to-b from-slate-700/40 to-slate-900/20 border-slate-400/40 mt-2'
                          : 'bg-gradient-to-b from-orange-900/30 to-slate-900/20 border-orange-600/30 mt-4'
                      }`}
                    >
                      <div className={`text-3xl mb-2 ${isGold ? 'text-4xl' : ''}`}>
                        {isGold ? '\u{1F947}' : isSilver ? '\u{1F948}' : '\u{1F949}'}
                      </div>
                      <p className={`font-bold text-lg truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                        {entry.name}
                        {isMe && <span className="text-xs ml-1 text-amber-400">(You)</span>}
                      </p>
                      {entry.isPremium && (
                        <span className="text-xs text-amber-400">Premium</span>
                      )}
                      <div className="mt-3 space-y-1">
                        <p className="text-teal-400 font-bold text-xl">{entry.accuracy}%</p>
                        <p className="text-slate-400 text-xs">
                          {entry.totalPuzzles} puzzles &middot; {entry.speed}s avg
                        </p>
                        <p className="text-amber-400/80 text-sm font-semibold">
                          Rating: {entry.rating}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mobile cards for top 3 */}
            {activeEntries.length >= 1 && (
              <div className="sm:hidden space-y-3 mb-6">
                {activeEntries.slice(0, 3).map((entry: any) => {
                  const isMe = entry.id === currentUserId && entry.id > 0;
                  const medal = entry.rank === 1 ? '\u{1F947}' : entry.rank === 2 ? '\u{1F948}' : '\u{1F949}';
                  return (
                    <div
                      key={`mobile-top-${entry.id}`}
                      className={`rounded-xl p-3 border-2 flex items-center gap-3 ${
                        entry.rank === 1
                          ? 'bg-gradient-to-r from-amber-900/40 to-amber-950/20 border-amber-400/60'
                          : entry.rank === 2
                          ? 'bg-gradient-to-r from-slate-700/40 to-slate-900/20 border-slate-400/40'
                          : 'bg-gradient-to-r from-orange-900/30 to-slate-900/20 border-orange-600/30'
                      }`}
                    >
                      <span className="text-2xl">{medal}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                          {entry.name}
                          {isMe && <span className="text-xs ml-1 text-amber-400">(You)</span>}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {entry.totalPuzzles} puzzles &middot; {entry.completedCycles} cycles
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-teal-400 font-bold">{entry.accuracy}%</p>
                        <p className="text-amber-400/80 text-xs font-semibold">{entry.rating}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Players Section Header */}
            {activeEntries.length > 0 && (
              <div className="mb-3">
                <h2 className="text-sm font-semibold text-teal-400 uppercase tracking-wider">
                  Active Players ({activeEntries.length})
                </h2>
              </div>
            )}

            {/* Full Table (desktop) - Active Players */}
            <div className="hidden sm:block overflow-x-auto mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-amber-400 font-bold text-sm">#</th>
                    <th className="text-left py-3 px-4 text-amber-400 font-bold text-sm">Player</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Accuracy</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Speed</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Rating</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Puzzles</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Cycles</th>
                    <th className="text-center py-3 px-4 text-amber-400 font-bold text-sm">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEntries.map((entry: any) => {
                    const isMe = entry.id === currentUserId && entry.id > 0;
                    return (
                      <tr
                        key={`row-${entry.id}`}
                        className={`border-b border-slate-800/50 transition-colors ${
                          isMe
                            ? 'bg-amber-900/20 hover:bg-amber-900/30'
                            : 'hover:bg-slate-900/50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className={`font-bold ${entry.rank <= 3 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${isMe ? 'text-amber-300' : 'text-slate-200'}`}>
                              {entry.name}
                            </span>
                            {isMe && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-400/20 text-amber-400 rounded-full font-bold">
                                YOU
                              </span>
                            )}
                            {entry.isPremium && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                                PREMIUM
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-teal-400 font-bold">{entry.accuracy}%</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-300">{entry.speed}s</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-amber-400 font-bold">{entry.rating}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-300">{entry.totalPuzzles}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-300">{entry.completedCycles}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-slate-400 text-sm">{entry.totalTimeMin}m</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List - Active (remaining after top 3) */}
            <div className="sm:hidden space-y-2 mb-6">
              {activeEntries.slice(3).map((entry: any) => {
                const isMe = entry.id === currentUserId && entry.id > 0;
                return (
                  <div
                    key={entry.uniqueKey || `mobile-${entry.rank}`}
                    className={`rounded-lg p-3 border flex items-center gap-3 ${
                      isMe
                        ? 'bg-amber-900/20 border-amber-400/30'
                        : 'bg-slate-900/50 border-slate-800'
                    }`}
                  >
                    <span className="text-slate-400 font-bold text-sm w-6 text-center shrink-0">
                      {entry.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold text-sm truncate ${isMe ? 'text-amber-300' : 'text-slate-200'}`}>
                          {entry.name}
                        </span>
                        {isMe && (
                          <span className="text-[9px] px-1 py-0.5 bg-amber-400/20 text-amber-400 rounded-full font-bold shrink-0">
                            YOU
                          </span>
                        )}
                        {entry.isPremium && (
                          <span className="text-[9px] px-1 py-0.5 bg-amber-500/20 text-amber-400 rounded-full shrink-0">
                            PREMIUM
                          </span>
                        )}
                      </div>
                      <p className="text-slate-500 text-xs">
                        {entry.totalPuzzles} puz &middot; {entry.completedCycles} cyc &middot; {entry.speed}s
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-teal-400 font-bold text-sm">{entry.accuracy}%</p>
                      <p className="text-amber-400/70 text-xs">{entry.rating}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
