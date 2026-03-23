import { trpc } from "@/lib/trpc";
import { Trophy, Medal, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

// Stable query input — defined outside the component so the reference never changes
const LEADERBOARD_QUERY_INPUT = { limit: 100, sortBy: 'accuracy' as const };

export function Leaderboard() {
  const { t } = useLanguage();

  const { data: leaderboardData, isLoading, error } = trpc.stats.getLeaderboard.useQuery(
    LEADERBOARD_QUERY_INPUT,
    { staleTime: 0, refetchInterval: 10_000, refetchOnWindowFocus: true }
  );

  const players = leaderboardData?.players || [];
  const summary = leaderboardData?.summary || {
    activePlayers: 0,
    totalPlayers: 0,
    topAccuracy: 0,
    totalPuzzlesSolvedGlobally: 0,
  };

  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400';
    if (rank === 2) return 'text-slate-300';
    if (rank === 3) return 'text-amber-600';
    return '';
  };

  const getRankBg = (index: number, rank: number) => {
    if (rank === 1) return 'bg-yellow-500/20 border-l-2 border-yellow-400';
    if (rank === 2) return 'bg-slate-500/20 border-l-2 border-slate-400';
    if (rank === 3) return 'bg-amber-700/20 border-l-2 border-amber-600';
    return index % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-800/20';
  };

  return (
    // Fill the viewport between top and bottom nav — no page scroll
    <div className="flex flex-col bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950"
         style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}
         /* 4rem = h-16 bottom nav on mobile; on sm+ it's h-20 (5rem) but the extra space is fine */>

      {/* ── Compact Header ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <h1 className="text-lg font-bold text-white">{t.leaderboard.title}</h1>
          </div>
          {/* Live stats pills */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 bg-teal-900/60 border border-teal-700/50 rounded-full px-2.5 py-0.5 text-xs text-teal-300">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              {summary.activePlayers} online
            </span>
            <span className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-full px-2.5 py-0.5 text-xs text-slate-400">
              <Users className="w-3 h-3" />
              {summary.totalPlayers}
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-0.5">Ranked by puzzles solved · updates every 10 s</p>
      </div>

      {/* ── Column Header (sticky, outside scroll area) ── */}
      {!isLoading && !error && players.length > 0 && (
        <div className="shrink-0 bg-teal-700/80 border-b border-teal-600/60">
          <div className="grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem_5rem] px-3 py-2 text-xs font-semibold text-white uppercase tracking-wide">
            <span>#</span>
            <span>{t.leaderboard.player}</span>
            <span className="text-right">{t.leaderboard.puzzlesSolved}</span>
            <span className="text-right">{t.leaderboard.accuracy}</span>
            <span className="hidden sm:block text-right">Rating</span>
          </div>
        </div>
      )}

      {/* ── Scrollable Player List ── */}
      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
            <span className="text-sm">{t.leaderboard.loading}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-400 text-sm px-4">
              Failed to load leaderboard: {error.message}
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && players.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <Trophy className="w-10 h-10 text-slate-600" />
            <p className="text-sm">{t.leaderboard.noPlayers}</p>
          </div>
        )}

        {/* Player rows */}
        {!isLoading && !error && players.map((player: any, index: number) => (
          <div
            key={player.rank}
            className={`grid grid-cols-[2.5rem_1fr_4.5rem_4.5rem] sm:grid-cols-[3rem_1fr_5rem_5rem_5rem] items-center px-3 py-2.5 border-b border-slate-700/30 transition-colors hover:bg-teal-900/30 ${getRankBg(index, player.rank)}`}
          >
            {/* Rank / Medal */}
            <div className="flex items-center">
              {player.rank <= 3 ? (
                <Medal className={`w-4 h-4 ${getMedalColor(player.rank)}`} />
              ) : (
                <span className="text-xs font-bold text-slate-400">{player.rank}</span>
              )}
            </div>

            {/* Name */}
            <div className="min-w-0 pr-2">
              <span className={`text-sm font-medium truncate block ${player.rank <= 3 ? 'text-white' : 'text-slate-200'}`}>
                {player.playerName}
              </span>
            </div>

            {/* Puzzles solved */}
            <div className="text-right">
              <span className="text-sm font-bold text-teal-300">{player.puzzlesSolved}</span>
            </div>

            {/* Accuracy */}
            <div className="text-right">
              <span className={`text-xs font-semibold ${player.accuracy >= 80 ? 'text-green-400' : player.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {player.accuracy}%
              </span>
            </div>

            {/* Rating (desktop only) */}
            <div className="hidden sm:block text-right">
              <span className="text-xs text-slate-400">{player.rating}</span>
            </div>
          </div>
        ))}

        {/* Bottom padding so last row isn't hidden behind nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}
