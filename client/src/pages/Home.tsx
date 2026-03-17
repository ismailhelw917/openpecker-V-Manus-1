import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [stats, setStats] = useState({ cycles: 0, solved: 0, accuracy: 0 });

  useEffect(() => {
    // Load remembered email if exists
    const remembered = localStorage.getItem("rememberMe");
    if (remembered) {
      const email = localStorage.getItem("email");
      console.log("Remembered user:", email);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex flex-col items-center justify-center pb-24 px-4">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        {/* Bird Logo */}
        <div className="w-24 h-24 mx-auto mb-8 drop-shadow-lg">
          <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/Gemini_Generated_Image_oie9g3oie9g3oie9_9981cecb.webp" alt="OpenPecker" className="w-full h-full object-contain" />
        </div>

        {/* Title */}
        <h1 className="text-6xl font-black text-amber-400 mb-4">OpenPecker</h1>

        {/* Subtitle */}
        <p className="text-xl text-amber-200 mb-8">
          Master opening tactics through deliberate repetition.
        </p>

        {/* CTA Buttons */}
        <div className="space-y-3 mb-12">
          <Button
            onClick={() => setLocation("/train")}
            className="w-full max-w-sm bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-lg py-6 rounded-lg"
          >
            START TRAINING →
          </Button>

          {!isAuthenticated ? (
            <Button
              onClick={() => setLocation("/auth")}
              className="w-full max-w-sm bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-semibold py-6 rounded-lg"
            >
              Sign In / Register
            </Button>
          ) : (
            <div className="text-slate-300 text-sm">
              Welcome, <span className="text-amber-400 font-semibold">{user?.name || user?.email}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-md">
        <Card className="bg-slate-900/50 border-teal-900/30 p-4 text-center">
          <p className="text-amber-400 font-bold text-2xl">{stats.cycles}</p>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Cycles</p>
        </Card>
        <Card className="bg-slate-900/50 border-teal-900/30 p-4 text-center">
          <p className="text-amber-400 font-bold text-2xl">{stats.solved}</p>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Solved</p>
        </Card>
        <Card className="bg-slate-900/50 border-teal-900/30 p-4 text-center">
          <p className="text-amber-400 font-bold text-2xl">{stats.accuracy}%</p>
          <p className="text-slate-400 text-xs uppercase tracking-wider">Acc%</p>
        </Card>
      </div>

      {/* Feature Highlights */}
      <div className="mt-16 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <Card className="bg-slate-900/50 border-teal-900/30 p-4">
          <h3 className="text-amber-400 font-bold mb-2">📚 5.8M Puzzles</h3>
          <p className="text-slate-400 text-sm">
            Train with thousands of opening variations from Lichess
          </p>
        </Card>
        <Card className="bg-slate-900/50 border-teal-900/30 p-4">
          <h3 className="text-amber-400 font-bold mb-2">📊 Advanced Stats</h3>
          <p className="text-slate-400 text-sm">
            Track accuracy, rating trends, and opening mastery
          </p>
        </Card>
        <Card className="bg-slate-900/50 border-teal-900/30 p-4">
          <h3 className="text-amber-400 font-bold mb-2">⚙️ Customizable</h3>
          <p className="text-slate-400 text-sm">
            Choose rating range, themes, and difficulty levels
          </p>
        </Card>
        <Card className="bg-slate-900/50 border-teal-900/30 p-4">
          <h3 className="text-amber-400 font-bold mb-2">🪶 Woodpecker Method</h3>
          <p className="text-slate-400 text-sm">
            Deliberate repetition of opening tactics until mastery
          </p>
        </Card>
      </div>
    </div>
  );
}
