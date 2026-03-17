import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Lock, Zap, Shield, CreditCard } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

interface BoardTheme {
  name: string;
  colors: {
    light: string;
    dark: string;
  };
  preview: string;
}

const BOARD_THEMES: BoardTheme[] = [
  {
    name: "Classic Wood",
    colors: { light: "#F0D9B5", dark: "#B58863" },
    preview: "🟫",
  },
  {
    name: "Ocean Breeze",
    colors: { light: "#E8F4F8", dark: "#4A7C7E" },
    preview: "🟦",
  },
  {
    name: "Tournament Green",
    colors: { light: "#F0F0F0", dark: "#6B8E23" },
    preview: "🟩",
  },
];

const PREMIUM_FEATURES = [
  "Unlock all 150+ opening variations",
  "Advanced performance analytics",
  "Unlimited training cycles",
  "Priority puzzle loading",
  "Support independent development",
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [selectedTheme, setSelectedTheme] = useState("Classic Wood");
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation("/")}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Board Theme Section */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-white mb-6">Board Theme</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.name}
                onClick={() => setSelectedTheme(theme.name)}
                className={`p-6 rounded-lg border-2 transition-all text-center ${
                  selectedTheme === theme.name
                    ? "border-amber-400 bg-amber-400/10"
                    : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
                }`}
              >
                <div className="text-4xl mb-3">{theme.preview}</div>
                <p className="font-semibold text-white">{theme.name}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Subscription & Account Section */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            SUBSCRIPTION & ACCOUNT
          </h2>

          <Card className="bg-slate-900/50 border-teal-900/30 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-white font-semibold mb-1">Premium Status</h3>
                <p className="text-slate-400 text-sm">
                  {user ? "Upgrade to unlock all openings and advanced stats." : "Sign in to upgrade"}
                </p>
              </div>
              <span className="bg-amber-400/20 text-amber-400 px-3 py-1 rounded text-sm font-semibold">
                {user ? "PREMIUM" : "FREE TIER"}
              </span>
            </div>

            <Button
              onClick={() => setShowPremiumModal(true)}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg transition-colors"
            >
              UPGRADE TO PREMIUM
            </Button>
          </Card>
        </div>

        {/* Account Section */}
        {user && (
          <div className="mb-12">
            <h2 className="text-lg font-bold text-white mb-6">Account</h2>
            <Card className="bg-slate-900/50 border-teal-900/30 p-6">
              <div className="mb-6">
                <p className="text-slate-400 text-sm mb-2">Signed in as</p>
                <p className="text-white font-semibold">{user.email || user.name || "User"}</p>
              </div>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full"
              >
                Sign Out
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-gradient-to-b from-slate-900 to-slate-950 border-teal-900/30 max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center pt-12 pb-8 px-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-amber-400/40 flex items-center justify-center">
                <span className="text-3xl">♟</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">OpenPecker Premium</h2>
              <p className="text-slate-400">Master every opening. No limits.</p>
            </div>

            {/* Features */}
            <div className="px-6 py-8 border-t border-b border-slate-800">
              <div className="space-y-4">
                {PREMIUM_FEATURES.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-teal-400 mt-1">✓</span>
                    <span className="text-white">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="px-6 py-8 space-y-4">
              {/* Monthly */}
              <button className="w-full p-4 rounded-lg border-2 border-slate-700 bg-slate-800/50 hover:border-amber-400 hover:bg-amber-400/5 transition-all text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm">MONTHLY</p>
                    <p className="text-white font-bold text-xl">€4.99 <span className="text-sm text-slate-400">/month</span></p>
                  </div>
                  <Zap className="w-6 h-6 text-amber-400" />
                </div>
              </button>

              {/* Lifetime */}
              <button className="w-full p-4 rounded-lg border-2 border-amber-400/40 bg-amber-400/10 hover:border-amber-400 transition-all text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-400 font-semibold text-sm">LIFETIME ACCESS</p>
                    <p className="text-white font-bold text-xl">€49 <span className="text-sm text-slate-400">/once</span></p>
                  </div>
                  <Shield className="w-6 h-6 text-amber-400" />
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 py-6 bg-slate-900/50">
              <p className="text-slate-400 text-xs text-center">
                Secure payments powered by Stripe. Cancel anytime.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
