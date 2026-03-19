import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [stats, setStats] = useState({ cycles: 0, solved: 0, accuracy: 0 });
  const [premiumNotified, setPremiumNotified] = useState(false);
  const [remainingSpots, setRemainingSpots] = useState(91);

  useEffect(() => {
    // Show premium notification to authenticated users
    if (isAuthenticated && user && !premiumNotified && user.isPremium) {
      toast.success("🎉 Welcome! You've been granted FREE lifetime premium!", {
        duration: 5000,
      });
      setPremiumNotified(true);
    }
  }, [isAuthenticated, user, premiumNotified]);

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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-3 sm:px-4 py-6 sm:py-8">
      {/* Hero Section */}
      <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
        {/* Logo */}
        <div className="mb-6 sm:mb-8 flex justify-center">
          <div className="bg-teal-700 rounded-lg p-3 sm:p-4 shadow-lg">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
              alt="OpenPecker Logo"
              className="w-20 h-20 sm:w-32 sm:h-32 object-contain"
            />
          </div>
        </div>
        
        {/* Title */}
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black text-teal-700 mb-3 sm:mb-4">OpenPecker</h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-xl text-slate-700 mb-6 sm:mb-8">
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
            <div className="space-y-2">
              <Button
                onClick={() => window.location.href = getLoginUrl()}
                className="w-full max-w-sm bg-white hover:bg-gray-50 text-slate-900 border-2 border-slate-300 font-semibold py-6 rounded-lg flex items-center justify-center gap-2 transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Login with Google
              </Button>
              <Button
                onClick={() => setLocation("/auth")}
                className="w-full max-w-sm bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 font-semibold py-6 rounded-lg"
              >
                Sign In / Register
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-slate-700 text-sm">
                Welcome, <span className="text-teal-600 font-semibold">{user?.name || user?.email}</span>
              </div>
              {!user?.isPremium && (
                <Button
                  onClick={() => setLocation("/stats")}
                  className="w-full max-w-sm bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg transition-all"
                >
                  ⭐ Upgrade to Premium
                </Button>
              )}
            </div>
          )}
        </div>
      </div>



      {/* Feature Highlights */}
      <div className="mt-8 sm:mt-16 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full">
        <Card className="bg-teal-50 border-teal-200 p-4">
          <h3 className="text-teal-700 font-bold mb-2 text-sm md:text-base">📚 5.8M Puzzles</h3>
          <p className="text-slate-700 text-sm">
            Train with thousands of opening variations from chess
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
