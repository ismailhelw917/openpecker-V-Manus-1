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



        {/* Army of Pawns Led by King Background */}
        <div className="mb-8 sm:mb-12 relative w-full max-w-2xl h-48 sm:h-64 rounded-lg overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }}>
          {/* King at the front center */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-8xl sm:text-9xl z-10 drop-shadow-lg">♔</div>
          
          {/* Army of pawns in formation */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Back rows of pawns */}
            <div className="absolute top-8 left-0 right-0 flex justify-center gap-2 sm:gap-4 px-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={`back-${i}`} className="text-4xl sm:text-5xl opacity-60 drop-shadow-lg">♟</div>
              ))}
            </div>
            
            {/* Middle rows of pawns */}
            <div className="absolute top-24 left-0 right-0 flex justify-center gap-1 sm:gap-3 px-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={`mid-${i}`} className="text-3xl sm:text-4xl opacity-70 drop-shadow-lg">♟</div>
              ))}
            </div>
            
            {/* Front rows of pawns */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-1 sm:gap-2 px-4 flex-wrap">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={`front-${i}`} className="text-2xl sm:text-3xl opacity-80 drop-shadow-lg">♟</div>
              ))}
            </div>
          </div>
          
          <p className="absolute bottom-3 left-0 right-0 text-center text-amber-300 text-xs sm:text-sm font-semibold drop-shadow-lg">Master Every Opening</p>
        </div>

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
