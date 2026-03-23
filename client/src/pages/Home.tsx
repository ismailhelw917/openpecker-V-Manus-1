import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const [premiumNotified, setPremiumNotified] = useState(false);
  const { language, setLanguage, t } = useLanguage();

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
          <p className="text-slate-600">{t.general.loading}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100dvh-5rem)] overflow-hidden bg-white flex flex-col items-center justify-center px-4">
      {/* Language selector — top right */}
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-slate-100 rounded-full px-1 py-1 shadow-sm border border-slate-200">
        <button
          onClick={() => setLanguage('en')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
            language === 'en'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-600 hover:text-teal-600'
          }`}
        >
          EN
        </button>
        <button
          onClick={() => setLanguage('hi')}
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${
            language === 'hi'
              ? 'bg-teal-600 text-white shadow'
              : 'text-slate-600 hover:text-teal-600'
          }`}
        >
          हिं
        </button>
      </div>

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
        {t.appTagline}
      </p>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <Button
          onClick={() => setLocation("/train")}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-lg py-6 rounded-lg"
          style={{ touchAction: "manipulation" }}
        >
          {t.home.startTraining}
        </Button>

        {isAuthenticated ? (
          <p className="text-center text-slate-600 text-sm">
            {t.home.welcome}{" "}
            <span className="text-teal-600 font-semibold">
              {user?.name || user?.email}
            </span>
          </p>
        ) : (
          <>
            <a
              href="/auth"
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{ touchAction: "manipulation", textDecoration: "none" }}
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              {language === 'hi' ? 'साइन इन / रजिस्टर करें' : 'Sign In / Register'}
            </a>
          </>
        )}
      </div>
    </div>
  );
}
