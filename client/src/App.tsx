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

  useEffect(() => {
    // Initialize device ID if not already set
    const existingDeviceId = localStorage.getItem("openpecker-device-id");
    if (!existingDeviceId) {
      const newDeviceId = nanoid();
      localStorage.setItem("openpecker-device-id", newDeviceId);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("openpecker-maintenance", showMaintenance.toString());
  }, [showMaintenance]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+M to toggle maintenance
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        setShowMaintenance(!showMaintenance);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showMaintenance]);

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
          <div className="min-h-screen bg-slate-950 flex flex-col">
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
