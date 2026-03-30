/**
 * Google Ads Conversion Tracking Hook
 * Provides functions to track conversions in Google Ads
 */

export function useGoogleAdsTracking() {
  /**
   * Track a conversion event
   */
  const trackConversion = (eventName: string, value?: number) => {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-18019264911/v91sCN7S3JAcEI_ToJBD',
        'value': value || 0,
        'currency': 'USD',
        'transaction_id': `transaction_${Date.now()}`,
      });
      console.log('[Google Ads] Conversion tracked:', eventName);
    }
  };

  /**
   * Track session start
   */
  const trackSessionStart = (openingName: string) => {
    trackConversion('session_start', 1);
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'training_session_start', {
        'opening': openingName,
      });
    }
  };

  /**
   * Track session completion
   */
  const trackSessionComplete = (openingName: string, accuracy: number) => {
    trackConversion('session_complete', accuracy);
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'training_session_complete', {
        'opening': openingName,
        'accuracy': accuracy,
      });
    }
  };

  /**
   * Track training milestone (e.g., 100 puzzles solved)
   */
  const trackMilestone = (milestone: string) => {
    trackConversion('training_milestone', 1);
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'training_milestone', {
        'milestone': milestone,
      });
    }
  };

  return {
    trackConversion,
    trackSessionStart,
    trackSessionComplete,
    trackMilestone,
  };
}
