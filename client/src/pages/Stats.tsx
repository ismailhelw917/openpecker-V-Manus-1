import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function Stats() {
  const [, setLocation] = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [cycleData, setCycleData] = useState<any[]>([]);

  useEffect(() => {
    const storedDeviceId = localStorage.getItem("openpecker-device-id");
    setDeviceId(storedDeviceId);
  }, []);

  // Fetch stats
  const statsQuery = trpc.stats.getSummary.useQuery(
    {
      deviceId: deviceId || undefined,
    },
    {
      enabled: !!deviceId,
    }
  );

  // Fetch cycle history
  const cyclesQuery = trpc.cycles.list.useQuery(
    {
      deviceId: deviceId || undefined,
    },
    {
      enabled: !!deviceId,
    }
  );

  useEffect(() => {
    if (statsQuery.data) {
      setStats(statsQuery.data);
    }
  }, [statsQuery.data]);

  useEffect(() => {
    if (cyclesQuery.data) {
      // Format cycle data for chart
      const formattedData = cyclesQuery.data.map((cycle: any, idx: number) => ({
        cycle: idx + 1,
        accuracy: Math.round(Number(cycle.accuracy) || 0),
        puzzles: cycle.totalPuzzles,
        correct: cycle.correctCount,
      }));
      setCycleData(formattedData);
    }
  }, [cyclesQuery.data]);

  if (statsQuery.isLoading || cyclesQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-white">Statistics</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* Summary Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Total Puzzles Solved</div>
              <div className="text-4xl font-bold text-white">{stats.totalPuzzles}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Overall Accuracy</div>
              <div className="text-4xl font-bold text-amber-400">{stats.accuracy}%</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Cycles Completed</div>
              <div className="text-4xl font-bold text-white">{stats.completedCycles}</div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-slate-400 text-sm font-medium mb-2">Total Time</div>
              <div className="text-4xl font-bold text-white">
                {Math.round(stats.totalTimeMs / 60000)}m
              </div>
            </Card>
          </div>
        )}

        {/* Accuracy Trend Chart */}
        {cycleData.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6 mb-8">
            <h2 className="text-lg font-bold text-white mb-6">Accuracy Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={cycleData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="cycle" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "1px solid #475569",
                  }}
                  labelStyle={{ color: "#e2e8f0" }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#f59e0b"
                  dot={{ fill: "#f59e0b" }}
                  name="Accuracy %"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        {/* Cycle Details */}
        {cycleData.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <h2 className="text-lg font-bold text-white mb-6">Cycle History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400">Cycle</th>
                    <th className="text-left py-3 px-4 text-slate-400">Puzzles</th>
                    <th className="text-left py-3 px-4 text-slate-400">Correct</th>
                    <th className="text-left py-3 px-4 text-slate-400">Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {cycleData.map((cycle: any) => (
                    <tr key={cycle.cycle} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                      <td className="py-3 px-4 text-white font-medium">#{cycle.cycle}</td>
                      <td className="py-3 px-4 text-slate-300">{cycle.puzzles}</td>
                      <td className="py-3 px-4 text-green-400">{cycle.correct}</td>
                      <td className="py-3 px-4 text-amber-400 font-medium">{cycle.accuracy}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {cycleData.length === 0 && (
          <Card className="bg-slate-800/50 border-slate-700 p-12 text-center">
            <p className="text-slate-300 mb-6">No training data yet</p>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => setLocation("/sets")}
            >
              Start Training
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}
