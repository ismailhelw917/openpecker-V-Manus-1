import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Lock, Zap, Shield, CreditCard, Loader, Check } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

interface BoardTheme {
  id: 'classic' | 'green' | 'blue' | 'purple';
  name: string;
  colors: {
    light: string;
    dark: string;
  };
}

const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'classic',
    name: "Classic",
    colors: { light: "#f0d9b5", dark: "#b58863" },
  },
  {
    id: 'green',
    name: "Green",
    colors: { light: "#ffffcc", dark: "#7cb342" },
  },
  {
    id: 'blue',
    name: "Blue",
    colors: { light: "#e8f4f8", dark: "#2c5aa0" },
  },
  {
    id: 'purple',
    name: "Purple",
    colors: { light: "#f0e6ff", dark: "#6b4c9a" },
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
  const [selectedTheme, setSelectedTheme] = useState<'classic' | 'green' | 'blue' | 'purple'>(() => {
    const saved = localStorage.getItem('board-theme');
    return (saved as 'classic' | 'green' | 'blue' | 'purple') || 'classic';
  });

  const handleThemeChange = (themeId: 'classic' | 'green' | 'blue' | 'purple') => {
    setSelectedTheme(themeId);
    localStorage.setItem('board-theme', themeId);
    toast.success(`Board theme changed to ${themeId}`);
  };
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

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950">
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
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Board Theme</h2>
            <p className="text-slate-400 text-sm">Choose your preferred chess board colors</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedTheme === theme.id
                    ? "border-teal-400 bg-teal-400/10 shadow-lg shadow-teal-400/20"
                    : "border-slate-700 bg-slate-800/20 hover:border-slate-600 hover:bg-slate-800/40"
                }`}
              >
                {/* Checkmark for selected */}
                {selectedTheme === theme.id && (
                  <div className="absolute -top-2 -right-2 bg-teal-400 rounded-full p-1 shadow-lg">
                    <Check className="w-4 h-4 text-slate-900" strokeWidth={3} />
                  </div>
                )}
                
                {/* Theme preview - checkerboard */}
                <div className="mb-3 mx-auto">
                  <div className="w-20 h-20 rounded-lg border-2 overflow-hidden shadow-md" style={{ borderColor: theme.colors.dark }}>
                    <div className="grid grid-cols-4 w-full h-full">
                      {[...Array(16)].map((_, i) => (
                        <div
                          key={i}
                          className="w-full h-full"
                          style={{
                            backgroundColor: (i + Math.floor(i / 4)) % 2 === 0 ? theme.colors.light : theme.colors.dark,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Theme name */}
                <p className={`font-semibold text-sm transition-colors ${
                  selectedTheme === theme.id ? "text-teal-300" : "text-slate-300 group-hover:text-white"
                }`}>
                  {theme.name}
                </p>
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
          <Card className="bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-amber-400/30 max-w-lg w-full max-h-[90vh] overflow-y-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center pt-12 pb-8 px-6 bg-gradient-to-b from-amber-900/20 to-transparent">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-premium-logo-LPhYmaC6iM2uaYuZkpHQpR.webp" alt="OpenPecker Premium" className="w-24 h-24 mx-auto mb-4 object-contain" />
              <h2 className="text-3xl font-bold text-amber-100 mb-2">OpenPecker Premium</h2>
              <p className="text-amber-200/70">Master every opening. No limits.</p>
            </div>

            {/* Features */}
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

            {/* Pricing */}
            <div className="px-6 py-8 space-y-4">
              {/* Monthly */}
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

              {/* Lifetime */}
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

            {/* Footer */}
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
