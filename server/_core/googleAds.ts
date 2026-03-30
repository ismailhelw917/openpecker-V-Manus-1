/**
 * Google Ads Conversion Tracking
 * Handles server-side conversion event tracking for Google Ads
 */

export const GOOGLE_ADS_CONVERSION_ID = 'AW-18019264911';
export const GOOGLE_ADS_CONVERSION_LABEL = 'v91sCN7S3JAcEI_ToJBD';

/**
 * Track a conversion event on the server side
 * This helps ensure conversion tracking even if client-side tracking fails
 */
export async function trackConversion(
  eventType: 'session_start' | 'session_complete' | 'training_milestone',
  userId: string,
  metadata?: Record<string, any>
) {
  try {
    // Log conversion event for analytics
    console.log(`[Google Ads] Conversion tracked: ${eventType} for user ${userId}`, metadata);
    
    // In production, you could send this to Google Ads via their Conversion API
    // For now, we log it and rely on client-side gtag tracking
    return {
      success: true,
      event: eventType,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Google Ads] Error tracking conversion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate conversion tracking code for client-side implementation
 */
export function getConversionTrackingCode() {
  return `
    <script>
      function trackConversion(eventName, value) {
        gtag('event', 'conversion', {
          'send_to': '${GOOGLE_ADS_CONVERSION_ID}/${GOOGLE_ADS_CONVERSION_LABEL}',
          'value': value,
          'currency': 'USD',
          'transaction_id': 'transaction_' + Date.now()
        });
      }
    </script>
  `;
}
