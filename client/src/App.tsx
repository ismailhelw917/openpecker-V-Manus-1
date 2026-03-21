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

import { useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { getOrCreateDeviceId } from "./_core/deviceId";
import { trpc } from "./lib/trpc";

import { usePageTracking } from "./hooks/usePageTracking";
import { useSessionTracking } from "./hooks/useSessionTracking";

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


  const [showPremiumWatermark, setShowPremiumWatermark] = useState(true);
  const { isAuthenticated, loading, user } = useAuth();

  // Initialize device ID once
  useEffect(() => {
    getOrCreateDeviceId();
  }, []);

  // Lazy-load global settings only when needed
  const { data: globalSettings } = trpc.system.getGlobalSettings.useQuery(undefined, {
    enabled: !loading, // Only load after auth resolves
  });

  // Show content immediately - don't block on auth loading
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 pb-20 sm:pb-24">
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

            {/* Bottom Navigation */}
            <BottomNav />
          </div>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
