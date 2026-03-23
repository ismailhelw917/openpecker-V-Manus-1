import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const LB_INPUT = { limit: 100, sortBy: "accuracy" as const };

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
  const [tab, setTab] = useState<"all" | "online">("all");

  const { data, isLoading } = trpc.stats.getLeaderboard.useQuery(LB_INPUT, {
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const players = data?.players ?? [];
  const onlineCount = data?.summary?.activePlayers ?? 0;
  const totalPuzzles = data?.summary?.totalPuzzlesSolvedGlobally ?? 0;

  const myName = user?.name || user?.email || null;
  const myRank = myName ? players.find(p => p.playerName === myName)?.rank ?? null : null;

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

        {/* My rank callout */}
        {myRank && (
          <div className="mt-3 bg-teal-900/30 border border-teal-700/50 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-teal-400 text-lg font-black">#{myRank}</span>
            <div className="min-w-0">
              <p className="text-xs text-teal-300 font-semibold truncate">Your rank</p>
              <p className="text-[11px] text-slate-400 truncate">{myName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 mb-3">
        {(["all", "online"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t
                ? "bg-teal-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t === "all" ? `All Players (${players.length})` : `Online Now (${onlineCount})`}
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
            <p className="text-slate-400 text-sm">No players yet. Be the first!</p>
          </div>
        ) : (
          players.map((p) => {
            const isMe = myName && p.playerName === myName;
            const medal = MEDAL[p.rank];
            return (
              <div
                key={p.rank}
                className={`grid grid-cols-[2rem_1fr_3.5rem_5.5rem] gap-x-3 items-center py-2.5 border-b border-slate-800/60 ${
                  isMe ? "bg-teal-900/20 -mx-4 px-4 rounded-none" : ""
                }`}
              >
                {/* Rank */}
                <div className="flex justify-center">
                  {medal ? (
                    <span className="text-base leading-none">{medal}</span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500">{p.rank}</span>
                  )}
                </div>

                {/* Player name + rating */}
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? "text-teal-300" : "text-slate-200"}`}>
                    {p.playerName}
                    {isMe && <span className="ml-1 text-[10px] text-teal-400 font-normal">(you)</span>}
                  </p>
                  <p className={`text-[11px] font-medium ${getRatingColor(p.rating)}`}>
                    {p.rating} elo
                  </p>
                </div>

                {/* Puzzles solved */}
                <p className="text-sm font-bold text-slate-300 text-right">{p.puzzlesSolved.toLocaleString()}</p>

                {/* Accuracy bar */}
                <AccuracyBar value={p.accuracy} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
