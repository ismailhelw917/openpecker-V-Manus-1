import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load remembered preference on mount
  useEffect(() => {
    const remembered = localStorage.getItem("rememberMe");
    if (remembered === "true") {
      setRememberMe(true);
    }
  }, []);

  const handleManuOAuthLogin = async () => {
    try {
      setIsLoading(true);
      
      // Save remember me preference
      if (rememberMe) {
        localStorage.setItem("rememberMe", "true");
        // Set extended session duration
        localStorage.setItem("sessionExpiry", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
      } else {
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("sessionExpiry");
      }

      // Redirect to Manus OAuth portal
      const loginUrl = getLoginUrl();
      window.location.href = loginUrl;
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Failed to initiate login. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center p-4 pb-24">
      <Card className="bg-slate-900/50 border-teal-900/30 w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full border-2 border-amber-400 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">♟</span>
          </div>
          <h1 className="text-3xl font-bold text-amber-400">OpenPecker</h1>
          <p className="text-slate-400 mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="space-y-4">
          <Button
            onClick={handleManuOAuthLogin}
            disabled={isLoading}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 text-lg"
          >
            {isLoading ? "Redirecting..." : "Sign In with Manus"}
          </Button>

          {/* Remember Me Option */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              className="border-slate-600"
            />
            <label
              htmlFor="remember"
              className="text-sm text-slate-400 cursor-pointer"
            >
              Keep me signed in for 30 days
            </label>
          </div>

          <p className="text-xs text-slate-500 text-center pt-2">
            By signing in, you agree to our Terms of Service
          </p>
        </div>

        {/* Guest Option */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <Button
            onClick={() => setLocation("/")}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
          >
            Continue as Guest
          </Button>
        </div>
      </Card>
    </div>
  );
}
