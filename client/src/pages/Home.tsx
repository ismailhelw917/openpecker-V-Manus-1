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
      <div className="min-h-screen bg-white flex items-center justify-center pb-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-12">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div className="bg-teal-700 rounded-lg p-4 shadow-lg">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
              alt="OpenPecker Logo"
              className="w-32 h-32 object-contain"
            />
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-4xl md:text-6xl font-black text-teal-700 mb-4">OpenPecker</h1>

        {/* Subtitle */}
        <p className="text-base md:text-xl text-slate-700 mb-8">
          Master opening tactics through deliberate repetition.
        </p>

        {/* CTA Buttons */}
        <div className="space-y-3 mb-6">
          <Button
            onClick={() => setLocation("/train")}
            className="w-full max-w-sm bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg py-6 rounded-lg"
          >
            START TRAINING →
          </Button>

          {!isAuthenticated ? (
            <Button
              onClick={() => setLocation("/auth")}
              className="w-full max-w-sm bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 font-semibold py-6 rounded-lg"
            >
              Sign In / Register
            </Button>
          ) : (
            <div className="text-slate-700 text-sm">
              Welcome, <span className="text-teal-600 font-semibold">{user?.name || user?.email}</span>
            </div>
          )}
        </div>
      </div>



      {/* Feature Highlights */}
      <div className="mt-16 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        <Card className="bg-teal-50 border-teal-200 p-4">
          <h3 className="text-teal-700 font-bold mb-2 text-sm md:text-base">📚 5.8M Puzzles</h3>
          <p className="text-slate-700 text-sm">
            Train with thousands of opening variations from Lichess
          </p>
        </Card>
        <Card className="bg-teal-50 border-teal-200 p-4">
          <h3 className="text-teal-700 font-bold mb-2 text-sm md:text-base">📊 Advanced Stats</h3>
          <p className="text-slate-700 text-sm">
            Track accuracy, rating trends, and opening mastery
          </p>
        </Card>
        <Card className="bg-teal-50 border-teal-200 p-4">
          <h3 className="text-teal-700 font-bold mb-2 text-sm md:text-base">⚙️ Customizable</h3>
          <p className="text-slate-700 text-sm">
            Choose rating range, themes, and difficulty levels
          </p>
        </Card>
        <Card className="bg-teal-50 border-teal-200 p-4">
          <h3 className="text-teal-700 font-bold mb-2 text-sm md:text-base">🪶 Woodpecker Method</h3>
          <p className="text-slate-700 text-sm">
            Deliberate repetition of opening tactics until mastery
          </p>
        </Card>
      </div>
    </div>
  );
}
