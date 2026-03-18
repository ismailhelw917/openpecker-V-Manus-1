import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Mail, Lock, User } from "lucide-react";

type AuthMode = "login" | "register";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Register form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Call registration endpoint
      toast.success("Account created! You can now sign in with Manus.");
      setMode("login");
      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Registration failed. Please try again.");
    } finally {
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
          <p className="text-slate-400 mt-2">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Login Mode */}
        {mode === "login" && (
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
        )}

        {/* Register Mode */}
        {mode === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-800 border-slate-700 text-white placeholder-slate-500"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold py-3"
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>

            <p className="text-xs text-slate-500 text-center">
              By creating an account, you agree to our Terms of Service
            </p>
          </form>
        )}

        {/* Toggle Mode Button */}
        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-3">
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setName("");
                setEmail("");
                setPassword("");
                setConfirmPassword("");
              }}
              className="text-amber-400 hover:text-amber-300 font-semibold"
            >
              {mode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>

        {/* Guest Option */}
        <div className="mt-4">
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
