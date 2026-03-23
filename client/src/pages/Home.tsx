import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [premiumNotified, setPremiumNotified] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user && !premiumNotified && user.isPremium) {
      toast.success("Welcome! You've been granted FREE lifetime premium!", {
        duration: 5000,
      });
      setPremiumNotified(true);
    }
  }, [isAuthenticated, user, premiumNotified]);

  if (loading) {
    return (
      <div className="h-[calc(100dvh-5rem)] bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-5rem)] overflow-hidden bg-white flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-5 flex justify-center">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/openpecker-new-logo_6f9fcd4c.jpg"
          alt="OpenPecker Logo"
          className="w-56 sm:w-72 object-contain rounded-xl shadow-lg"
        />
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black text-teal-700 mb-2 text-center">
        OpenPecker
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-slate-600 mb-7 text-center max-w-xs">
        Master opening tactics through deliberate repetition.
      </p>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <Button
          onClick={() => setLocation("/train")}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg py-6 rounded-lg"
          style={{ touchAction: "manipulation" }}
        >
          START TRAINING &rarr;
        </Button>

        {isAuthenticated ? (
          <p className="text-center text-slate-600 text-sm">
            Welcome,{" "}
            <span className="text-teal-600 font-semibold">
              {user?.name || user?.email}
            </span>
          </p>
        ) : (
          <>
            <a
              href={getLoginUrl("/train")}
              className="w-full bg-white hover:bg-gray-50 text-slate-900 border-2 border-slate-300 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{ touchAction: "manipulation", textDecoration: "none" }}
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Register with Google
            </a>
            <a
              href="/register"
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-900 border-2 border-slate-300 font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{ touchAction: "manipulation", textDecoration: "none" }}
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              Register with Email
            </a>
          </>
        )}
      </div>
    </div>
  );
}
