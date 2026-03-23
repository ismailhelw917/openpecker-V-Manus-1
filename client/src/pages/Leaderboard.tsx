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
    if (rank === 1) return 'bg-yellow-500/15 border-l-2 border-yellow-400';
    if (rank === 2) return 'bg-slate-500/15 border-l-2 border-slate-400';
    if (rank === 3) return 'bg-amber-700/15 border-l-2 border-amber-600';
    return index % 2 === 0 ? 'bg-slate-800/40' : 'bg-slate-800/20';
  };

  return (
    <div className="flex flex-col bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950"
         style={{ height: 'calc(100dvh - 4rem)', overflow: 'hidden' }}>

      {/* ── Header: single row, no wrapping ── */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            <h1 className="text-base font-bold text-white whitespace-nowrap">{t.leaderboard.title}</h1>
          </div>
          {/* Compact pills */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="flex items-center gap-1 bg-teal-900/60 border border-teal-700/50 rounded-full px-2 py-0.5 text-[10px] text-teal-300 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
              {summary.activePlayers}
            </span>
            <span className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-full px-2 py-0.5 text-[10px] text-slate-400 whitespace-nowrap">
              <Users className="w-2.5 h-2.5 shrink-0" />
              {summary.totalPlayers}
            </span>
          </div>
        </div>
      </div>

      {/* ── Column Headers ── */}
      {!isLoading && !error && players.length > 0 && (
        <div className="shrink-0 bg-teal-700/80 border-b border-teal-600/60">
          <div className="grid grid-cols-[1.8rem_1fr_3rem_3rem] sm:grid-cols-[2.5rem_1fr_5rem_4.5rem_4.5rem] px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-white uppercase tracking-wider">
            <span>#</span>
            <span>{t.leaderboard.player}</span>
            {/* Short labels on mobile, full on desktop */}
            <span className="text-right whitespace-nowrap sm:hidden">Solved</span>
            <span className="text-right whitespace-nowrap hidden sm:block">{t.leaderboard.puzzlesSolved}</span>
            <span className="text-right whitespace-nowrap sm:hidden">Acc</span>
            <span className="text-right whitespace-nowrap hidden sm:block">{t.leaderboard.accuracy}</span>
            <span className="hidden sm:block text-right whitespace-nowrap">{t.leaderboard.rating}</span>
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
            className={`grid grid-cols-[1.8rem_1fr_3rem_3rem] sm:grid-cols-[2.5rem_1fr_5rem_4.5rem_4.5rem] items-center px-2 sm:px-3 py-2 border-b border-slate-700/30 transition-colors hover:bg-teal-900/30 ${getRankBg(index, player.rank)}`}
          >
            {/* Rank / Medal */}
            <div className="flex items-center justify-center">
              {player.rank <= 3 ? (
                <Medal className={`w-3.5 h-3.5 ${getMedalColor(player.rank)}`} />
              ) : (
                <span className="text-[11px] font-bold text-slate-400">{player.rank}</span>
              )}
            </div>

            {/* Name — full width, no truncation on most names */}
            <div className="min-w-0 pr-1">
              <span className={`text-[13px] sm:text-sm font-medium block truncate ${player.rank <= 3 ? 'text-white' : 'text-slate-200'}`}>
                {player.playerName}
              </span>
            </div>

            {/* Puzzles solved */}
            <div className="text-right">
              <span className="text-[13px] sm:text-sm font-bold text-teal-300">{player.puzzlesSolved}</span>
            </div>

            {/* Accuracy */}
            <div className="text-right">
              <span className={`text-[11px] sm:text-xs font-semibold ${player.accuracy >= 80 ? 'text-green-400' : player.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                {Math.round(player.accuracy)}%
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
