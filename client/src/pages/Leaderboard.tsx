import { useAuth } from "@/_core/hooks/useAuth";

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

// Placeholder type until backend is rebuilt
type Player = {
  rank: number;
  playerName: string;
  puzzlesSolved: number;
  accuracy: number;
  rating: number;
};

export default function Leaderboard() {
  const { user } = useAuth();

  // Leaderboard backend is being rebuilt — no data yet
  const players: Player[] = [];
  const isLoading = false;
  const myName = user?.name || user?.email || null;

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
        </div>
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
            <p className="text-slate-400 text-sm">Leaderboard coming soon.</p>
          </div>
        ) : (
          players.map((p: Player) => {
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
    </div>
  );
}
