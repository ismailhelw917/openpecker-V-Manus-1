import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [stats, setStats] = useState({
    cycles: 0,
    solved: 0,
    accuracy: 0,
  });

  useEffect(() => {
    // Load stats from localStorage for anonymous users
    const deviceId = localStorage.getItem("openpecker-device-id");
    if (deviceId) {
      // In a real app, fetch stats from the API
      const savedStats = localStorage.getItem(`stats-${deviceId}`);
      if (savedStats) {
        try {
          setStats(JSON.parse(savedStats));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const handleStartTraining = () => {
    if (!user && !localStorage.getItem("openpecker-device-id")) {
      // Generate device ID for anonymous users
      const deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("openpecker-device-id", deviceId);
    }
    setLocation("/train");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center pb-24 px-4">
      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center space-y-8 max-w-2xl">
        {/* Glowing Pawn Icon */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-2xl"></div>
          {/* Circle border */}
          <div className="absolute inset-0 border-2 border-amber-400/40 rounded-full"></div>
          {/* Pawn icon */}
          <svg
            className="w-16 h-16 text-amber-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C10.9 2 10 2.9 10 4c0 1.1.9 2 2 2s2-.9 2-2c0-1.1-.9-2-2-2zm0 4c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V13H9v2h6v-2h-2V11.83c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-4 4v2h8v-2H8zm0 3v2h8v-2H8z" />
          </svg>
        </div>

        {/* Title and Subtitle */}
        <div className="text-center space-y-3">
          <h1 className="text-6xl font-bold text-amber-400">OpenPecker</h1>
          <p className="text-lg text-slate-400">
            Master opening tactics through deliberate repetition.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-3 pt-4">
          <Button
            onClick={handleStartTraining}
            className="w-full h-14 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-lg rounded-lg transition-colors"
          >
            START TRAINING →
          </Button>

          {!user && (
            <Button
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
              variant="outline"
              className="w-full h-14 border-slate-600 text-slate-300 hover:bg-slate-800/50 font-semibold text-base rounded-lg"
            >
              Sign in / Register
            </Button>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="flex gap-4 mt-16 justify-center flex-wrap">
        <div className="border border-slate-700 rounded-lg px-6 py-4 bg-slate-800/30 backdrop-blur-sm">
          <div className="text-2xl font-bold text-amber-400">{stats.cycles}</div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Cycles
          </div>
        </div>

        <div className="border border-slate-700 rounded-lg px-6 py-4 bg-slate-800/30 backdrop-blur-sm">
          <div className="text-2xl font-bold text-amber-400">{stats.solved}</div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Solved
          </div>
        </div>

        <div className="border border-slate-700 rounded-lg px-6 py-4 bg-slate-800/30 backdrop-blur-sm">
          <div className="text-2xl font-bold text-amber-400">
            {stats.accuracy > 0 ? `${Math.round(stats.accuracy)}%` : "—"}
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Acc%
          </div>
        </div>
      </div>
    </div>
  );
}
