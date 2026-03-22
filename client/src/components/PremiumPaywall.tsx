import { Button } from "@/components/ui/button";
import { X, Check } from "lucide-react";

interface PremiumPaywallProps {
  onClose: () => void;
  onMonthlyClick: () => void;
  onLifetimeClick: () => void;
  isLoading?: boolean;
}

export function PremiumPaywall({
  onClose,
  onMonthlyClick,
  onLifetimeClick,
  isLoading = false,
}: PremiumPaywallProps) {
  const features = [
    "Unlock all 150+ opening variations",
    "Advanced performance analytics",
    "Unlimited training cycles",
    "Priority puzzle loading",
    "Support independent development",
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-b from-amber-900 to-slate-900 rounded-2xl max-w-md w-full relative border border-amber-700">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-white hover:text-amber-400 transition-colors"
        >
          <X size={32} />
        </button>

        {/* Header */}
        <div className="text-center pt-8 pb-6">
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 bg-slate-800 rounded-lg border-2 border-amber-500 flex items-center justify-center">
              <div className="text-center">
                <div className="text-amber-500 text-2xl font-bold">♟</div>
                <div className="text-amber-500 text-xs font-bold">OpenPecker</div>
                <div className="text-amber-500 text-xs">Premium</div>
              </div>
            </div>
          </div>
          <h2 className="text-4xl font-bold text-amber-50">OpenPecker Premium</h2>
        </div>

        {/* Features */}
        <div className="px-6 py-6 border-y border-amber-700/50">
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-start gap-3">
                <Check className="w-6 h-6 text-teal-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-100 text-lg">{feature}</span>
              </div>
            ))}
          </div>
        </div>



        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-amber-200 text-sm">
            Secure payments powered by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
