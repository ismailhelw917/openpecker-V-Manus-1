import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Zap, Shield, Loader } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [loading, setLoading] = useState(false);

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

  if (!user?.isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🔒</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Premium Feature</h2>
          <p className="text-slate-400 mb-8">Advanced statistics and performance analytics are available for premium members only.</p>
          <Button
            onClick={() => setShowPremiumModal(true)}
            className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg"
          >
            Upgrade to Premium
          </Button>
        </div>

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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950">
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
        {/* Placeholder content */}
        <Card className="bg-slate-900/50 border-teal-900/30 p-6 mb-8">
          <p className="text-slate-400">Performance analytics content coming soon...</p>
        </Card>
      </div>
    </div>
  );
}
