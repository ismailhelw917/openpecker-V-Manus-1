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
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import NameSelectionDialog from "./components/NameSelectionDialog";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { getOrCreateDeviceId } from "./_core/deviceId";
import { trpc } from "./lib/trpc";
import { useLocation } from "wouter";

import { usePageTracking } from "./hooks/usePageTracking";
import { useSessionTracking } from "./hooks/useSessionTracking";
import { useHeartbeat } from "./hooks/useHeartbeat";

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
      <Route path={"/register"} component={Register} />
      <Route path={"/reset-password"} component={ResetPassword} />
      <Route path={"/play/:id"} component={Session} />

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Track page views for analytics
  usePageTracking();
  
  // Track user sessions with heartbeats
  useSessionTracking();
  
  // Track active sessions with real user names
  useHeartbeat();

  const [showPremiumWatermark, setShowPremiumWatermark] = useState(true);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [hasSeenNameDialog, setHasSeenNameDialog] = useState(false);
  const [pwaTriggered, setPwaTriggered] = useState(false);
  const [location] = useLocation();
  const isSessionPage = location.startsWith('/session/') || location.startsWith('/play/');

  // Trigger PWA banner when user visits Rank or Stats
  useEffect(() => {
    if (location === "/leaderboard" || location === "/stats") {
      setPwaTriggered(true);
    }
  }, [location]);
  const { isAuthenticated, loading, user, refresh: refreshAuth } = useAuth();
  const updateNameMutation = trpc.auth.updateName.useMutation();

  // Initialize device ID once
  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  // Show name selection dialog for new users
  useEffect(() => {
    if (!loading && isAuthenticated && user && !hasSeenNameDialog) {
      // Check if user has a default name (from OAuth) or needs to set one
      const hasCustomName = user.name && !user.name.includes('@');
      if (!hasCustomName) {
        setShowNameDialog(true);
        setHasSeenNameDialog(true);
      }
    }
  }, [isAuthenticated, loading, user, hasSeenNameDialog]);

  // Handle checkout success - refresh auth state when returning from Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      // User just completed checkout, refresh auth state to get updated isPremium
      refreshAuth();
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [refreshAuth]);

  const handleNameSave = async (name: string) => {
    try {
      await updateNameMutation.mutateAsync({ name });
      await refreshAuth();
      setShowNameDialog(false);
    } catch (error) {
      console.error('Failed to update name:', error);
      throw error;
    }
  };

  // Lazy-load global settings only when needed
  const { data: globalSettings } = trpc.system.getGlobalSettings.useQuery(undefined, {
    enabled: !loading, // Only load after auth resolves
  });

  // Show content immediately - don't block on auth loading
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <div className={isSessionPage ? "" : "min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20 sm:pb-24"}>
            {/* Premium Watermark for online users */}
            {showPremiumWatermark && user?.isPremium && (
              <div className="fixed top-4 right-4 bg-amber-500/20 border border-amber-400 rounded-lg px-4 py-2 text-sm text-amber-300 z-50 flex items-center gap-2">
                <span>✨ Premium granted to all online users</span>
                <button onClick={() => setShowPremiumWatermark(false)} className="ml-2 text-amber-300 hover:text-amber-200">×</button>
              </div>
            )}

            {/* Routes - render immediately, pages handle their own loading states */}
            <div className="max-w-screen-xl mx-auto">
              <Router />
            </div>

            {/* PWA Install Prompt — shows after user visits Rank or Stats */}
            <PWAInstallPrompt triggered={pwaTriggered} />

            {/* Bottom Navigation */}
            <BottomNav />

            {/* Name Selection Dialog */}
            {isAuthenticated && user && (
              <NameSelectionDialog
                isOpen={showNameDialog}
                onClose={() => setShowNameDialog(false)}
                currentName={user.name || undefined}
                onNameSave={handleNameSave}
              />
            )}
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
