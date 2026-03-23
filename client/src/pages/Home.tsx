import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

// Stable query input — no new object on every render
const LB_INPUT = { limit: 1, sortBy: "accuracy" as const };

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [premiumNotified, setPremiumNotified] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  const { data: lbData } = trpc.stats.getLeaderboard.useQuery(LB_INPUT, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const topPlayer = lbData?.players?.[0]?.playerName ?? null;
  const totalSolved = lbData?.summary?.totalPuzzlesSolvedGlobally ?? 0;
  const totalPlayers = lbData?.summary?.totalPlayers ?? 0;

  useEffect(() => {
    if (isAuthenticated && user && !premiumNotified && user.isPremium) {
      toast.success("Welcome! You've been granted FREE lifetime premium!", {
        duration: 5000,
      });
      setPremiumNotified(true);
    }
  }, [isAuthenticated, user, premiumNotified]);

  if (loading) {
    return (
      <div className="h-[calc(100dvh-5rem)] bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-5rem)] bg-slate-950 flex flex-col items-center justify-center px-5 py-6 relative overflow-hidden">

      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-900/20 rounded-full blur-3xl" />
      </div>

      {/* Language selector — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-800 rounded-full px-1 py-1 border border-slate-700 z-10">
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
            language === 'en'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('hi')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
            language === 'hi'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          हिं
        </button>
      </div>

      {/* Logo */}
      <div className="mb-4 flex justify-center relative z-10">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-new-logo_6f9fcd4c.jpg"
          alt="OpenPecker Logo"
          className="w-48 sm:w-64 object-contain rounded-xl shadow-2xl"
        />
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black text-white mb-1 text-center relative z-10">
        OpenPecker
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-slate-400 mb-5 text-center max-w-xs relative z-10">
        {t.appTagline}
      </p>

      {/* ── Social proof stats ── */}
      <div className="flex items-center gap-3 mb-6 flex-wrap justify-center relative z-10">
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-full px-3 py-1.5">
          <span className="text-teal-400 text-sm">♟</span>
          <span className="text-xs font-semibold text-slate-200">4,800,000+ puzzles</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 rounded-full px-3 py-1.5">
          <span className="text-teal-400 text-sm">👥</span>
          <span className="text-xs font-semibold text-slate-200">
            {totalPlayers > 0 ? `${totalPlayers.toLocaleString()} players` : "4,125+ players"}
          </span>
        </div>
        {topPlayer && (
          <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-3 py-1.5">
            <span className="text-sm">🥇</span>
            <span className="text-xs font-semibold text-yellow-300">{topPlayer}</span>
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="flex items-center gap-2 mb-7 relative z-10">
        {[
          { icon: "📂", label: language === 'hi' ? "ओपनिंग चुनें" : "Pick an opening" },
          { icon: "→", label: null, arrow: true },
          { icon: "♟", label: language === 'hi' ? "पज़ल्स हल करें" : "Solve puzzles" },
          { icon: "→", label: null, arrow: true },
          { icon: "📈", label: language === 'hi' ? "प्रगति ट्रैक करें" : "Track accuracy" },
        ].map((step, i) =>
          step.arrow ? (
            <span key={i} className="text-slate-600 text-sm font-bold">→</span>
          ) : (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg">
                {step.icon}
              </div>
              <span className="text-[9px] text-slate-500 text-center max-w-[3.5rem] leading-tight">{step.label}</span>
            </div>
          )
        )}
      </div>

      {/* ── CTAs ── */}
      <div className="w-full max-w-xs space-y-3 relative z-10">
        {/* Primary CTA */}
        <button
          onClick={() => setLocation("/train")}
          className="w-full bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-lg py-4 rounded-xl transition-colors shadow-lg shadow-teal-900/40"
          style={{ touchAction: "manipulation" }}
        >
          {t.home.startTraining}
        </button>

        {/* No sign-up note */}
        <p className="text-center text-slate-500 text-xs">
          {language === 'hi' ? 'शुरू करने के लिए साइन अप की जरूरत नहीं' : 'No sign-up required to start'}
        </p>

        {/* Secondary: sign in or welcome */}
        {isAuthenticated ? (
          <p className="text-center text-slate-400 text-sm pt-1">
            {t.home.welcome}{" "}
            <span className="text-teal-400 font-semibold">
              {user?.name || user?.email}
            </span>
          </p>
        ) : (
          <a
            href="/auth"
            className="w-full bg-transparent border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all text-sm"
            style={{ touchAction: "manipulation", textDecoration: "none" }}
          >
            <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            {language === 'hi' ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
          </a>
        )}
      </div>
    </div>
  );
}
