import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

type Period = "all" | "week" | "today";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function getRatingColor(rating: number) {
  if (rating >= 2000) return "text-yellow-400";
  if (rating >= 1600) return "text-teal-400";
  if (rating >= 1300) return "text-slate-300";
  return "text-slate-500";
}

function AccuracyBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 80 ? "#14b8a6" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden min-w-[3rem]">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs font-semibold text-slate-300 w-9 text-right shrink-0">{Math.round(pct)}%</span>
    </div>
  );
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("all");

  // All-time leaderboard (Redis)
  const { data: allTimeData, isLoading: allTimeLoading } = trpc.stats.getLeaderboard.useQuery(
    { limit: 100, sortBy: "accuracy" },
    { staleTime: 30_000, refetchInterval: 60_000 }
  );

  // Timed leaderboard (DB)
  const { data: timedData, isLoading: timedLoading } = trpc.stats.getTimedLeaderboard.useQuery(
    { period, limit: 100 },
    { staleTime: 30_000, refetchInterval: 60_000, enabled: period !== "all" }
  );

  // Today's top solver
  const { data: topSolver } = trpc.stats.getTodayTopSolver.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const isLoading = period === "all" ? allTimeLoading : timedLoading;
  const activeData = period === "all" ? allTimeData : timedData;
  const players = activeData?.players ?? [];
  const onlineCount = period === "all"
    ? (allTimeData?.summary?.activePlayers ?? 0)
    : (timedData?.onlineNow ?? 0);
  const totalPuzzles = allTimeData?.summary?.totalPuzzlesSolvedGlobally ?? 0;

  const myName = user?.name || user?.email || null;
  const myEntry = useMemo(
    () => myName ? players.find(p => p.playerName === myName) ?? null : null,
    [players, myName]
  );

  const PERIODS: { key: Period; label: string }[] = [
    { key: "all", label: "All Time" },
    { key: "week", label: "This Week" },
    { key: "today", label: "Today" },
  ];

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-slate-950 flex flex-col">

      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-2xl font-black text-white"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            # Leaderboard
          </h1>
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-xs font-semibold text-teal-300">{onlineCount} online</span>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          {totalPuzzles.toLocaleString()} puzzles solved globally
        </p>

        {/* Today's top solver card */}
        {topSolver && (
          <div className="mt-3 bg-amber-900/25 border border-amber-600/40 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl leading-none">🔥</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-0.5">Today's Top Solver</p>
              <p className="text-sm font-bold text-white truncate">{topSolver.playerName}</p>
              <p className="text-xs text-slate-400">
                {topSolver.puzzlesSolved} puzzles · {Math.round(topSolver.accuracy)}% accuracy
              </p>
            </div>
          </div>
        )}

        {/* My rank callout (all-time) */}
        {myEntry && period === "all" && (
          <div className="mt-2 bg-teal-900/30 border border-teal-700/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-teal-400 text-lg font-black">#{myEntry.rank}</span>
            <div className="min-w-0">
              <p className="text-xs text-teal-300 font-semibold truncate">Your rank</p>
              <p className="text-[11px] text-slate-400 truncate">{myName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Period filter tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              period === key
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2rem_1fr_3.5rem_5.5rem] gap-x-3 px-4 pb-1.5 border-b border-slate-800">
        <span className="text-[10px] font-bold text-slate-500 text-center">#</span>
        <span className="text-[10px] font-bold text-slate-500">PLAYER</span>
        <span className="text-[10px] font-bold text-slate-500 text-right">SOLVED</span>
        <span className="text-[10px] font-bold text-slate-500 pl-2">ACCURACY</span>
      </div>

      {/* Player rows */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex justify-center pt-12">
            <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3">
            <span className="text-4xl">♟</span>
            <p className="text-slate-400 text-sm">No activity yet for this period.</p>
          </div>
        ) : (
          players.map((p) => {
            const isMe = !!(myName && p.playerName === myName);
            const medal = MEDAL[p.rank];
            return (
              <div
                key={`${p.rank}-${p.playerName}`}
                className={`grid grid-cols-[2rem_1fr_3.5rem_5.5rem] gap-x-3 items-center py-2.5 border-b border-slate-800/60 ${
                  isMe ? "bg-teal-900/20 -mx-4 px-4" : ""
                }`}
              >
                <div className="flex justify-center">
                  {medal ? (
                    <span className="text-base leading-none">{medal}</span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">{p.rank}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? "text-teal-300" : "text-slate-200"}`}>
                    {p.playerName}
                    {isMe && <span className="ml-1 text-[10px] text-teal-400 font-normal">(you)</span>}
                  </p>
                  <p className={`text-[11px] font-medium ${getRatingColor(p.rating)}`}>
                    {p.rating} elo
                  </p>
                </div>
                <p className="text-sm font-bold text-slate-300 text-right">{p.puzzlesSolved.toLocaleString()}</p>
                <AccuracyBar value={p.accuracy} />
              </div>
            );
          })
        )}
      </div>

      {/* Sticky footer: show user's rank if they're outside the visible list */}
      {myName && !isLoading && players.length > 0 && !myEntry && (
        <div className="sticky bottom-0 bg-slate-900 border-t border-slate-700 px-4 py-3 flex items-center gap-3">
          <span className="text-slate-400 text-sm font-bold">You</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-300 truncate">{myName}</p>
          </div>
          <span className="text-xs text-slate-500">Not ranked yet</span>
        </div>
      )}
    </div>
  );
}
