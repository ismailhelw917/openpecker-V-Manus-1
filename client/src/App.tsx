import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "@/components/BottomNav";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Train from "./pages/Train";
import SavedSets from "./pages/SavedSets";
import Stats from "./pages/Stats";
import Settings from "./pages/Settings";
import Session from "./pages/Session";
import Auth from "./pages/Auth";
import { useEffect, useState } from "react";
import { nanoid } from "nanoid";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";
import { useLocation } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/train"} component={Train} />
      <Route path={"/sets"} component={SavedSets} />
      <Route path={"/stats"} component={Stats} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/session/:id"} component={Session} />
      <Route path={"/auth"} component={Auth} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [timeLeft, setTimeLeft] = useState(180);
  const [showMaintenance, setShowMaintenance] = useState(() => {
    const stored = localStorage.getItem("openpecker-maintenance");
    return stored === "true";
  });
  const [showGiftPremium, setShowGiftPremium] = useState(true);
  const [giftPremiumDismissed, setGiftPremiumDismissed] = useState(false);
  const [premiumBannerDismissed, setPremiumBannerDismissed] = useState(false);
  const { isAuthenticated, loading, user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: giftEligibility } = trpc.auth.checkGiftEligibility.useQuery();
  const { data: globalSettings } = trpc.system.getGlobalSettings.useQuery();

  useEffect(() => {
    // Initialize device ID if not already set
    const existingDeviceId = localStorage.getItem("openpecker-device-id");
    if (!existingDeviceId) {
      const newDeviceId = nanoid();
      localStorage.setItem("openpecker-device-id", newDeviceId);
    }
  }, []);

  const updateGlobalSettingsMutation = trpc.system.updateGlobalSettings.useMutation();

  // Auto-toggle off gift premium when 100 users reached or global setting disabled
  useEffect(() => {
    if (globalSettings && !globalSettings.showGiftPremiumBanner) {
      setShowGiftPremium(false);
    } else if (giftEligibility && !giftEligibility.isEligible && showGiftPremium) {
      // 100 users reached - auto-disable banner in global settings
      setShowGiftPremium(false);
      updateGlobalSettingsMutation.mutate({ showGiftPremiumBanner: 0 });
    }
  }, [giftEligibility, globalSettings, showGiftPremium, updateGlobalSettingsMutation]);

  useEffect(() => {
    localStorage.setItem("openpecker-maintenance", showMaintenance.toString());
  }, [showMaintenance]);

  // Remove localStorage persistence for gift premium - use global settings instead

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+M to toggle maintenance
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setShowMaintenance(!showMaintenance);
      }
      // Ctrl+Shift+G to toggle gift premium
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setShowGiftPremium(!showGiftPremium);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showMaintenance, showGiftPremium]);

  useEffect(() => {
    if (!showMaintenance) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setShowMaintenance(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showMaintenance]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          {showMaintenance && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-slate-900 border-2 border-amber-400 rounded-lg p-8 text-center max-w-md">
                <h2 className="text-2xl font-bold text-amber-400 mb-4">🔧 Maintenance</h2>
                <p className="text-white mb-6">We're making improvements. Back in:</p>
                <div className="text-5xl font-bold text-amber-400 mb-4">
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
                <p className="text-gray-300">Thank you for your patience!</p>
              </div>
            </div>
          )}
          
          {/* Premium Signup Banner - Show for premium users without email */}
          {!premiumBannerDismissed && isAuthenticated && user?.isPremium && !user?.email && (
            <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 text-white font-bold text-center py-3 z-40 shadow-lg">
              <div className="flex items-center justify-center gap-3 max-w-full px-4">
                <span className="text-sm sm:text-base">✨ You have FREE lifetime premium! Sign up to keep your status.</span>
                <button
                  onClick={() => setLocation("/auth")}
                  className="ml-2 px-4 py-1 bg-white text-purple-600 font-bold rounded hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
                >
                  Sign Up Now
                </button>
                <button
                  onClick={() => setPremiumBannerDismissed(true)}
                  className="ml-2 text-white hover:opacity-75 font-semibold text-lg"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className={`min-h-screen bg-slate-950 flex flex-col ${!premiumBannerDismissed && isAuthenticated && user?.isPremium && !user?.email ? 'pt-16' : ''}`}>
            <div className="flex-1 overflow-y-auto pb-20 sm:pb-24">
              <Router />
            </div>
            <BottomNav />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
