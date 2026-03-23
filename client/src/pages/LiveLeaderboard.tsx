import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Trophy, Zap, Users, Timer, Crown, Medal } from "lucide-react";

const RESET_INTERVAL = 30; // seconds

export function LiveLeaderboard() {
  const [countdown, setCountdown] = useState(RESET_INTERVAL);
  const [epoch, setEpoch] = useState(0); // increments to force refetch
  const [flash, setFlash] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = trpc.stats.getLeaderboard.useQuery(
    { limit: 100, sortBy: "accuracy" },
    { staleTime: 0, refetchOnWindowFocus: false, enabled: true }
  );

  // Countdown + reset logic
  useEffect(() => {
    setCountdown(RESET_INTERVAL);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger reset
          setFlash(true);
          setTimeout(() => setFlash(false), 600);
          setEpoch((e) => e + 1);
          refetch();
          return RESET_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refetch]);

  const players = data?.players ?? [];
  const onlineNow = data?.summary?.activePlayers ?? 0;

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: "bg-yellow-500/20 border-l-2 border-yellow-400", text: "text-yellow-400", icon: <Crown className="w-3.5 h-3.5 text-yellow-400" /> };
    if (rank === 2) return { bg: "bg-slate-400/15 border-l-2 border-slate-300", text: "text-slate-300", icon: <Medal className="w-3.5 h-3.5 text-slate-300" /> };
    if (rank === 3) return { bg: "bg-amber-700/15 border-l-2 border-amber-500", text: "text-amber-500", icon: <Medal className="w-3.5 h-3.5 text-amber-500" /> };
    return { bg: "bg-transparent", text: "text-slate-400", icon: null };
  };

  const circumference = 2 * Math.PI * 14;
  const progress = (countdown / RESET_INTERVAL) * circumference;

  return (
    <div
      className={`flex flex-col bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 transition-all duration-300 ${flash ? "brightness-125" : ""}`}
      style={{ height: "calc(100dvh - 4rem)", overflow: "hidden" }}
    >
      {/* Header */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b border-slate-700/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            <h1 className="text-base font-bold text-white whitespace-nowrap">Live Rankings</h1>
            <span className="flex items-center gap-1 bg-red-900/50 border border-red-700/50 rounded-full px-2 py-0.5 text-[9px] font-bold text-red-400 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Online count */}
            <span className="flex items-center gap-1 bg-teal-900/60 border border-teal-700/50 rounded-full px-2 py-0.5 text-[10px] text-teal-300 whitespace-nowrap">
              <Users className="w-2.5 h-2.5" />
              {onlineNow} online
            </span>

            {/* Countdown ring */}
            <div className="relative w-8 h-8 flex items-center justify-center" title={`Resets in ${countdown}s`}>
              <svg className="absolute inset-0 w-8 h-8 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="14"
                  fill="none"
                  stroke={countdown <= 5 ? "#f87171" : "#2dd4bf"}
                  strokeWidth="3"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference - progress}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className={`text-[9px] font-bold tabular-nums ${countdown <= 5 ? "text-red-400" : "text-teal-300"}`}>
                {countdown}
              </span>
            </div>
          </div>
        </div>

        {/* Reset bar */}
        <div className="mt-2 h-0.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${countdown <= 5 ? "bg-red-500" : "bg-teal-500"}`}
            style={{ width: `${(countdown / RESET_INTERVAL) * 100}%` }}
          />
        </div>
      </div>

      {/* Column headers */}
      {!isLoading && players.length > 0 && (
        <div className="shrink-0 bg-teal-800/60 border-b border-teal-700/40">
          <div className="grid grid-cols-[2rem_1fr_3.5rem_3.5rem] px-2 py-1.5 text-[10px] font-semibold text-teal-200 uppercase tracking-wider">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Solved</span>
            <span className="text-right">Acc%</span>
          </div>
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Zap className="w-8 h-8 text-teal-400 animate-pulse" />
            <p className="text-slate-400 text-sm">Loading rankings...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Trophy className="w-10 h-10 text-slate-600" />
            <p className="text-slate-400 text-sm">No players yet — be the first!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/40">
            {players.map((player, index) => {
              const rank = index + 1;
              const style = getRankStyle(rank);
              return (
                <div
                  key={`${player.playerName}-${epoch}`}
                  className={`grid grid-cols-[2rem_1fr_3.5rem_3.5rem] items-center px-2 py-2 ${style.bg} transition-colors`}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center">
                    {style.icon ?? (
                      <span className="text-[11px] font-bold text-slate-500 tabular-nums">{rank}</span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 pr-1">
                    <p className="text-sm font-semibold text-white truncate leading-tight">{player.playerName}</p>
                    {player.rating > 0 && (
                      <p className="text-[10px] text-slate-500 leading-tight">{player.rating} pts</p>
                    )}
                  </div>

                  {/* Solved */}
                  <div className="text-right">
                    <span className="text-sm font-bold text-teal-300 tabular-nums">{player.puzzlesSolved}</span>
                  </div>

                  {/* Accuracy */}
                  <div className="text-right">
                    <span className={`text-sm font-bold tabular-nums ${style.text || "text-slate-300"}`}>
                      {Math.round(player.accuracy)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: reset info */}
      <div className="shrink-0 px-3 py-2 border-t border-slate-800/60 flex items-center justify-center gap-1.5">
        <Timer className="w-3 h-3 text-slate-500" />
        <span className="text-[10px] text-slate-500">Rankings refresh every {RESET_INTERVAL}s</span>
      </div>
    </div>
  );
}
