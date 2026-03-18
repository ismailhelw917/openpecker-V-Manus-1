import { Card } from "@/components/ui/card";

interface StatsDisplayProps {
  stats: any | null | undefined;
  isLoading: boolean;
}

export function StatsDisplay({ stats, isLoading }: StatsDisplayProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(12)].map((_, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-700 p-4 animate-pulse">
            <div className="h-8 bg-slate-700 rounded mb-2"></div>
            <div className="h-6 bg-slate-700 rounded w-3/4"></div>
          </Card>
        ))}
      </div>
    );
  }

  // Handle both authenticated and anonymous stats formats
  const isAuthenticatedStats = stats?.rating !== undefined;
  
  const STATS_METRICS = isAuthenticatedStats
    ? [
        { label: "RATING", value: stats.rating.toString(), highlight: true },
        { label: "PEAK RATING", value: stats.peakRating.toString() },
        { label: "ACCURACY", value: Math.round(stats.accuracy) + "%" },
        { label: "TOTAL PUZZLES", value: stats.totalPuzzles.toString() },
        { label: "TOTAL CYCLES", value: stats.totalCycles.toString() },
        { label: "AVG TIME/PUZ", value: stats.avgTimePerPuzzle },
        { label: "CURRENT STREAK", value: stats.currentStreak.toString() },
        { label: "LONGEST STREAK", value: stats.longestStreak.toString() },
        { label: "TOTAL TIME (H)", value: stats.totalTimeHours },
        { label: "PUZZLES TODAY", value: stats.puzzlesToday.toString() },
        { label: "CYCLES TODAY", value: stats.cyclesToday.toString() },
        { label: "AVG PUZ/DAY", value: stats.avgPuzzlesPerDay.toString() },
        { label: "AVG CYC/DAY", value: stats.avgCyclesPerDay.toString() },
        { label: "RATING GAIN", value: "+" + stats.ratingGain.toString() },
        { label: "BEST OPENING", value: stats.bestOpening },
        { label: "WEAKEST OPENING", value: stats.weakestOpening },
        { label: "STUDY TIME", value: stats.studyTime },
        { label: "CONSISTENCY", value: stats.consistency + "%" },
      ]
    : [
        { label: "TOTAL PUZZLES", value: stats.totalPuzzles.toString(), highlight: true },
        { label: "ACCURACY", value: Math.round(stats.accuracy) + "%" },
        { label: "COMPLETED CYCLES", value: stats.completedCycles.toString() },
        { label: "AVG TIME/PUZ", value: stats.averageTimePerPuzzle.toString() + "ms" },
        { label: "TOTAL TIME", value: (stats.totalTimeMs / 1000 / 60).toFixed(0) + "m" },
      ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {STATS_METRICS.map((metric, index) => (
        <Card
          key={index}
          className={`p-4 sm:p-6 border-2 transition-all ${
            metric.highlight
              ? "bg-gradient-to-br from-amber-900/30 to-amber-950/20 border-amber-400/50 shadow-lg shadow-amber-400/20"
              : "bg-slate-900/50 border-slate-700/50 hover:border-teal-500/50"
          }`}
        >
          <p className="text-xs sm:text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
            {metric.label}
          </p>
          <p
            className={`text-lg sm:text-2xl font-bold ${
              metric.highlight ? "text-amber-400" : "text-teal-400"
            }`}
          >
            {metric.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
