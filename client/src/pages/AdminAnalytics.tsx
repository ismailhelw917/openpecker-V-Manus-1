import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function AdminAnalytics() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const utils = trpc.useUtils();

  // Check if user is admin
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-amber-400 mb-4">Access Denied</h1>
          <p className="text-slate-400 mb-6">Only admins can view analytics</p>
          <Button onClick={() => setLocation("/")} className="bg-amber-400 text-slate-900">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await utils.system.getPuzzleStats.invalidate();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setLocation("/")}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-400" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-amber-400">Admin Analytics</h1>
                <p className="text-slate-400 text-sm">Real-time platform statistics</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-amber-400 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnalyticsDashboard />

        {/* Admin Actions */}
        <Card className="bg-slate-900/50 border-teal-900/30 p-6 mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Admin Actions</h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="font-semibold text-white mb-2">Puzzle Classification</h3>
              <p className="text-slate-400 text-sm mb-4">
                Classify NULL puzzles into opening categories. This will make all 5.4M puzzles accessible for training.
              </p>
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-amber-400 text-slate-900 font-semibold rounded-lg hover:bg-amber-500 transition-colors">
                  Classify 1000 Puzzles
                </button>
                <button className="px-4 py-2 bg-teal-400 text-slate-900 font-semibold rounded-lg hover:bg-teal-500 transition-colors">
                  Classify All (Background)
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-800/50 rounded-lg">
              <h3 className="font-semibold text-white mb-2">Analytics Integration</h3>
              <p className="text-slate-400 text-sm mb-4">
                These statistics are available in Manus Chat. Ask "Show me puzzle statistics" to get real-time data.
              </p>
              <button className="px-4 py-2 bg-cyan-400 text-slate-900 font-semibold rounded-lg hover:bg-cyan-500 transition-colors">
                View in Manus Chat
              </button>
            </div>
          </div>
        </Card>

        {/* Info */}
        <Card className="bg-blue-900/20 border-blue-500/30 p-4 mt-8">
          <p className="text-blue-200 text-sm">
            <strong>Note:</strong> This analytics dashboard is connected to the MCP analytics server. All data is available for querying in Manus Chat.
          </p>
        </Card>
      </div>
    </div>
  );
}
