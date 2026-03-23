import { useState, useEffect } from "react";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed (running in standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Don't show if dismissed in this session
    const wasDismissed = sessionStorage.getItem("pwa-install-dismissed");
    if (wasDismissed) return;

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    if (ios) {
      // iOS doesn't support beforeinstallprompt — show manual instructions after a delay
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android / Chrome: listen for the native install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
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
      {/* Install Banner */}
      <div className="fixed bottom-20 left-3 right-3 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-slate-900 border border-teal-500/40 rounded-2xl shadow-2xl shadow-teal-900/40 p-4 flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl overflow-hidden">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663447100726/EorxrxCPNFVtGo7gjBVrJr/icon-192x192_e08cd5dd.png"
              alt="OpenPecker"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-semibold leading-tight">Install OpenPecker</p>
            <p className="text-slate-400 text-xs mt-0.5 leading-tight">
              {isIOS ? "Add to Home Screen for the best experience" : "Install the app for faster access"}
            </p>
          </div>
          <button
            onClick={handleInstall}
            className="flex-shrink-0 flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors p-1"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Step-by-step Instructions Modal */}
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
                <h3 className="text-white font-bold text-base">Add to Home Screen</h3>
              </div>
              <button onClick={() => setShowIOSInstructions(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <p className="text-slate-300 text-sm">
                  Tap the <strong className="text-white">Share</strong> button{" "}
                  <span className="inline-block bg-slate-700 rounded px-1.5 py-0.5 text-xs font-mono">⎙</span>{" "}
                  at the bottom of Safari
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <p className="text-slate-300 text-sm">
                  Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong>
                </p>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <p className="text-slate-300 text-sm">
                  Tap <strong className="text-white">"Add"</strong> in the top right corner
                </p>
              </li>
            </ol>
            <p className="text-slate-500 text-xs mt-4 text-center">OpenPecker will appear on your home screen like a native app</p>
          </div>
        </div>
      )}
    </>
  );
}
