import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type AuthMode = "login" | "register" | "forgot";

export default function Auth() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, loading, user, refresh } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  
  // Get redirect URL from query params, default to /train
  const getRedirectUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    return redirect && redirect.startsWith('/') ? redirect : '/train';
  };

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // tRPC mutations
  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const forgotMutation = trpc.auth.forgotPassword.useMutation();
  const utils = trpc.useUtils();

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      setLocation(getRedirectUrl());
    }
  }, [isAuthenticated, loading, user, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await loginMutation.mutateAsync({ email, password });
      await utils.auth.me.invalidate();
      await refresh();
      setLocation(getRedirectUrl());
    } catch (err: any) {
      setError(err?.message || "Login failed. Please try again.");
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      await registerMutation.mutateAsync({
        email,
        password,
        name,
        origin: window.location.origin,
      });
      await utils.auth.me.invalidate();
      await refresh();
      setLocation(getRedirectUrl());
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please try again.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await forgotMutation.mutateAsync({
        email,
        origin: window.location.origin,
      });
      setSuccess(
        "If an account exists with that email, you'll receive a password reset link shortly."
      );
    } catch (err: any) {
      setError(err?.message || "Failed to send reset email. Please try again.");
    }
  };

  const isSubmitting =
    loginMutation.isPending ||
    registerMutation.isPending ||
    forgotMutation.isPending;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center p-4 pb-24">
      <div className="w-full max-w-sm">
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-teal-900/40 to-slate-900/40 rounded-lg p-2 backdrop-blur-sm border-2 border-amber-400/70 shadow-lg shadow-amber-400/20">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
              alt="OpenPecker Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-teal-400 tracking-tight">
            OpenPecker
          </h1>
          <p className="text-slate-400 text-sm mt-1">Chess Puzzle Training</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-6 shadow-xl backdrop-blur-sm">
          {/* Tab switcher for login/register */}
          {mode !== "forgot" && (
            <div className="flex rounded-lg bg-slate-800/60 p-1 mb-6">
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                  mode === "login"
                    ? "bg-teal-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
                  mode === "register"
                    ? "bg-teal-600 text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Create Account
              </button>
            </div>
          )}

          {/* Forgot password header */}
          {mode === "forgot" && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white">Reset Password</h2>
              <p className="text-slate-400 text-sm mt-1">
                Enter your email and we'll send you a reset link.
              </p>
            </div>
          )}

          {/* Error / Success messages */}
          {error && (
            <div className="mb-4 bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 bg-teal-900/40 border border-teal-500/50 rounded-lg px-4 py-3 text-teal-300 text-sm">
              {success}
            </div>
          )}

          {/* LOGIN FORM */}
          {mode === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
              </button>
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(""); setSuccess(""); }}
                  className="text-teal-400 hover:text-teal-300 text-sm"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* REGISTER FORM */}
          {mode === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={2}
                  maxLength={50}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Your chess name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                  placeholder="you@example.com"
                />
              </div>
              {!success && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
                >
                  {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
              )}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="text-teal-400 hover:text-teal-300 text-sm"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Guest option */}
        <div className="text-center mt-4">
          <button
            type="button"
            onClick={() => setLocation("/train")}
            className="text-slate-500 hover:text-slate-300 text-sm transition"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
