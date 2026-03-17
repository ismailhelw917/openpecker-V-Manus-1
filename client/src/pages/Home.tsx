import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Play, BarChart3, BookOpen } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const storedDeviceId = localStorage.getItem("openpecker-device-id");
    setDeviceId(storedDeviceId);
  }, []);

  // Fetch stats
  const statsQuery = trpc.stats.getSummary.useQuery(
    {
      userId: user?.id,
      deviceId: deviceId || undefined,
    },
    {
      enabled: !!deviceId || !!user,
    }
  );

  useEffect(() => {
    if (statsQuery.data) {
      setStats(statsQuery.data);
    }
  }, [statsQuery.data]);

  const handleStartTraining = () => {
    setLocation("/sets");
  };

  const handleViewStats = () => {
    setLocation("/stats");
  };

  return (
    <div className="min-h-screen w-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">♗</span>
            </div>
            <h1 className="text-2xl font-bold text-white">OpenPecker</h1>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm text-slate-300">{user.name || user.email}</p>
                  <p className="text-xs text-slate-500">Premium: {user.isPremium ? "Yes" : "No"}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // logout
                  }}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => (window.location.href = getLoginUrl())}
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-white mb-4">Master Opening Tactics</h2>
          <p className="text-xl text-slate-400 mb-8">
            Practice chess puzzles using the Woodpecker method with spaced repetition
          </p>
          <Button
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold"
            onClick={handleStartTraining}
          >
            <Play className="w-5 h-5 mr-2" />
            Start Training
          </Button>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Puzzles Solved</div>
              <div className="text-3xl font-bold text-white">{stats.totalPuzzles}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Accuracy</div>
              <div className="text-3xl font-bold text-amber-400">{stats.accuracy}%</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Cycles Completed</div>
              <div className="text-3xl font-bold text-white">{stats.completedCycles}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Avg Time/Puzzle</div>
              <div className="text-3xl font-bold text-white">
                {stats.averageTimePerPuzzle ? `${Math.round(stats.averageTimePerPuzzle / 1000)}s` : "—"}
              </div>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors p-6 cursor-pointer" onClick={handleStartTraining}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Play className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Start Training</h3>
                <p className="text-sm text-slate-400">
                  Create a new training set or continue an existing one
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors p-6 cursor-pointer" onClick={handleViewStats}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">View Statistics</h3>
                <p className="text-sm text-slate-400">
                  Track your progress and performance metrics
                </p>
              </div>
            </div>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 transition-colors p-6 cursor-pointer" onClick={() => setLocation("/sets")}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2">Saved Sets</h3>
                <p className="text-sm text-slate-400">
                  Manage your training sets and continue where you left off
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/50 backdrop-blur mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          <p>OpenPecker © 2026 - Master chess through deliberate practice</p>
        </div>
      </footer>
    </div>
  );
}
