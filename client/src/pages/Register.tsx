import { useState } from "react";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { Mail, ArrowLeft } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");

  // If already logged in, redirect to /train
  if (user) {
    setLocation("/train");
    return null;
  }

  // Show loading while auth is being checked
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  const loginUrl = getLoginUrl("/train");

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Redirect to OAuth portal - the email will be pre-filled on the Manus auth page
    // The OAuth portal supports email-based registration
    window.location.href = loginUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Back button */}
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition mb-8 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-slate-400 text-sm">
              Join OpenPecker and start mastering chess openings
            </p>
          </div>

          {/* Google Sign Up */}
          <a
            href={loginUrl}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-lg transition mb-4"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </a>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-700"></div>
            <span className="text-slate-500 text-xs uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-slate-700"></div>
          </div>

          {/* Email Sign Up */}
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg transition"
            >
              <Mail className="w-4 h-4" />
              Continue with Email
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs mt-6">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>

          {/* Already have account */}
          <p className="text-center text-slate-400 text-sm mt-4">
            Already have an account?{" "}
            <a
              href={getLoginUrl("/train")}
              className="text-teal-400 hover:text-teal-300 font-medium"
            >
              Sign In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
