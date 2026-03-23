import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

/**
 * Auth page - handles user authentication
 * This app uses OAuth exclusively (no email/password auth)
 * New users are redirected to /stats with paywall modal
 * Existing users are redirected to home
 */
export default function Auth() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading, user } = useAuth();
  const [loginError, setLoginError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('loginError') === 'true' || params.get('error')) {
      setLoginError(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      // If user is new (hasRegistered = 0), redirect to stats with paywall
      if (user.hasRegistered === 0) {
        console.log('[Auth] New user detected, redirecting to paywall');
        setLocation("/stats?showPaywall=true");
      } else {
        // Existing user, go to home
        setLocation("/");
      }
    }
  }, [isAuthenticated, loading, user, setLocation]);

  useEffect(() => {
    // Auto-redirect to OAuth login only if there's no loginError
    if (!loading && !isAuthenticated && !loginError) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated, loginError]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center p-4 pb-24">
      <div className="text-center max-w-sm">
        <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-teal-900/40 to-slate-900/40 rounded-lg p-2 backdrop-blur-sm border-2 border-amber-400/70 shadow-lg shadow-amber-400/20">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
            alt="OpenPecker Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-teal-500 mb-2">OpenPecker</h1>

        {loginError ? (
          <>
            <div className="mt-4 mb-4 bg-red-900/40 border border-red-500/50 rounded-lg px-4 py-3 text-red-300 text-sm">
              Sign-in failed. This can happen if you took too long or the session expired. Please try again.
            </div>
            <a
              href={getLoginUrl()}
              className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
              style={{ touchAction: "manipulation" }}
            >
              Try Again
            </a>
          </>
        ) : (
          <>
            <p className="text-slate-400">Redirecting to login...</p>
            <div className="mt-6">
              <a
                href={getLoginUrl()}
                className="inline-block px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
                style={{ touchAction: "manipulation" }}
              >
                Login with Google
              </a>
            </div>
          </>
        )}

        <div className="mt-4">
          <button
            onClick={() => setLocation("/")}
            className="text-slate-500 hover:text-slate-300 text-sm"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
