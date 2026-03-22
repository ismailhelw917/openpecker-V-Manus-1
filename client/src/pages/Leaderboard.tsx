import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Zap, Target } from "lucide-react";

export function Leaderboard() {
  const [sortBy, setSortBy] = useState<'accuracy' | 'speed' | 'rating'>('accuracy');

  // Fetch leaderboard data
  const { data: leaderboardData, isLoading, error } = trpc.stats.getLeaderboard.useQuery({
    limit: 100,
    sortBy,
  });

  const entries = leaderboardData?.entries || [];
  const totalCount = leaderboardData?.totalCount || 0;
  const activeCount = leaderboardData?.activeCount || 0;

  const getSortIcon = (type: string) => {
    switch (type) {
      case 'speed':
        return <Zap className="w-4 h-4" />;
      case 'rating':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getSortLabel = (type: string) => {
    switch (type) {
      case 'speed':
        return 'Fastest';
      case 'rating':
        return 'Highest Rated';
      default:
        return 'Most Accurate';
    }
  };

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Leaderboard</h1>
          <p className="text-muted-foreground">
            Top chess trainers ranked by accuracy, speed, and rating
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{activeCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Registered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{totalCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Sort Tabs */}
        <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as any)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accuracy" className="flex items-center gap-2">
              {getSortIcon('accuracy')}
              <span>Accuracy</span>
            </TabsTrigger>
            <TabsTrigger value="speed" className="flex items-center gap-2">
              {getSortIcon('speed')}
              <span>Speed</span>
            </TabsTrigger>
            <TabsTrigger value="rating" className="flex items-center gap-2">
              {getSortIcon('rating')}
              <span>Rating</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">Loading leaderboard...</div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="py-12">
              <div className="text-center text-destructive">
                Failed to load leaderboard: {error.message}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard Table */}
        {!isLoading && !error && entries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {getSortIcon(sortBy)}
                {getSortLabel(sortBy)} Players
              </CardTitle>
              <CardDescription>
                Showing top {entries.length} of {activeCount} active players
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Rank</th>
                      <th className="text-left py-3 px-4 font-semibold text-foreground">Player</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Puzzles</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Accuracy</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">Rating</th>
                      <th className="text-right py-3 px-4 font-semibold text-foreground">
                        {sortBy === 'speed' ? 'Avg Time' : 'Total Time'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any, index: number) => (
                      <tr
                        key={index}
                        className="border-b border-border hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {entry.rank <= 3 && (
                              <Trophy
                                className={`w-4 h-4 ${
                                  entry.rank === 1
                                    ? 'text-yellow-500'
                                    : entry.rank === 2
                                    ? 'text-gray-400'
                                    : 'text-orange-600'
                                }`}
                              />
                            )}
                            <span className="font-semibold text-foreground">{entry.rank}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-foreground font-medium">{entry.name}</td>
                        <td className="py-3 px-4 text-right text-foreground">{entry.totalPuzzles}</td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-foreground font-semibold">{entry.accuracy}%</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-foreground font-semibold">{entry.rating}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {sortBy === 'speed'
                            ? entry.totalTimeMin > 0
                              ? `${(entry.totalTimeMin / entry.totalPuzzles).toFixed(1)}m`
                              : '-'
                            : `${entry.totalTimeMin}m`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !error && entries.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No players yet. Be the first to train!</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
