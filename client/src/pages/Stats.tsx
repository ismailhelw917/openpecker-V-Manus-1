import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Zap, Shield, Loader } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { trpc } from "@/lib/trpc";

type Tab = "overview" | "trends" | "openings";

const PREMIUM_FEATURES = [
  "Unlock all 150+ opening variations",
  "Advanced performance analytics",
  "Unlimited training cycles",
  "Priority puzzle loading",
  "Support independent development",
];

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
  { name: "Sicilian Defense", accuracy: 82 },
  { name: "Caro-Kann Defense", accuracy: 75 },
  { name: "French Defense", accuracy: 68 },
  { name: "Ruy Lopez", accuracy: 45 },
];

const STATS_METRICS = [
  { label: "RATING", value: "705", highlight: true },
  { label: "PEAK RATING", value: "855" },
  { label: "ACCURACY", value: "73%" },
  { label: "WIN RATE", value: "73%" },
  { label: "LOSS RATE", value: "27%" },
  { label: "TOTAL PUZZLES", value: "234" },
  { label: "TOTAL CYCLES", value: "12" },
  { label: "AVG TIME/PUZ", value: "14s" },
  { label: "CURRENT STREAK", value: "7d" },
  { label: "LONGEST STREAK", value: "12d" },
  { label: "TOTAL TIME (H)", value: "5.5h" },
  { label: "PUZZLES TODAY", value: "18" },
  { label: "CYCLES TODAY", value: "1" },
  { label: "AVG PUZ/DAY", value: "33" },
  { label: "AVG CYC/DAY", value: "1.7" },
  { label: "RATING GAIN", value: "+55" },
  { label: "BEST OPENING", value: "Sicilian" },
  { label: "WEAKEST OPENING", value: "Ruy Lopez" },
  { label: "STUDY TIME", value: "5h 14m" },
  { label: "CONSISTENCY", value: "78%" },
];

export default function Stats() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { user } = useAuth();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch real user stats using tRPC
  const { data: stats, isLoading: statsLoading } = trpc.stats.getUserStats.useQuery(undefined, {
    enabled: Boolean(user),
  });

  // Build stats metrics dynamically from real data
  const STATS_METRICS = stats ? [
    { label: "RATING", value: stats.rating.toString(), highlight: true },
    { label: "PEAK RATING", value: stats.peakRating.toString() },
    { label: "ACCURACY", value: stats.accuracy + "%" },
    { label: "WIN RATE", value: stats.winRate + "%" },
    { label: "LOSS RATE", value: stats.lossRate + "%" },
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
  ] : []

  const handleCheckout = async (priceId: string, planName: string) => {
    if (!user) {
      toast.error("Please sign in to upgrade");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planName,
          userId: user.id,
          email: user.email,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create checkout session: ${response.status} ${errorText}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response format from server");
      }

      const data = await response.json();
      const url = data?.url;
      if (url) {
        window.open(url, "_blank");
        toast.success("Opening Stripe checkout...");
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading stats...</p>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Sign In Required</h2>
          <p className="text-slate-400 mb-8">Please sign in to view your statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20">
      {/* Premium Modal */}
      {showPremiumModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-amber-400/30 max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
              <button
                onClick={() => setShowPremiumModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>

              <div className="text-center pt-12 pb-8 px-6 bg-gradient-to-b from-amber-900/20 to-transparent">
                <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-premium-logo-LPhYmaC6iM2uaYuZkpHQpR.webp" alt="OpenPecker Premium" className="w-24 h-24 mx-auto mb-4 object-contain" />
                <h2 className="text-3xl font-bold text-amber-100 mb-2">OpenPecker Premium</h2>
                <p className="text-amber-200/70">Master every opening. No limits.</p>
              </div>

              <div className="px-6 py-8 border-t border-b border-amber-400/20">
                <div className="space-y-4">
                  {PREMIUM_FEATURES.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <span className="text-teal-400 mt-1">✓</span>
                      <span className="text-white">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-6 py-8 space-y-4">
                <button
                  onClick={() => handleCheckout("price_monthly", "Monthly")}
                  disabled={loading}
                  className="w-full p-4 rounded-lg border-2 border-slate-700 bg-slate-800/50 hover:border-amber-400 hover:bg-amber-400/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-sm">MONTHLY</p>
                      <p className="text-white font-bold text-xl">€4.99 <span className="text-sm text-slate-400">/month</span></p>
                    </div>
                    {loading ? <Loader className="w-6 h-6 text-amber-400 animate-spin" /> : <Zap className="w-6 h-6 text-amber-400" />}
                  </div>
                </button>

                <button
                  onClick={() => handleCheckout("price_lifetime", "Lifetime")}
                  disabled={loading}
                  className="w-full p-4 rounded-lg border-2 border-amber-400/40 bg-amber-400/10 hover:border-amber-400 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-amber-400 font-semibold text-sm">LIFETIME ACCESS</p>
                      <p className="text-white font-bold text-xl">€49 <span className="text-sm text-slate-400">/once</span></p>
                    </div>
                    {loading ? <Loader className="w-6 h-6 text-amber-400 animate-spin" /> : <Shield className="w-6 h-6 text-amber-400" />}
                  </div>
                </button>
              </div>

              <div className="px-6 py-6 bg-amber-900/10">
                <p className="text-amber-200/60 text-xs text-center">
                  Secure payments powered by Stripe. Cancel anytime.
                </p>
              </div>
            </Card>
          </div>
        )}

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
        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-teal-900/30">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-4 px-2 font-semibold transition-colors ${
              activeTab === "overview"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`pb-4 px-2 font-semibold transition-colors ${
              activeTab === "trends"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Trends
          </button>
          <button
            onClick={() => setActiveTab("openings")}
            className={`pb-4 px-2 font-semibold transition-colors ${
              activeTab === "openings"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Openings
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-8">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {STATS_METRICS.map((metric, idx) => (
                <Card
                  key={idx}
                  className={`p-4 border transition-colors ${
                    metric.highlight
                      ? "bg-amber-400/10 border-amber-400/50"
                      : "bg-slate-900/50 border-teal-900/30 hover:border-teal-700/50"
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">{metric.label}</p>
                  <p className={`text-2xl font-bold ${metric.highlight ? "text-amber-400" : "text-white"}`}>
                    {metric.value}
                  </p>
                </Card>
              ))}
            </div>

            {/* Rating Trend Chart */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6">Rating Progression</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={MOCK_RATING_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="week" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #0f766e",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fbbf24" }}
                  />
                  <Line type="monotone" dataKey="rating" stroke="#fbbf24" strokeWidth={3} dot={{ fill: "#fbbf24" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === "trends" && (
          <div className="space-y-8">
            {/* Accuracy Trend */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6">Accuracy Trend (7 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={MOCK_ACCURACY_TREND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #0f766e",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fbbf24" }}
                  />
                  <Bar dataKey="accuracy" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Time per Puzzle */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6">Average Time Per Puzzle (7 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={MOCK_TIME_PER_PUZZLE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #0f766e",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fbbf24" }}
                  />
                  <Line type="monotone" dataKey="time" stroke="#06b6d4" strokeWidth={3} dot={{ fill: "#06b6d4" }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Cycles per Day */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6">Training Cycles Per Day</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={MOCK_CYCLES_PER_DAY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="day" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #0f766e",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fbbf24" }}
                  />
                  <Bar dataKey="cycles" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>
        )}

        {/* Openings Tab */}
        {activeTab === "openings" && (
          <div className="space-y-8">
            {/* Opening Performance */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <h3 className="text-xl font-bold text-white mb-6">Opening Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={OPENING_PERFORMANCE}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" width={190} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #0f766e",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#fbbf24" }}
                  />
                  <Bar dataKey="accuracy" fill="#fbbf24" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Opening Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OPENING_PERFORMANCE.map((opening, idx) => (
                <Card key={idx} className="bg-slate-900/50 border-teal-900/30 p-6">
                  <h4 className="text-lg font-bold text-white mb-4">{opening.name}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Accuracy</span>
                      <span className="text-amber-400 font-bold">{opening.accuracy}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-amber-400 h-2 rounded-full transition-all"
                        style={{ width: `${opening.accuracy}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-sm text-slate-400 pt-2">
                      <span>Puzzles Solved</span>
                      <span className="text-white">42</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
