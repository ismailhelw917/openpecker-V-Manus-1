import { useEffect, useRef } from 'react';

interface RecaptchaWidgetProps {
  onTokenReceived: (token: string) => void;
  onError?: (error: string) => void;
}

export function RecaptchaWidget({ onTokenReceived, onError }: RecaptchaWidgetProps) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    // Load reCAPTCHA script
    if (scriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      scriptLoaded.current = true;
    };
    
    script.onerror = () => {
      onError?.('Failed to load reCAPTCHA');
    };

    document.head.appendChild(script);
  }, [onError]);

  useEffect(() => {
    // Execute reCAPTCHA v3
    const executeRecaptcha = async () => {
      if (typeof window !== 'undefined' && (window as any).grecaptcha) {
        try {
          const token = await (window as any).grecaptcha.execute(
            import.meta.env.VITE_RECAPTCHA_SITE_KEY,
            { action: 'checkout' }
          );
          onTokenReceived(token);
        } catch (error) {
          onError?.('reCAPTCHA execution failed');
        }
      }
    };

    const timer = setTimeout(executeRecaptcha, 500);
    return () => clearTimeout(timer);
  }, [onTokenReceived, onError]);

  return null; // reCAPTCHA v3 is invisible
}
