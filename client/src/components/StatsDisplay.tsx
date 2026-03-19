import { Card } from "@/components/ui/card";

interface StatsDisplayProps {
  stats: any | null | undefined;
  isLoading: boolean;
}

interface MetricItem {
  label: string;
  value: string;
  highlight?: boolean;
  section?: string;
}

export function StatsDisplay({ stats, isLoading }: StatsDisplayProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {[...Array(16)].map((_, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-700 p-3 sm:p-4 animate-pulse">
            <div className="h-6 sm:h-8 bg-slate-700 rounded mb-2"></div>
            <div className="h-4 sm:h-6 bg-slate-700 rounded w-3/4"></div>
          </Card>
        ))}
      </div>
    );
  }

  // Handle both authenticated and anonymous stats formats
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
        {[...Array(16)].map((_, i) => (
          <Card key={i} className="bg-slate-900/50 border-slate-700 p-3 sm:p-4 animate-pulse">
            <div className="h-6 sm:h-8 bg-slate-700 rounded mb-2"></div>
            <div className="h-4 sm:h-6 bg-slate-700 rounded w-3/4"></div>
          </Card>
        ))}
      </div>
    );
  }

  const isAuthenticatedStats = stats?.rating !== undefined;

  const sections: { title: string; metrics: MetricItem[] }[] = isAuthenticatedStats
    ? [
        {
          title: "Performance",
          metrics: [
            { label: "RATING", value: stats.rating.toString(), highlight: true },
            { label: "PEAK RATING", value: stats.peakRating.toString() },
            { label: "ACCURACY", value: Math.round(stats.accuracy) + "%" },
            { label: "WIN RATE", value: stats.winRate + "%" },
            { label: "RATING GAIN", value: "+" + stats.ratingGain.toString() },
            { label: "CONSISTENCY", value: stats.consistency + "%" },
          ],
        },
        {
          title: "Activity",
          metrics: [
            { label: "TOTAL PUZZLES", value: stats.totalPuzzles.toString(), highlight: true },
            { label: "CORRECT", value: (stats.totalCorrect || 0).toString() },
            { label: "INCORRECT", value: (stats.totalIncorrect || 0).toString() },
            { label: "TOTAL CYCLES", value: stats.totalCycles.toString() },
            { label: "PUZ/CYCLE", value: (stats.avgPuzzlesPerCycle || 0).toString() },
            { label: "FASTEST CYCLE", value: stats.fastestCycleTime || "N/A" },
          ],
        },
        {
          title: "Time",
          metrics: [
            { label: "STUDY TIME", value: stats.studyTime },
            { label: "TOTAL HOURS", value: stats.totalTimeHours },
            { label: "AVG TIME/PUZ", value: stats.avgTimePerPuzzle },
            { label: "TOTAL MINUTES", value: (stats.totalTimeMinutes || 0) + "m" },
          ],
        },
        {
          title: "Streaks & Daily",
          metrics: [
            { label: "CURRENT STREAK", value: stats.currentStreak.toString(), highlight: true },
            { label: "LONGEST STREAK", value: stats.longestStreak.toString() },
            { label: "PUZZLES TODAY", value: stats.puzzlesToday.toString() },
            { label: "CYCLES TODAY", value: stats.cyclesToday.toString() },
            { label: "AVG PUZ/DAY", value: stats.avgPuzzlesPerDay.toString() },
            { label: "AVG CYC/DAY", value: stats.avgCyclesPerDay.toString() },
          ],
        },
        {
          title: "Openings",
          metrics: [
            { label: "BEST OPENING", value: stats.bestOpening },
            { label: "WEAKEST OPENING", value: stats.weakestOpening },
          ],
        },
      ]
    : [
        {
          title: "Overview",
          metrics: [
            { label: "TOTAL PUZZLES", value: stats.totalPuzzles.toString(), highlight: true },
            { label: "CORRECT", value: (stats.totalCorrect || 0).toString() },
            { label: "ACCURACY", value: Math.round(stats.accuracy) + "%" },
            { label: "COMPLETED CYCLES", value: stats.completedCycles.toString() },
            { label: "AVG TIME/PUZ", value: stats.averageTimePerPuzzle > 1000 
                ? (stats.averageTimePerPuzzle / 1000).toFixed(1) + "s"
                : stats.averageTimePerPuzzle + "ms" },
            { label: "TOTAL TIME", value: (stats.totalTimeMs / 1000 / 60).toFixed(0) + "m" },
          ],
        },
      ];

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-widest mb-2 sm:mb-3 px-1">
            {section.title}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
            {section.metrics.map((metric, index) => (
              <Card
                key={index}
                className={`p-3 sm:p-5 border-2 transition-all ${
                  metric.highlight
                    ? "bg-gradient-to-br from-amber-900/30 to-amber-950/20 border-amber-400/50 shadow-lg shadow-amber-400/20"
                    : "bg-slate-900/50 border-slate-700/50 hover:border-teal-500/50"
                }`}
              >
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 mb-1 sm:mb-2 uppercase tracking-wider leading-tight">
                  {metric.label}
                </p>
                <p
                  className={`text-base sm:text-2xl font-bold truncate ${
                    metric.highlight ? "text-amber-400" : "text-teal-400"
                  }`}
                >
                  {metric.value}
                </p>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
