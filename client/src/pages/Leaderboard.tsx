import { trpc } from "@/lib/trpc";
import { Trophy } from "lucide-react";

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl" title="1st">♔</span>;
  if (rank === 2) return <span className="text-xl" title="2nd">♕</span>;
  if (rank === 3) return <span className="text-xl" title="3rd">♗</span>;
  return <span className="text-slate-400 font-semibold text-sm">{rank}</span>;
}

function PlayerAvatar({ name }: { name: string }) {
  const initials = name
    .split(/[\s-]/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
  return (
    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
      {initials || "?"}
    </div>
  );
}

export default function Leaderboard() {
  const { data, isLoading } = trpc.stats.getLeaderboard.useQuery({ limit: 100 });
  const players = data?.players ?? [];

  return (
    <div className="min-h-screen bg-[#1a1a1a] pb-24">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <Trophy className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
        </div>
        <p className="text-slate-400 text-sm ml-11">Top puzzle solvers</p>
        <div className="mt-4 border-b border-slate-700" />
      </div>

      {/* Table */}
      <div className="max-w-2xl mx-auto px-4">
        {/* Column headers */}
        <div className="grid grid-cols-[60px_1fr_100px] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Puzzles</span>
        </div>

        {isLoading && (
          <div className="space-y-2 mt-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-14 rounded-lg bg-slate-800/50 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && players.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No players yet. Start solving puzzles to appear here!
          </div>
        )}

        {!isLoading && players.length > 0 && (
          <div className="space-y-1 mt-1">
            {players.map((player) => {
              const isTop3 = player.rank <= 3;
              const rowBg =
                player.rank === 1
                  ? "bg-amber-900/30 border border-amber-700/40"
                  : player.rank === 2
                  ? "bg-slate-700/40 border border-slate-600/40"
                  : player.rank === 3
                  ? "bg-amber-950/30 border border-amber-800/30"
                  : "bg-slate-800/30 hover:bg-slate-800/60";

              return (
                <div
                  key={player.rank}
                  className={`grid grid-cols-[60px_1fr_100px] gap-2 items-center px-3 py-3 rounded-lg transition-colors ${rowBg}`}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8">
                    <RankIcon rank={player.rank} />
                  </div>

                  {/* Player */}
                  <div className="flex items-center gap-2 min-w-0">
                    <PlayerAvatar name={player.playerName} />
                    <span className={`font-medium truncate ${isTop3 ? "text-white" : "text-slate-300"}`}>
                      {player.playerName}
                    </span>
                  </div>

                  {/* Puzzles solved */}
                  <div className="text-right">
                    <span className={`font-bold text-base ${
                      player.rank === 1 ? "text-amber-300"
                      : player.rank === 2 ? "text-slate-200"
                      : player.rank === 3 ? "text-amber-600"
                      : "text-slate-200"
                    }`}>
                      {player.puzzlesSolved.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && players.length > 0 && (
          <p className="text-center text-slate-600 text-xs mt-6 pb-4">
            Showing top {players.length} players · Solve puzzles to climb the ranks
          </p>
        )}
      </div>
    </div>
  );
}
