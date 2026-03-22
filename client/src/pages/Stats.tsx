import { useEffect, useState } from "react";
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

const MOCK_RATING_TREND = [
  { week: "W1", rating: 1200 },
  { week: "W2", rating: 1250 },
  { week: "W3", rating: 1300 },
  { week: "W4", rating: 1347 },
];

const MOCK_ACCURACY_TREND = [
  { date: "Mon", accuracy: 65 },
  { date: "Tue", accuracy: 70 },
  { date: "Wed", accuracy: 68 },
  { date: "Thu", accuracy: 75 },
  { date: "Fri", accuracy: 78 },
  { date: "Sat", accuracy: 72 },
  { date: "Sun", accuracy: 73 },
];

const MOCK_TIME_PER_PUZZLE = [
  { day: "Mon", time: 15 },
  { day: "Tue", time: 14 },
  { day: "Wed", time: 13 },
  { day: "Thu", time: 12 },
  { day: "Fri", time: 11 },
  { day: "Sat", time: 12 },
  { day: "Sun", time: 13 },
];

const MOCK_CYCLES_PER_DAY = [
  { day: "Mon", cycles: 3 },
  { day: "Tue", cycles: 4 },
  { day: "Wed", cycles: 3 },
  { day: "Thu", cycles: 5 },
  { day: "Fri", cycles: 4 },
  { day: "Sat", cycles: 2 },
  { day: "Sun", cycles: 3 },
];

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
    setCheckoutPlan(planName);
    try {
      let token = recaptchaToken;
      if (!token && typeof window !== 'undefined' && (window as any).grecaptcha) {
        try {
          token = await (window as any).grecaptcha.execute(
            import.meta.env.VITE_RECAPTCHA_SITE_KEY,
            { action: 'checkout' }
          );
          setRecaptchaToken(token);
        } catch (error) {
          console.warn('reCAPTCHA execution failed, continuing');
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, planName, userId: user.id, email: user.email, recaptchaToken: token }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to create checkout session: ${response.status}`);
      }
      const data = await response.json();
      if (data?.url) {
        window.location.href = `${data.url}?return_url=${encodeURIComponent(window.location.origin)}?checkout=success`;
      } else {
        throw new Error("No checkout URL received from server");
      }
    } catch (error) {
      let errorMsg = error instanceof Error ? error.message : "Failed to start checkout";
      
      // Handle specific error cases
      if (error instanceof Error && error.message.includes('AbortError')) {
        errorMsg = "Checkout request timed out. Please check your connection and try again.";
      } else if (errorMsg.includes('503')) {
        errorMsg = "Payment system is temporarily unavailable. Please try again later.";
      }
      
      console.error('[Stats Checkout] Error:', errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
      setCheckoutPlan(null);
    }
  };
  const utils = trpc.useUtils();

  const trackOnlineMutation = trpc.system.trackUserOnline.useMutation({
    retry: 1,
  });



  // Fetch real user stats using tRPC
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.stats.getUserStats.useQuery(undefined, {
    enabled: Boolean(user),
    retry: 1,
    retryDelay: 1000,
  });

  // Fetch stats for anonymous users by device ID
  // Also used as fallback for logged-in users to include pre-login data
  const { data: anonStats, isLoading: anonStatsLoading } = trpc.stats.getSummary.useQuery(
    { userId: user?.id, deviceId: deviceId || undefined },
    { enabled: !!deviceId || !!user, retry: 1, retryDelay: 1000 }
  );

  // Fetch Counter API metrics
  const { data: onlineData } = trpc.system.getOnlineCount.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000,
  });
  const { data: totalPlayersData } = trpc.system.getTotalPlayerCount.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000,
  });

  // Track user online status - debounced
  useEffect(() => {
    if (user?.id || deviceId) {
      const timer = setTimeout(() => {
        trackOnlineMutation.mutate(
          {
            userId: user?.id,
            userName: user?.name ?? undefined,
            sessionId: deviceId || 'anonymous',
          },
          {
            onError: (error) => {
              console.error('[Stats] trackUserOnline error:', error);
            },
            onSuccess: () => {
              console.log('[Stats] trackUserOnline success');
            },
          }
        );
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user?.id, deviceId]);

  // Auto-refresh stats every 5 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      refetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [user, refetchStats]);

  // Show loading state - wait for auth to finish before deciding which stats to use
  const isLoading = authLoading || (user ? statsLoading : anonStatsLoading);
  const finalStats = user ? stats : anonStats;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading stats...</p>
        </div>
      </div>
    );
  }

  // Paywall: require sign-in to view stats
  if (!user && !authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Lock className="w-16 h-16 text-amber-400 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-amber-400 mb-4">Sign In Required</h2>
          <p className="text-slate-400 mb-8">Sign in to view your detailed performance statistics, rating history, and training analytics.</p>
          <a
            href={getLoginUrl()}
            className="inline-block px-8 py-3 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded-lg transition-colors no-underline"
            style={{ touchAction: "manipulation" }}
          >
            Sign In to View Stats
          </a>
        </div>
      </div>
    );
  }

  // Premium paywall: require premium subscription for full Stats tab
  if (user && !user.isPremium) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="relative inline-block mb-6">
            <Shield className="w-20 h-20 text-amber-400" />
            <Lock className="w-8 h-8 text-slate-900 absolute bottom-0 right-0 bg-amber-400 rounded-full p-1.5" />
          </div>
          <h2 className="text-3xl font-bold text-amber-400 mb-3">Premium Feature</h2>
          <p className="text-slate-400 mb-6 text-lg">Unlock detailed performance analytics, rating history, opening mastery tracking, and more with OpenPecker Premium.</p>
          <ul className="text-left text-slate-300 space-y-2 mb-8 max-w-sm mx-auto">
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-400 mt-1 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20">
      {/* Checkout Loading Overlay */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-sm">
          <div className="text-center space-y-6 px-8">
            <div className="relative mx-auto w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-amber-400/20"></div>
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400 animate-spin"></div>
              <CreditCard className="absolute inset-0 m-auto w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Redirecting to Checkout</h2>
              <p className="text-slate-400 text-sm">Preparing your {checkoutPlan} plan...</p>
              <p className="text-slate-500 text-xs mt-2">Secure payment powered by Stripe</p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Modal */}
      {showPremiumPaywall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={() => setShowPremiumPaywall(false)}>
          <div onClick={(e) => e.stopPropagation()}>
          <Card className="bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-amber-400/30 max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowPremiumPaywall(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            <div className="text-center pt-12 pb-8 px-6 bg-gradient-to-b from-amber-900/20 to-transparent">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-premium-logo-LPhYmaC6iM2uaYuZkpHQpR.webp" alt="OpenPecker Premium" className="w-16 sm:w-20 md:w-24 h-16 sm:h-20 md:h-24 mx-auto mb-4 object-contain" />
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
                disabled={loading || authLoading}
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
            {!user?.isPremium && (
              <button
                onClick={() => setShowPremiumPaywall(true)}
                className="px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap"
              >
                GET PREMIUM
              </button>
            )}
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

            {/* Rating Trend Chart - Premium locked */}
            {finalStats && (
              <div className="relative">
                {!user?.isPremium && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-lg">
                    <Lock className="w-6 sm:w-8 h-6 sm:h-8 text-amber-400 mb-2 sm:mb-3" />
                    <p className="text-amber-400 font-bold text-sm sm:text-lg mb-1">Premium Feature</p>
                    <p className="text-slate-400 text-xs sm:text-sm mb-3 sm:mb-4 text-center px-3">Unlock detailed rating progression charts</p>
                    <Button
                      onClick={() => setShowPremiumPaywall(true)}
                      className="bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold px-4 sm:px-6 text-sm"
                    >
                      <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> Upgrade
                    </Button>
                  </div>
                )}
                <Card className={`bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6 ${!user?.isPremium ? 'blur-[2px] pointer-events-none select-none' : ''}`}>
                  <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Rating Progression</h3>
                  <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
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
          </div>
        )}

        {/* Trends Tab - Premium locked */}
        {activeTab === "trends" && (
          <div className="space-y-8 relative">
            {!user?.isPremium && (
              <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                <Lock className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-amber-400 font-bold text-xl mb-1">Premium Analytics</p>
                <p className="text-slate-400 text-sm mb-4 text-center px-4 max-w-xs">Unlock accuracy trends, time analysis, and training cycle insights</p>
              </div>
            )}
            {/* Accuracy Trend */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Accuracy Trend (7 Days)</h3>
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
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
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Avg Time Per Puzzle (7 Days)</h3>
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
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

            {/* Cycles Per Day */}
            <Card className="bg-slate-900/50 border-teal-900/30 p-2.5 sm:p-6">
              <h3 className="text-sm sm:text-xl font-bold text-white mb-3 sm:mb-6">Training Cycles Per Day</h3>
              <ResponsiveContainer width="100%" height={window.innerWidth < 640 ? 200 : 250}>
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

        {/* Openings Tab - Premium locked */}
        {activeTab === "openings" && (
          <div className="space-y-8 relative">
            {!user?.isPremium && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm rounded-lg min-h-[300px]">
                <Lock className="w-10 h-10 text-amber-400 mb-3" />
                <p className="text-amber-400 font-bold text-xl mb-1">Premium Feature</p>
                <p className="text-slate-400 text-sm mb-4 text-center px-4 max-w-xs">Track your mastery of each opening with detailed breakdowns</p>
              </div>
            )}
            <Card className="bg-slate-900/50 border-teal-900/30 p-3 sm:p-6">
              <h3 className="text-base sm:text-xl font-bold text-white mb-4 sm:mb-6">Opening Mastery</h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg gap-3">
                  <span className="text-white text-sm sm:text-base truncate">Italian Game</span>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="w-16 sm:w-32 bg-slate-700 rounded-full h-2">
                      <div className="bg-amber-400 h-2 rounded-full" style={{ width: "85%" }}></div>
                    </div>
                    <span className="text-amber-400 font-bold text-sm sm:text-base">85%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-800/50 rounded-lg gap-3">
                  <span className="text-white text-sm sm:text-base truncate">Sicilian Defense</span>
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="w-16 sm:w-32 bg-slate-700 rounded-full h-2">
                      <div className="bg-teal-400 h-2 rounded-full" style={{ width: "72%" }}></div>
                    </div>
                    <span className="text-teal-400 font-bold text-sm sm:text-base">72%</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
