import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'openpecker_cookie_consent';

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!hasConsented) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setIsVisible(false);
  };

  const handleReject = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 shadow-lg z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-slate-300 mb-2">
            <strong>Cookie Notice:</strong> We use cookies to track your activity and improve your experience.
            We collect data about pages visited, puzzles solved, and time spent on the site.
          </p>
          <p className="text-xs text-slate-400">
            Your data is used for analytics and product improvement. We do not share personal data with third parties.
            <a href="/privacy" className="text-blue-400 hover:text-blue-300 ml-1">
              Learn more
            </a>
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReject}
            className="text-xs"
          >
            Reject
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            className="text-xs bg-blue-600 hover:bg-blue-700"
          >
            Accept
          </Button>
          <button
            onClick={() => setIsVisible(false)}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
