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
import { Leaderboard } from "./pages/Leaderboard";
import Profile from "./pages/Profile";
import AdminAnalytics from "./pages/AdminAnalytics";
import ProAnalytics from "./pages/ProAnalytics";

import { useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { getOrCreateDeviceId } from "./_core/deviceId";
import { trpc } from "./lib/trpc";
import { useLocation } from "wouter";
import { PremiumBanner } from "./components/PremiumBanner";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/train"} component={Train} />
      <Route path={"/sets"} component={SavedSets} />
      <Route path={"/stats"} component={Stats} />
      <Route path={"/leaderboard"} component={Leaderboard} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/session/:id"} component={Session} />
      <Route path={"/auth"} component={Auth} />
       <Route path={"admin/analytics"} component={AdminAnalytics} />
      <Route path={"analytics"} component={ProAnalytics} />

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

  // Initialize device ID and create anonymous account
  const createAnonymousUserMutation = trpc.auth.getOrCreateAnonymous.useMutation();
  const [anonUserCreated, setAnonUserCreated] = useState(false);

  useEffect(() => {
    // Only create anonymous account once when not authenticated
    if (isAuthenticated || loading || anonUserCreated) return;
    
    const deviceId = getOrCreateDeviceId();
    if (deviceId) {
      setAnonUserCreated(true);
      createAnonymousUserMutation.mutate({ deviceId }, {
        onError: () => {
          // Silently fail - anonymous account creation is non-critical
          setAnonUserCreated(false);
        },
      });
    }
  }, [isAuthenticated, loading]);

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

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950">
            {/* Premium Banner for unregistered users */}
            {!isAuthenticated && showGiftPremium && !premiumBannerDismissed && (
              <PremiumBanner onDismiss={() => setPremiumBannerDismissed(true)} />
            )}

            {/* Routes */}
            <Router />

            {/* Bottom Navigation (only for authenticated users) */}
            {isAuthenticated && !loading && <BottomNav />}
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
