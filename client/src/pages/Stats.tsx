import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Tab = "overview" | "trends" | "openings";

const MOCK_ACCURACY_TREND = [
  { date: "Mon", accuracy: 65 },
  { date: "Tue", accuracy: 72 },
  { date: "Wed", accuracy: 68 },
  { date: "Thu", accuracy: 75 },
  { date: "Fri", accuracy: 78 },
  { date: "Sat", accuracy: 82 },
  { date: "Sun", accuracy: 80 },
];

const MOCK_TIME_PER_PUZZLE = [
  { day: "Mon", time: 18 },
  { day: "Tue", time: 16 },
  { day: "Wed", time: 15 },
  { day: "Thu", time: 14 },
  { day: "Fri", time: 13 },
  { day: "Sat", time: 12 },
  { day: "Sun", time: 11 },
];

const MOCK_PUZZLES_PER_CYCLE = [
  { cycle: "1", puzzles: 20 },
  { cycle: "2", puzzles: 20 },
  { cycle: "3", puzzles: 20 },
  { cycle: "4", puzzles: 20 },
  { cycle: "5", puzzles: 20 },
];

const MOCK_CYCLES_PER_DAY = [
  { day: "Mon", cycles: 2 },
  { day: "Tue", cycles: 3 },
  { day: "Wed", cycles: 2 },
  { day: "Thu", cycles: 4 },
  { day: "Fri", cycles: 3 },
  { day: "Sat", cycles: 5 },
  { day: "Sun", cycles: 2 },
];

const MOCK_RATING_TREND = [
  { week: "W1", rating: 650 },
  { week: "W2", rating: 680 },
  { week: "W3", rating: 705 },
  { week: "W4", rating: 720 },
  { week: "W5", rating: 750 },
];

const OPENING_PERFORMANCE = [
  { name: "caroKannDefense", accuracy: 0 },
  { name: "caroKannDefense", accuracy: 0 },
  { name: "Caro-Kann Defense + 1 more", accuracy: 0 },
  { name: "Caro-Kann Defense + 1 more", accuracy: 0 },
];

const STATS_METRICS = [
  { label: "RATING", value: "705", highlight: true },
  { label: "PEAK RATING", value: "855" },
  { label: "ACCURACY", value: "0%" },
  { label: "WIN RATE", value: "0%" },
  { label: "LOSS RATE", value: "100%" },
  { label: "TOTAL PUZZLES", value: "9" },
  { label: "TOTAL CYCLES", value: "1" },
  { label: "AVG TIME/PUZ", value: "14s" },
  { label: "CURRENT STREAK", value: "1d" },
  { label: "LONGEST STREAK", value: "12d" },
  { label: "TOTAL TIME (M)", value: "2" },
  { label: "PUZZLES TODAY", value: "0" },
  { label: "CYCLES TODAY", value: "0" },
  { label: "AVG PUZ/DAY", value: "0" },
  { label: "AVG CYC/DAY", value: "0" },
  { label: "RATING GAIN", value: "+55" },
  { label: "BEST OPENING", value: "Sicilian" },
  { label: "WEAKEST OPENING", value: "Ruy Lopez" },
  { label: "STUDY TIME", value: "2h 14m" },
  { label: "CONSISTENCY", value: "78%" },
];

export default function Stats() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { user } = useAuth();

  if (!user?.isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24 px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Premium Feature</h2>
          <p className="text-slate-400 mb-8">Advanced statistics and performance analytics are available for premium members only.</p>
          <Button
            onClick={() => setLocation("/settings")}
            className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg"
          >
            Upgrade to Premium
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-amber-400 mb-2">Performance</h1>
              <p className="text-slate-400">Track your opening mastery progress.</p>
            </div>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <select className="bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm">
              <option>ALL SETS</option>
            </select>
            <button className="px-3 py-2 rounded text-slate-400 hover:text-white text-sm transition-colors">
              7D
            </button>
            <button className="px-3 py-2 rounded text-slate-400 hover:text-white text-sm transition-colors">
              30D
            </button>
            <button className="px-4 py-2 rounded bg-amber-400 text-slate-900 font-semibold text-sm hover:bg-amber-500 transition-colors">
              ALL
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Synthesis Insight */}
        <Card className="bg-slate-900/50 border-teal-900/30 p-6 mb-8 flex items-start gap-4">
          <div className="text-3xl flex-shrink-0">✨</div>
          <div>
            <h3 className="text-amber-400 font-bold mb-1">Synthesis Insight</h3>
            <p className="text-slate-400 text-sm">
              Based on your performance in all sets, you are improving in accuracy. Try to maintain a daily streak to boost your rating.
            </p>
          </div>
        </Card>

        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {STATS_METRICS.slice(0, 5).map((metric, idx) => (
            <Card
              key={idx}
              className={`p-4 border-teal-900/30 ${
                metric.highlight ? "bg-teal-900/20 border-teal-600/40" : "bg-slate-900/50"
              }`}
            >
              <p className="text-amber-400 text-xs font-bold mb-2">{metric.label}</p>
              <p className="text-white text-2xl font-bold">{metric.value}</p>
            </Card>
          ))}
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {STATS_METRICS.slice(5, 10).map((metric, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-teal-900/30 p-4">
              <p className="text-amber-400 text-xs font-bold mb-2">{metric.label}</p>
              <p className="text-white text-2xl font-bold">{metric.value}</p>
            </Card>
          ))}
        </div>

        {/* Tertiary Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {STATS_METRICS.slice(10).map((metric, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-teal-900/30 p-4">
              <p className="text-amber-400 text-xs font-bold mb-2">{metric.label}</p>
              <p className="text-white text-2xl font-bold">{metric.value}</p>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 flex-wrap">
          {(["overview", "trends", "openings"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === tab
                  ? "bg-amber-400 text-slate-900"
                  : "bg-slate-800/50 text-slate-400 hover:text-white"
              }`}
            >
              {tab.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Accuracy Trend */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">ACCURACY TREND</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={MOCK_ACCURACY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Line type="monotone" dataKey="accuracy" stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Time Per Puzzle */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">TIME PER PUZZLE</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={MOCK_TIME_PER_PUZZLE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Bar dataKey="time" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Puzzles Per Cycle */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">PUZZLES PER CYCLE</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={MOCK_PUZZLES_PER_CYCLE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="cycle" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Bar dataKey="puzzles" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Cycles Per Day */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">CYCLES PER DAY</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={MOCK_CYCLES_PER_DAY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Bar dataKey="cycles" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === "trends" && (
          <div className="grid grid-cols-1 gap-6">
            {/* Rating Trend */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-amber-400 font-bold mb-4">RATING TREND</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={MOCK_RATING_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }} />
                  <Line type="monotone" dataKey="rating" stroke="#fbbf24" strokeWidth={3} dot={{ fill: "#fbbf24" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {activeTab === "openings" && (
          <div>
            <h2 className="text-amber-400 font-bold text-lg mb-6">OPENING PERFORMANCE</h2>
            <div className="space-y-3">
              {OPENING_PERFORMANCE.map((opening, idx) => (
                <Card key={idx} className="bg-slate-900/50 border-teal-900/30 p-4 flex items-center justify-between">
                  <span className="text-white font-semibold">{opening.name}</span>
                  <span className="text-amber-400 font-bold">{opening.accuracy}% Accuracy</span>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
