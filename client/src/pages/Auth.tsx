import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Lock } from "lucide-react";
import { trpc } from "@/lib/trpc";

type AuthMode = "login" | "register";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Login form fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Register form fields
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");

  const registerMutation = trpc.auth.register.useMutation();
  const loginMutation = trpc.auth.login.useMutation();
  const { refetch: refetchAuth } = trpc.auth.me.useQuery();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginEmail || !loginPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginMutation.mutateAsync({
        email: loginEmail,
        password: loginPassword,
        rememberMe,
      });

      if (result.success) {
        toast.success(result.message);
        // Refresh auth state and redirect
        await refetchAuth();
        setLocation("/");
      } else {
        toast.error(result.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (registerPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      const result = await registerMutation.mutateAsync({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
      });

      if (result.success) {
        if (result.isPremium) {
          toast.success("🎉 Welcome! You've been granted FREE lifetime premium!");
        } else {
          toast.success("Account created! You can now sign in.");
        }
        setMode("login");
        setRegisterName("");
        setRegisterEmail("");
        setRegisterPassword("");
        setRegisterConfirmPassword("");
      } else {
        toast.error(result.error || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center p-4 pb-24">
      <Card className="bg-slate-900/20 border-teal-900/20 w-full max-w-md p-8 backdrop-blur-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-teal-900/40 to-slate-900/40 rounded-lg p-2 backdrop-blur-sm border-2 border-amber-400/70 shadow-lg shadow-amber-400/20">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
              alt="OpenPecker Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-teal-500">OpenPecker</h1>
          <p className="text-slate-500 mt-2">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </p>
        </div>

        {/* Login Mode */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
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
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="pl-10 bg-slate-900/30 border-slate-700/50 text-slate-100 placeholder-slate-600 backdrop-blur-sm"
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
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="pl-10 bg-slate-900/30 border-slate-700/50 text-slate-100 placeholder-slate-600 backdrop-blur-sm"
                />
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="border-slate-600"
              />
              <label
                htmlFor="remember"
                className="text-sm text-slate-500 cursor-pointer"
              >
                Keep me signed in for 30 days
              </label>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-teal-600/80 hover:bg-teal-600 text-white font-bold py-3 text-lg backdrop-blur-sm"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-xs text-slate-600 text-center pt-2">
              By signing in, you agree to our Terms of Service
            </p>
          </form>
        )}

        {/* Register Mode */}
        {mode === "register" && (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="John Doe"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder-slate-500"
              />
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
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  className="pl-10 bg-slate-900/30 border-slate-700/50 text-slate-100 placeholder-slate-600 backdrop-blur-sm"
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
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  className="pl-10 bg-slate-900/30 border-slate-700/50 text-slate-100 placeholder-slate-600 backdrop-blur-sm"
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
                  value={registerConfirmPassword}
                  onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-900/30 border-slate-700/50 text-slate-100 placeholder-slate-600 backdrop-blur-sm"
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

            <p className="text-xs text-slate-600 text-center">
              By creating an account, you agree to our Terms of Service
            </p>
          </form>
        )}

        {/* Toggle Mode Button */}
        <div className="mt-6 pt-6 border-t border-slate-700 text-center">
          <p className="text-slate-500 text-sm mb-3">
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setLoginEmail("");
                setLoginPassword("");
                setRegisterName("");
                setRegisterEmail("");
                setRegisterPassword("");
                setRegisterConfirmPassword("");
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
            className="w-full bg-slate-900/30 hover:bg-slate-900/50 text-slate-100 border border-slate-700/50 backdrop-blur-sm"
          >
            Continue as Guest
          </Button>
        </div>
      </Card>
    </div>
  );
}
