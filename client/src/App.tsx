import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import TrainingSession from "./pages/TrainingSession";
import SavedSets from "./pages/SavedSets";
import Stats from "./pages/Stats";
import { useEffect, useState } from "react";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/training/:setId"} component={TrainingSession} />
      <Route path={"/sets"} component={SavedSets} />
      <Route path={"/stats"} component={Stats} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const { user, loading } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Initialize device ID for anonymous users
  useEffect(() => {
    const storedDeviceId = localStorage.getItem("openpecker-device-id");
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    } else {
      const newDeviceId = `device-${Math.random().toString(36).substr(2, 9)}-${Date.now()}`;
      localStorage.setItem("openpecker-device-id", newDeviceId);
      setDeviceId(newDeviceId);
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
          <p className="mt-4 text-slate-300">Loading OpenPecker...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
