import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Zap, Shield, Loader, Users, TrendingUp, Lock, CreditCard } from "lucide-react";
import { PremiumPaywall } from "@/components/PremiumPaywall";
import { StatsDisplay } from "@/components/StatsDisplay";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { trpc } from "@/lib/trpc";

type Tab = "overview" | "trends" | "openings" | "analytics";
type TimeRange = "7d" | "30d" | "all";

const PREMIUM_FEATURES = [
  "Unlimited puzzle access (5.8M+ puzzles)",
  "Advanced analytics and insights",
  "Personalized training recommendations",
  "Opening mastery tracking",
  "Performance trends and comparisons",
  "No ads, no limits",
];

// Rating trend is built dynamically from real stats in the component below

export default function Stats() {
  const [location] = useLocation();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [selectedSet, setSelectedSet] = useState<string>("all");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [showPremiumPaywall, setShowPremiumPaywall] = useState(false);
  const completeRegistrationMutation = trpc.auth.completeRegistration.useMutation();
  
  // Check if we should show paywall for new users
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    if (params.get('showPaywall') === 'true') {
      console.log('[Stats] Opening paywall for new user');
      setShowPremiumPaywall(true);
      // Mark user as registered when they reach the paywall
      if (user && user.hasRegistered === 0) {
        completeRegistrationMutation.mutate();
      }
    }
  }, [location, user, completeRegistrationMutation]);
  const [loading, setLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [deviceId] = useState<string | null>(() => {
    try { return getOrCreateDeviceId(); } catch { return null; }
  });

  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  // Fetch real trend data
  const { data: trendData, isLoading: trendLoading } = trpc.stats.getTrendData.useQuery(
    { days: timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365 },
    { enabled: isAuthenticated && activeTab === 'trends' }
  );

  // Fetch real opening stats
  const { data: openingStats, isLoading: openingLoading } = trpc.stats.getOpeningStats.useQuery(
    undefined,
    { enabled: isAuthenticated && activeTab === 'openings' }
  );

  const handleCheckout = async (priceId: string, planName: string) => {
    if (authLoading) {
      toast.info("Please wait, loading your account...");
      return;
    }
    if (!user) {
      console.log('[Stats Checkout] User not found, redirecting to login');
      window.location.href = getLoginUrl();
      return;
    }
    
    console.log('[Stats Checkout] Proceeding with checkout for user:', user.id);
    setLoading(true);
    setCheckoutPlan(priceId);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          planName,
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to create checkout session');
        setLoading(false);
        return;
      }

      const { url } = await response.json();
      window.open(url, '_blank');
      toast.success(`Redirecting to ${planName} checkout...`);
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setLoading(false);
      setCheckoutPlan(null);
    }
  };

  // Fetch user stats
  const { data: userStats, isLoading: isLoading } = trpc.stats.getUserStats.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const finalStats = userStats;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Premium Paywall Modal */}
      {showPremiumPaywall && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="bg-slate-900 border-teal-900/30 max-w-2xl w-full p-6 sm:p-8 relative">
            <button
              onClick={() => setShowPremiumPaywall(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-block bg-amber-400/10 border border-amber-400/30 rounded-full p-3 mb-4">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Unlock Premium</h2>
              <p className="text-slate-400">Get unlimited access to all features</p>
            </div>

            <div className="space-y-3 mb-6 sm:mb-8">
              {PREMIUM_FEATURES.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-400/20 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-teal-400" />
                  </div>
                  <span className="text-white text-sm">{feature}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleCheckout("price_monthly", "Monthly")}
                disabled={loading || authLoading}
                className="w-full p-4 rounded-lg border-2 border-teal-400/40 bg-teal-400/10 hover:border-teal-400 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-teal-400 font-semibold text-sm">MONTHLY</p>
                    <p className="text-white font-bold text-xl">€9.99 <span className="text-sm text-slate-400">/month</span></p>
                  </div>
                  {loading && checkoutPlan === "price_monthly" ? <Loader className="w-6 h-6 text-teal-400 animate-spin" /> : <CreditCard className="w-6 h-6 text-teal-400" />}
                </div>
              </button>

              <button
                onClick={() => handleCheckout("price_lifetime", "Lifetime")}
                disabled={loading || authLoading}
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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Performance Stats</h1>
            <p className="text-xs sm:text-base text-slate-400">Track your opening mastery progress.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-slate-400 hover:text-white transition-colors p-1">
              <Download className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>

          {/* Controls */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
            <select 
              value={selectedSet}
              onChange={(e) => setSelectedSet(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-[11px] sm:text-sm">
              <option value="all">ALL SETS</option>
            </select>
            <button 
              onClick={() => setTimeRange("7d")}
              className={`px-1.5 sm:px-3 py-1 sm:py-2 rounded text-[11px] sm:text-sm transition-colors ${
                timeRange === "7d" 
                  ? "bg-amber-400 text-slate-900 font-semibold" 
                  : "text-slate-400 hover:text-white"
              }`}>
              7D
            </button>
            <button 
              onClick={() => setTimeRange("30d")}
              className={`px-1.5 sm:px-3 py-1 sm:py-2 rounded text-[11px] sm:text-sm transition-colors ${
                timeRange === "30d" 
                  ? "bg-amber-400 text-slate-900 font-semibold" 
                  : "text-slate-400 hover:text-white"
              }`}>
              30D
            </button>
            <button 
              onClick={() => setTimeRange("all")}
              className={`px-2 sm:px-4 py-1 sm:py-2 rounded text-[11px] sm:text-sm transition-colors ${
                timeRange === "all" 
                  ? "bg-amber-400 text-slate-900 font-semibold" 
                  : "text-slate-400 hover:text-white"
              }`}>
              ALL
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Tab Navigation */}
        <div className="flex gap-0.5 sm:gap-4 mb-3 sm:mb-8 border-b border-teal-900/30 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-2 sm:pb-4 px-2 sm:px-3 text-xs sm:text-base font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "overview"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("trends")}
            className={`pb-2 sm:pb-4 px-2 sm:px-3 text-xs sm:text-base font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "trends"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Trends
          </button>
          <button
            onClick={() => setActiveTab("openings")}
            className={`pb-2 sm:pb-4 px-2 sm:px-3 text-xs sm:text-base font-semibold whitespace-nowrap shrink-0 transition-colors ${
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
          <div className="space-y-4 sm:space-y-8">
            {/* Key Metrics Grid */}
            <StatsDisplay stats={finalStats} isLoading={isLoading} />


            {/* Rating Trend Chart */}
            {finalStats && (
              <div className="relative">
                <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
                  <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Rating Progression</h3>
                  <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
                    <LineChart data={(() => {
                      const current = finalStats?.rating ?? 1200;
                      const peak    = (finalStats as any)?.peakRating ?? current;
                      const start   = 1200;
                      // Build a 4-point trend: start → midpoint → peak → current
                      const mid = Math.round((start + current) / 2);
                      return [
                        { week: 'Start', rating: start },
                        { week: 'Mid',   rating: mid },
                        { week: 'Peak',  rating: peak },
                        { week: 'Now',   rating: current },
                      ];
                    })()}>
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
          </div>
        )}

        {/* Trends Tab - Now free for all users */}
        {activeTab === "trends" && (
          <div className="space-y-8 relative">
            {/* Accuracy Trend */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Accuracy Trend ({timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'All Time'})</h3>
              {trendLoading ? (
                <div className="h-64 bg-slate-800/50 rounded animate-pulse"></div>
              ) : (
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
                <BarChart data={trendData?.accuracy || []}>
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
              )}
            </Card>

            {/* Time per Puzzle */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Avg Time Per Puzzle ({timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'All Time'})</h3>
              {trendLoading ? (
                <div className="h-64 bg-slate-800/50 rounded animate-pulse"></div>
              ) : (
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
                <LineChart data={trendData?.timePerPuzzle || []}>
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
                  <Line type="monotone" dataKey="time" stroke="#06b6d4" strokeWidth={2} dot={{ fill: "#06b6d4" }} />
                </LineChart>
              </ResponsiveContainer>
              )}
            </Card>

            {/* Training Cycles */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Training Cycles Per Day ({timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'All Time'})</h3>
              {trendLoading ? (
                <div className="h-64 bg-slate-800/50 rounded animate-pulse"></div>
              ) : (
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
                <BarChart data={trendData?.cyclesPerDay || []}>
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
              )}
            </Card>
          </div>
        )}

        {/* Openings Tab - Now free for all users */}
        {activeTab === "openings" && (
          <div className="space-y-8 relative">
            <Card className="bg-slate-900/50 border-teal-900/30 p-3 sm:p-6">
              <h3 className="text-base sm:text-xl font-bold text-white mb-4 sm:mb-6">Opening Mastery</h3>
              {openingLoading ? (
                <div className="space-y-3 sm:space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-slate-800/50 rounded-lg animate-pulse"></div>
                  ))}
                </div>
              ) : openingStats && openingStats.length > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {openingStats.map((opening: any, idx: number) => {
                  const colors = ['amber', 'teal', 'cyan', 'emerald', 'blue', 'purple', 'pink', 'orange'];
                  const colorClass = colors[idx % colors.length];
                  const colorMap: any = {
                    amber: 'amber-400',
                    teal: 'teal-400',
                    cyan: 'cyan-400',
                    emerald: 'emerald-400',
                    blue: 'blue-400',
                    purple: 'purple-400',
                    pink: 'pink-400',
                    orange: 'orange-400',
                  };
                  const bgColorMap: any = {
                    amber: 'bg-amber-400',
                    teal: 'bg-teal-400',
                    cyan: 'bg-cyan-400',
                    emerald: 'bg-emerald-400',
                    blue: 'bg-blue-400',
                    purple: 'bg-purple-400',
                    pink: 'bg-pink-400',
                    orange: 'bg-orange-400',
                  };
                  return (
                    <div key={opening.name} className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg gap-3">
                      <span className="text-white text-sm sm:text-base truncate">{opening.name}</span>
                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="w-16 sm:w-32 bg-slate-700 rounded-full h-2">
                          <div className={bgColorMap[colorClass] + ' h-2 rounded-full'} style={{ width: `${opening.accuracy}%` }}></div>
                        </div>
                        <span className={`text-${colorMap[colorClass]} font-bold text-sm sm:text-base`}>{opening.accuracy}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400">No opening data yet. Complete more training sessions to see your opening statistics.</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
