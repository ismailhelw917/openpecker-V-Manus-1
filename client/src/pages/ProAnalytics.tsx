import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { PremiumPaywall } from "@/components/PremiumPaywall";
import { useVisitorStats } from "@/hooks/useVisitorStats";
import {
  Users,
  Puzzle,
  TrendingUp,
  Zap,
  RefreshCw,
  BarChart3,
  Lock,
  Activity,
  Award,
  Clock,
  Flame,
  Target,
  Eye,
  Globe,
} from "lucide-react";

interface PuzzleStats {
  total: number;
  nullCount: number;
  namedCount: number;
  uniqueOpenings: number;
  averageRating: string;
  openingDistribution: Array<{ opening: string; count: number }>;
}

interface UserStats {
  totalUsers: number;
  premiumUsers: number;
  adminUsers: number;
  activeUsers: number;
  totalSessions: number;
}

export default function ProAnalytics() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showPremiumPaywall, setShowPremiumPaywall] = useState(false);
  const [puzzleStats, setPuzzleStats] = useState<PuzzleStats | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const statsQuery = trpc.system.getPuzzleStats.useQuery();
  const utils = trpc.useUtils();
  const { stats: visitorStats, refetch: refetchVisitorStats } = useVisitorStats(30_000);

  // Check if user is premium
  useEffect(() => {
    if (user && !user.isPremium) {
      setLocation("/stats");
    }
  }, [user, setLocation]);

  // Fetch puzzle stats
  useEffect(() => {
    if (statsQuery.data) {
      setPuzzleStats(statsQuery.data);
      setLastUpdated(new Date());
      setLoading(false);
    }
  }, [statsQuery.data]);

  // Fetch user stats from database using tRPC
  const userAnalyticsQuery = trpc.system.getUserAnalytics.useQuery();

  useEffect(() => {
    if (userAnalyticsQuery.data) {
      setUserStats({
        totalUsers: userAnalyticsQuery.data.totalUsers,
        premiumUsers: userAnalyticsQuery.data.premiumUsers,
        adminUsers: userAnalyticsQuery.data.adminUsers,
        activeUsers: userAnalyticsQuery.data.activeUsers,
        totalSessions: userAnalyticsQuery.data.totalSessions,
      });
    }
  }, [userAnalyticsQuery.data]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        utils.system.getPuzzleStats.invalidate(),
        utils.system.getUserAnalytics.invalidate(),
        refetchVisitorStats(),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setRefreshing(false);
    }
  };

  const classificationPercentage = puzzleStats
    ? ((puzzleStats.namedCount / puzzleStats.total) * 100).toFixed(1)
    : "0";

  if (!user?.isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24 flex items-center justify-center">
        <Card className="bg-slate-900/50 border-teal-900/30 p-8 max-w-md text-center">
          <Lock className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Premium Feature</h1>
          <p className="text-slate-300 mb-6">
            Advanced Analytics is available for Premium subscribers only. Upgrade your account to access detailed platform statistics.
          </p>
          <Button 
            onClick={() => setShowPremiumPaywall(true)}
            className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold"
          >
            Upgrade to Premium
          </Button>
          {showPremiumPaywall && (
            <PremiumPaywall
              onClose={() => setShowPremiumPaywall(false)}
              onMonthlyClick={() => {
                console.log('[ProAnalytics] Monthly subscription clicked');
                setShowPremiumPaywall(false);
              }}
              onLifetimeClick={() => {
                console.log('[ProAnalytics] Lifetime subscription clicked');
                setShowPremiumPaywall(false);
              }}
            />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-amber-400" />
              <div>
                <h1 className="text-3xl font-bold text-amber-400">Premium Analytics</h1>
                <p className="text-slate-400 text-sm">Professional website analytics with in-depth data insights</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-amber-400 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          {lastUpdated && (
            <p className="text-xs text-slate-500 mt-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
          </div>
        ) : (
          <>
            {/* USER ANALYTICS SECTION */}
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Users className="w-6 h-6 text-amber-400" />
                User Analytics
              </h2>

              {/* Visitor Traffic Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Visitors */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Total Visitors</p>
                      <p className="text-4xl font-bold text-amber-400 mt-2">
                        {visitorStats.totalVisitors > 0 ? (visitorStats.totalVisitors >= 1000 ? (visitorStats.totalVisitors / 1000).toFixed(1) + 'K' : visitorStats.totalVisitors) : '...'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Unique visitors tracked</p>
                    </div>
                    <Globe className="w-12 h-12 text-amber-400/30" />
                  </div>
                </Card>

                {/* Today's Visitors */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Today's Visitors</p>
                      <p className="text-4xl font-bold text-green-400 mt-2">{visitorStats.todayVisitors || '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">Unique visitors today</p>
                    </div>
                    <Eye className="w-12 h-12 text-green-400/30" />
                  </div>
                </Card>

                {/* Total Page Views */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Total Page Views</p>
                      <p className="text-4xl font-bold text-teal-400 mt-2">
                        {visitorStats.totalPageViews > 0 ? (visitorStats.totalPageViews >= 1000 ? (visitorStats.totalPageViews / 1000).toFixed(1) + 'K' : visitorStats.totalPageViews) : '...'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">All page views</p>
                    </div>
                    <Activity className="w-12 h-12 text-teal-400/30" />
                  </div>
                </Card>

                {/* Online Now */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Online Now</p>
                      <p className="text-4xl font-bold text-cyan-400 mt-2">{visitorStats.recentVisitors || '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">Active in last 15 min</p>
                    </div>
                    <Zap className="w-12 h-12 text-cyan-400/30" />
                  </div>
                </Card>
              </div>

              {/* Registered Users Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Registered */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Registered Users</p>
                      <p className="text-4xl font-bold text-amber-400 mt-2">{userStats?.totalUsers ?? '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">Signed-in accounts</p>
                    </div>
                    <Users className="w-12 h-12 text-amber-400/30" />
                  </div>
                </Card>

                {/* Premium Users */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Premium Users</p>
                      <p className="text-4xl font-bold text-purple-400 mt-2">{userStats?.premiumUsers ?? '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {userStats && userStats.totalUsers > 0
                          ? `${((userStats.premiumUsers / userStats.totalUsers) * 100).toFixed(1)}% conversion rate`
                          : 'Loading...'}
                      </p>
                    </div>
                    <Award className="w-12 h-12 text-purple-400/30" />
                  </div>
                </Card>

                {/* Active Users */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Training Sessions</p>
                      <p className="text-4xl font-bold text-green-400 mt-2">{userStats?.totalSessions ?? '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">Completed training sessions</p>
                    </div>
                    <Activity className="w-12 h-12 text-green-400/30" />
                  </div>
                </Card>

                {/* Admin Users */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm font-medium">Admin Users</p>
                      <p className="text-4xl font-bold text-cyan-400 mt-2">{userStats?.adminUsers ?? '...'}</p>
                      <p className="text-xs text-slate-500 mt-1">Platform admins</p>
                    </div>
                    <Lock className="w-12 h-12 text-cyan-400/30" />
                  </div>
                </Card>
              </div>
            </div>

            {/* PUZZLE DATABASE SECTION */}
            {puzzleStats && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Puzzle className="w-6 h-6 text-teal-400" />
                  Puzzle Database Analytics
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {/* Total Puzzles */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Total Puzzles</p>
                        <p className="text-4xl font-bold text-amber-400 mt-2">
                          {(puzzleStats.total / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {puzzleStats.total.toLocaleString()} puzzles
                        </p>
                      </div>
                      <Puzzle className="w-12 h-12 text-amber-400/30" />
                    </div>
                  </Card>

                  {/* Classification Status */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Classification Status</p>
                        <p className="text-4xl font-bold text-teal-400 mt-2">{classificationPercentage}%</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(puzzleStats.namedCount / 1000000).toFixed(2)}M classified
                        </p>
                      </div>
                      <TrendingUp className="w-12 h-12 text-teal-400/30" />
                    </div>
                  </Card>

                  {/* Unique Openings */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Unique Openings</p>
                        <p className="text-4xl font-bold text-cyan-400 mt-2">{puzzleStats.uniqueOpenings}</p>
                        <p className="text-xs text-slate-500 mt-1">Opening categories</p>
                      </div>
                      <Zap className="w-12 h-12 text-cyan-400/30" />
                    </div>
                  </Card>

                  {/* Average Rating */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Average Rating</p>
                        <p className="text-4xl font-bold text-purple-400 mt-2">{puzzleStats.averageRating}</p>
                        <p className="text-xs text-slate-500 mt-1">Puzzle difficulty</p>
                      </div>
                      <Target className="w-12 h-12 text-purple-400/30" />
                    </div>
                  </Card>

                  {/* Classified Puzzles */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Classified Puzzles</p>
                        <p className="text-4xl font-bold text-green-400 mt-2">
                          {(puzzleStats.namedCount / 1000000).toFixed(2)}M
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {puzzleStats.namedCount.toLocaleString()} puzzles
                        </p>
                      </div>
                      <Flame className="w-12 h-12 text-green-400/30" />
                    </div>
                  </Card>

                  {/* Unclassified Puzzles */}
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6 hover:border-teal-700/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-slate-400 text-sm font-medium">Unclassified</p>
                        <p className="text-4xl font-bold text-orange-400 mt-2">
                          {((puzzleStats.nullCount / puzzleStats.total) * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {(puzzleStats.nullCount / 1000000).toFixed(2)}M puzzles
                        </p>
                      </div>
                      <Clock className="w-12 h-12 text-orange-400/30" />
                    </div>
                  </Card>
                </div>

                {/* Classification Progress Bar */}
                <Card className="bg-slate-900/50 border-teal-900/30 p-6 mb-8">
                  <h3 className="text-xl font-bold text-white mb-6">Classification Progress</h3>

                  <div className="space-y-6">
                    {/* Main Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-slate-300 font-medium">Overall Progress</span>
                        <span className="text-amber-400 font-bold text-lg">{classificationPercentage}%</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-amber-400 via-teal-400 to-cyan-400 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${parseFloat(classificationPercentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm">Classified</p>
                        <p className="text-2xl font-bold text-teal-400 mt-1">
                          {(puzzleStats.namedCount / 1000000).toFixed(2)}M
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {((puzzleStats.namedCount / puzzleStats.total) * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm">Pending</p>
                        <p className="text-2xl font-bold text-orange-400 mt-1">
                          {(puzzleStats.nullCount / 1000000).toFixed(2)}M
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {((puzzleStats.nullCount / puzzleStats.total) * 100).toFixed(1)}%
                        </p>
                      </div>

                      <div className="bg-slate-800/50 rounded-lg p-4">
                        <p className="text-slate-400 text-sm">Total</p>
                        <p className="text-2xl font-bold text-cyan-400 mt-1">
                          {(puzzleStats.total / 1000000).toFixed(1)}M
                        </p>
                        <p className="text-xs text-slate-500 mt-1">All puzzles</p>
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Top Openings */}
                {puzzleStats.openingDistribution.length > 0 && (
                  <Card className="bg-slate-900/50 border-teal-900/30 p-6">
                    <h3 className="text-xl font-bold text-white mb-6">Top Openings by Puzzle Count</h3>

                    <div className="space-y-3">
                      {puzzleStats.openingDistribution.slice(0, 15).map((opening, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-slate-500 font-semibold w-6 text-right">#{index + 1}</span>
                            <span className="text-slate-300 flex-1">{opening.opening}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-32 bg-slate-800 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-amber-400 to-teal-400 h-2 rounded-full"
                                style={{
                                  width: `${
                                    (opening.count /
                                      (puzzleStats.openingDistribution[0]?.count || opening.count)) *
                                    100
                                  }%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-amber-400 font-bold w-20 text-right">
                              {(opening.count / 1000).toFixed(0)}K
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* Premium Features Info */}
            <Card className="bg-amber-900/20 border-amber-500/30 p-6">
              <p className="text-amber-200 text-sm">
                ✨ <strong>Premium Feature:</strong> Professional website analytics with in-depth data insights. Track user engagement,
                puzzle database growth, training metrics, and platform performance. This is an exclusive Premium subscription feature
                designed for serious chess training analysis.
              </p>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
