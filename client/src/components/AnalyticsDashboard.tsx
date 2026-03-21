import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Users, Puzzle, TrendingUp, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface AnalyticsData {
  users?: {
    totalUsers: number;
    premiumUsers: number;
    premiumPercentage: string;
    activeUsers: number;
    conversionRate: string;
  };
  puzzles?: {
    totalPuzzles: number;
    namedPuzzles: number;
    nullPuzzles: number;
    classificationPercentage: string;
    uniqueOpenings: number;
    averageRating: string;
  };
  performance?: {
    totalCycles: number;
    totalPuzzlesSolved: number;
    totalCorrect: number;
    averageAccuracy: string;
    winRate: string;
  };
}

export function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch puzzle stats using tRPC
  const puzzleStatsQuery = trpc.system.getPuzzleStats.useQuery();

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);

        // Map the tRPC response to our data format
        if (puzzleStatsQuery.data) {
          const data = puzzleStatsQuery.data;
          setAnalyticsData({
            puzzles: {
              totalPuzzles: data.total || 0,
              namedPuzzles: data.namedCount || 0,
              nullPuzzles: data.nullCount || 0,
              classificationPercentage: ((data.namedCount || 0) / (data.total || 1) * 100).toFixed(1),
              uniqueOpenings: data.uniqueOpenings || 0,
              averageRating: data.averageRating || "1500",
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [puzzleStatsQuery.data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-900/20 border-red-500/30 p-4">
        <p className="text-red-400">Error loading analytics: {error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Puzzle Statistics */}
      {analyticsData?.puzzles && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Total Puzzles</p>
                <p className="text-3xl font-bold text-amber-400">
                  {(analyticsData.puzzles.totalPuzzles / 1000000).toFixed(1)}M
                </p>
              </div>
              <Puzzle className="w-10 h-10 text-amber-400/50" />
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Classified</p>
                <p className="text-3xl font-bold text-teal-400">
                  {analyticsData.puzzles.classificationPercentage}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(analyticsData.puzzles.namedPuzzles / 1000000).toFixed(2)}M puzzles
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-teal-400/50" />
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Unique Openings</p>
                <p className="text-3xl font-bold text-cyan-400">
                  {analyticsData.puzzles.uniqueOpenings}
                </p>
              </div>
              <Zap className="w-10 h-10 text-cyan-400/50" />
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Avg Rating</p>
                <p className="text-3xl font-bold text-purple-400">
                  {analyticsData.puzzles.averageRating}
                </p>
              </div>
              <Users className="w-10 h-10 text-purple-400/50" />
            </div>
          </Card>

          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Unclassified</p>
                <p className="text-3xl font-bold text-orange-400">
                  {((analyticsData.puzzles.nullPuzzles / analyticsData.puzzles.totalPuzzles) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {(analyticsData.puzzles.nullPuzzles / 1000000).toFixed(2)}M puzzles
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-orange-400/50" />
            </div>
          </Card>
        </div>
      )}

      {/* Classification Progress */}
      {analyticsData?.puzzles && (
        <Card className="bg-slate-900/50 border-teal-900/30 p-6">
          <h3 className="text-lg font-bold text-white mb-4">Puzzle Classification Progress</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400">Classification Status</span>
                <span className="text-amber-400 font-semibold">
                  {analyticsData.puzzles.classificationPercentage}% Complete
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-amber-400 to-teal-400 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${parseFloat(analyticsData.puzzles.classificationPercentage)}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-400">Classified</p>
                <p className="text-teal-400 font-bold">
                  {(analyticsData.puzzles.namedPuzzles / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-slate-400">Pending</p>
                <p className="text-orange-400 font-bold">
                  {(analyticsData.puzzles.nullPuzzles / 1000000).toFixed(2)}M
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Info Message */}
      <Card className="bg-teal-900/20 border-teal-500/30 p-4">
        <p className="text-teal-200 text-sm">
          💡 Tip: Your puzzle statistics are saved automatically and updated in real-time as you train.
        </p>
      </Card>
    </div>
  );
}
