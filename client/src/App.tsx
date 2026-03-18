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
import { useEffect } from "react";
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
  useEffect(() => {
    // Initialize device ID if not already set
    const existingDeviceId = localStorage.getItem("openpecker-device-id");
    if (!existingDeviceId) {
      const newDeviceId = nanoid();
      localStorage.setItem("openpecker-device-id", newDeviceId);
    }
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
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
