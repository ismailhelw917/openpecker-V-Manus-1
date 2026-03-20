import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";

/**
 * Auth page - redirects to Manus OAuth login
 * This app uses OAuth exclusively (no email/password auth)
 */
export default function Auth() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/");
    }
  }, [isAuthenticated, loading, setLocation]);

  useEffect(() => {
    // Auto-redirect to OAuth login
    if (!loading && !isAuthenticated) {
      window.location.href = getLoginUrl();
    }
  }, [loading, isAuthenticated]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center p-4 pb-24">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-teal-900/40 to-slate-900/40 rounded-lg p-2 backdrop-blur-sm border-2 border-amber-400/70 shadow-lg shadow-amber-400/20">
          <img
            src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-logo-UbbhKD7VjajRRYYwpnAd2y.webp"
            alt="OpenPecker Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-3xl font-bold text-teal-500 mb-2">OpenPecker</h1>
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
