import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { refresh } = useAuth();
  const utils = trpc.useUtils();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const resetMutation = trpc.auth.resetPassword.useMutation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
      await resetMutation.mutateAsync({ token, password });
      setSuccess(true);
      // Refresh auth state (auto-login after reset)
      await utils.auth.me.invalidate();
      await refresh();
      // Redirect to home after short delay
      setTimeout(() => setLocation("/"), 2000);
    } catch (err: any) {
      setError(err?.message || "Failed to reset password. The link may have expired.");
    }
  };

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
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Set New Password</h2>
            <p className="text-slate-400 text-sm mt-1">
              Choose a strong password for your account.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Success state */}
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-teal-300 font-semibold mb-1">Password updated!</p>
              <p className="text-slate-400 text-sm">
                You're now signed in. Redirecting to home...
              </p>
            </div>
          ) : !error || token ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  disabled={!token}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm disabled:opacity-50"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={!token}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm disabled:opacity-50"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={resetMutation.isPending || !token}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
              >
                {resetMutation.isPending ? "Updating..." : "Update Password"}
              </button>
            </form>
          ) : null}

          {!success && (
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => setLocation("/auth")}
                className="text-teal-400 hover:text-teal-300 text-sm"
              >
                ← Back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
