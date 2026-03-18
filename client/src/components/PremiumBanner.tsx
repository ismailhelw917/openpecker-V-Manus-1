import { X, Zap } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

interface PremiumBannerProps {
  onDismiss?: () => void;
}

export function PremiumBanner({ onDismiss }: PremiumBannerProps) {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Only show banner for unregistered/unauthenticated users
  if (user || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/10 to-amber-500/20 border-b border-amber-400/30 px-4 py-3 md:py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <Zap className="w-5 h-5 md:w-6 md:h-6 text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm md:text-base font-semibold text-amber-100">
              🎁 <span className="hidden sm:inline">Get </span>Free Premium on Registration
            </p>
            <p className="text-xs md:text-sm text-amber-200/80 mt-1">
              Unlock all 5.8M puzzles, advanced analytics, and unlimited training cycles
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-1 hover:bg-amber-400/20 rounded-lg transition-colors"
          aria-label="Dismiss banner"
        >
          <X className="w-5 h-5 text-amber-400" />
        </button>
      </div>
    </div>
  );
}
