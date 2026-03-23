import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Lock, Zap, Shield, CreditCard, Loader, Check, Gift, Tag } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getOrCreateDeviceId } from "@/_core/deviceId";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

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
  const { user, logout, loading: authLoading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [selectedTheme, setSelectedTheme] = useState<'classic' | 'green' | 'blue' | 'purple'>(() => {
    const saved = localStorage.getItem('board-theme');
    return (saved as 'classic' | 'green' | 'blue' | 'purple') || 'classic';
  });

  // Promo code state (shared between promo section and premium modal)
  const [promoCode, setPromoCode] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const redeemMutation = trpc.promo.redeem.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        toast.success(
          data.benefitType === "lifetime_premium"
            ? "Congratulations! You now have lifetime premium access!"
            : `Congratulations! You've unlocked ${data.discountPercent}% lifetime discount!`
        );
        setPromoCode("");
        setValidationResult(null);
        utils.auth.me.invalidate();
      } else {
        toast.error(data.error || "Failed to redeem promo code");
      }
    },
    onError: () => {
      toast.error("Failed to redeem promo code. Please try again.");
    },
  });

  const handleValidate = async () => {
    if (!promoCode.trim()) {
      toast.error("Please enter a promo code");
      return;
    }
    setIsValidating(true);
    try {
      const res = await fetch(
        `/api/trpc/promo.validate?input=${encodeURIComponent(JSON.stringify({ json: { code: promoCode.trim() } }))}`
      );
      const json = await res.json();
      const result = json?.result?.data?.json;
      setValidationResult(result);
      if (result?.valid) {
        toast.success("Promo code is valid!");
      } else {
        toast.error(result?.error || "Invalid promo code");
      }
    } catch {
      toast.error("Failed to validate promo code");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRedeem = () => {
    const deviceId = getOrCreateDeviceId();
    redeemMutation.mutate({ code: promoCode.trim(), deviceId });
  };

  const handleThemeChange = (themeId: 'classic' | 'green' | 'blue' | 'purple') => {
    setSelectedTheme(themeId);
    localStorage.setItem('board-theme', themeId);
    // Dispatch storage event so same-tab listeners (Session page) pick up the change
    window.dispatchEvent(new StorageEvent('storage', { key: 'board-theme', newValue: themeId }));
    toast.success(`Board theme changed to ${themeId}`);
  };

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);

  // Handle payment success/cancel from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const sessionId = params.get('session_id');

    if (payment === 'success' && sessionId) {
      toast.success('Payment successful! Your premium access is being activated...');
      fetch(`/api/checkout-session/${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 'paid' || data.status === 'complete') {
            toast.success('Premium access activated! Enjoy all features.');
            utils.auth.me.invalidate();
          }
        })
        .catch(() => {
          toast.info('Payment received. Premium access will be activated shortly.');
        });
      window.history.replaceState({}, '', '/settings');
    } else if (payment === 'cancelled') {
      toast.info('Payment was cancelled. You can try again anytime.');
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleCheckout = async (priceId: string, planName: string) => {
    // If auth is still loading, wait and retry
    if (authLoading) {
      toast.info("Please wait, loading your account...");
      return;
    }
    // If user is not authenticated after auth has loaded, redirect to login
    if (!user) {
      console.log('[Checkout] User not found, redirecting to login');
      window.location.href = "/auth";
      return;
    }
    
    console.log('[Checkout] Proceeding with checkout for user:', user.id);

    setLoading(true);
    setCheckoutPlan(planName);
    try {
      console.log('[Checkout] Creating checkout session with:', { priceId, userId: user.id, email: user.email });
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          planName,
          userId: user.id,
          email: user.email,
          promoCode: validationResult?.valid ? promoCode : undefined,
          discountPercent: validationResult?.valid ? validationResult.discountPercent : 0,
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
        window.location.href = url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
      console.error(error);
    } finally {
      setLoading(false);
      setCheckoutPlan(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-24">
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

      {/* Header */}
      <div className="bg-slate-900/50 backdrop-blur border-b border-teal-900/30 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setLocation("/")}
            className="text-slate-400 hover:text-white transition-colors shrink-0"
            style={{ touchAction: "manipulation" }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Settings</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Board Theme Section */}
        <div className="mb-12">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white mb-1">Board Theme</h2>
            <p className="text-slate-400 text-sm">Choose your preferred chess board colors</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {BOARD_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`group relative p-4 rounded-xl border-2 transition-all duration-200 ${
                  selectedTheme === theme.id
                    ? "border-teal-400 bg-teal-400/10 shadow-lg shadow-teal-400/20"
                    : "border-slate-700 bg-slate-800/20 hover:border-slate-600 hover:bg-slate-800/40"
                }`}
                style={{ touchAction: "manipulation" }}
              >
                {selectedTheme === theme.id && (
                  <div className="absolute -top-2 -right-2 bg-teal-400 rounded-full p-1 shadow-lg">
                    <Check className="w-4 h-4 text-slate-900" strokeWidth={3} />
                  </div>
                )}
                
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

          <Card className="bg-slate-900/50 border-teal-900/30 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
              <div>
                <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">Premium Status</h3>
                <p className="text-slate-400 text-xs sm:text-sm">
                  {user?.isPremium ? "You have access to all premium features." : "Upgrade to unlock all openings and advanced stats."}
                </p>
              </div>
              <span className={`px-3 py-1 rounded text-xs sm:text-sm font-semibold self-start sm:self-auto shrink-0 ${
                user?.isPremium 
                  ? "bg-teal-400/20 text-teal-400" 
                  : "bg-amber-400/20 text-amber-400"
              }`}>
                {user?.isPremium ? "PREMIUM" : "FREE TIER"}
              </span>
            </div>

            {!user?.isPremium && (
              <Button
                onClick={() => setShowPremiumModal(true)}
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3 rounded-lg transition-colors"
                style={{ touchAction: "manipulation" }}
              >
                UPGRADE TO PREMIUM
              </Button>
            )}
            {user?.isPremium && (
              <div className="w-full p-3 bg-teal-400/10 border border-teal-400/30 rounded-lg text-center text-teal-300 font-semibold">
                Premium Active
              </div>
            )}
          </Card>
        </div>



        {/* Account Section */}
        {user && (
          <div className="mb-12">
            <h2 className="text-lg font-bold text-white mb-6">Account</h2>
            <Card className="bg-slate-900/50 border-teal-900/30 p-4 sm:p-6">
              <div className="mb-4 sm:mb-6">
                <p className="text-slate-400 text-sm mb-2">Signed in as</p>
                <p className="text-white font-semibold text-sm sm:text-base truncate">{user.email || user.name || "User"}</p>
              </div>

              <Button
                onClick={handleLogout}
                variant="destructive"
                className="w-full"
                style={{ touchAction: "manipulation" }}
              >
                Sign Out
              </Button>
            </Card>
          </div>
        )}

        {/* Contact Us Section */}
        <div className="mb-12">
          <h2 className="text-lg font-bold text-white mb-6">Contact & Support</h2>
          <Card className="bg-slate-900/50 border-teal-900/30 p-4 sm:p-6">
            <p className="text-slate-400 text-sm mb-4">Have questions or feedback? We would love to hear from you!</p>
            <a
              href="mailto:happychesspenguin@gmail.com"
              className="inline-block w-full"
            >
              <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold">
                Contact Us
              </Button>
            </a>
            <p className="text-slate-500 text-xs mt-3 text-center">happychesspenguin@gmail.com</p>
          </Card>
        </div>
      </div>

      {/* Premium Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-3">
          <Card className="bg-gradient-to-b from-amber-950 via-slate-900 to-slate-950 border-amber-400/30 max-w-lg w-full max-h-[95vh] overflow-y-auto relative">
            {/* Close Button */}
            <button
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors text-xl p-2"
              style={{ touchAction: "manipulation" }}
            >
              ✕
            </button>

            {/* Header */}
            <div className="text-center pt-4 sm:pt-6 pb-3 sm:pb-4 px-3 sm:px-4 bg-gradient-to-b from-amber-900/20 to-transparent">
              <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-premium-logo-LPhYmaC6iM2uaYuZkpHQpR.webp" alt="OpenPecker Premium" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-2 sm:mb-2 object-contain" />
              <h2 className="text-xl sm:text-2xl font-bold text-amber-100">OpenPecker Premium</h2>
            </div>

            {/* Features */}
            <div className="px-3 sm:px-4 py-3 sm:py-4 border-t border-b border-amber-400/20">
              <div className="space-y-2">
                {PREMIUM_FEATURES.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-teal-400 mt-0.5 text-sm">&#10003;</span>
                    <span className="text-white text-xs sm:text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>



            {/* Pricing */}
            <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-2 sm:space-y-3">
              {/* Monthly */}
              <button
                type="button"
                onClick={() => handleCheckout("price_monthly", "Monthly")}
                disabled={loading || authLoading}
                className="w-full p-3 rounded-lg border-2 border-slate-700 bg-slate-800/50 hover:border-amber-400 hover:bg-amber-400/5 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ touchAction: "manipulation" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-xs">MONTHLY</p>
                    <p className="text-white font-bold text-lg">&euro;4.99 <span className="text-xs text-slate-400">/month</span></p>
                  </div>
                  {loading ? <Loader className="w-5 h-5 text-amber-400 animate-spin" /> : <Zap className="w-5 h-5 text-amber-400" />}
                </div>
              </button>

              {/* Lifetime */}
              <button
                type="button"
                onClick={() => handleCheckout("price_lifetime", "Lifetime")}
                disabled={loading || authLoading}
                className="w-full p-3 rounded-lg border-2 border-amber-400/40 bg-amber-400/10 hover:border-amber-400 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ touchAction: "manipulation" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-400 font-semibold text-xs">LIFETIME ACCESS</p>
                    <p className="text-white font-bold text-lg">&euro;49 <span className="text-xs text-slate-400">/once</span></p>
                  </div>
                  {loading ? <Loader className="w-5 h-5 text-amber-400 animate-spin" /> : <Shield className="w-5 h-5 text-amber-400" />}
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="px-3 sm:px-4 py-2 bg-amber-900/10">
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
