import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";

const BIRD_ICON_192 =
  "https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/bird-icon-192x192_8d535281.png";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallPromptProps {
  /** When true the banner becomes eligible to show (e.g. user visited Rank/Stats) */
  triggered?: boolean;
}

export function PWAInstallPrompt({ triggered = false }: PWAInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Track whether the native install event has fired
  const [nativeReady, setNativeReady] = useState(false);

  // Capture the native beforeinstallprompt event early (before trigger)
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;
    if (sessionStorage.getItem("pwa-install-dismissed")) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);
    if (ios) setNativeReady(true); // iOS is always "ready" (manual flow)

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setNativeReady(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Show banner when the page trigger fires AND we have a prompt ready
  useEffect(() => {
    if (!triggered) return;
    if (dismissed) return;
    if (sessionStorage.getItem("pwa-install-dismissed")) return;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;
    if (nativeReady) {
      // Small delay so the page content renders first
      const t = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(t);
    }
  }, [triggered, nativeReady, dismissed]);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    sessionStorage.setItem("pwa-install-dismissed", "1");
  };

  if (!showBanner || dismissed) return null;

  return (
    <>
      {/* ── Install Banner ── */}
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900 border border-teal-500/40 rounded-xl shadow-2xl shadow-teal-900/40 px-3 py-2.5 flex items-center gap-2">
          {/* Icon — small so text has room */}
          <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden border border-slate-700">
            <img
              src={BIRD_ICON_192}
              alt="OpenPecker"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Text block — grows, clips gracefully */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold leading-tight">
              Install OpenPecker
            </p>
            <p className="text-slate-400 text-[11px] leading-tight mt-0.5">
              {isIOS
                ? "Add to Home Screen for the best experience"
                : "Install for faster access & offline use"}
            </p>
          </div>

          {/* Install button — fixed width */}
          <button
            onClick={handleInstall}
            className="flex-shrink-0 flex items-center gap-1 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Download className="w-3 h-3" />
            Install
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── iOS Step-by-step Modal ── */}
      {showIOSInstructions && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end justify-center p-4"
          onClick={() => setShowIOSInstructions(false)}
        >
          <div
            className="bg-slate-900 border border-teal-500/30 rounded-2xl p-6 w-full max-w-sm mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-teal-400" />
                <h3 className="text-white font-bold text-base">
                  Add to Home Screen
                </h3>
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3">
              {[
                <>
                  Tap the <strong className="text-white">Share</strong> button{" "}
                  <span className="inline-block bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono">
                    ⎙
                  </span>{" "}
                  at the bottom of Safari
                </>,
                <>
                  Scroll down and tap{" "}
                  <strong className="text-white">"Add to Home Screen"</strong>
                </>,
                <>
                  Tap <strong className="text-white">"Add"</strong> in the top
                  right corner
                </>,
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-slate-300 text-sm">{step}</p>
                </li>
              ))}
            </ol>
            <p className="text-slate-500 text-xs mt-4 text-center">
              OpenPecker will appear on your home screen like a native app
            </p>
          </div>
        </div>
      )}
    </>
  );
}
