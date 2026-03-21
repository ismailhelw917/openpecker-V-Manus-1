/**
 * reCAPTCHA v3 verification helper
 * Verifies reCAPTCHA tokens and detects suspicious activity
 */

interface RecaptchaResponse {
  success: boolean;
  score: number;
  action: string;
  challenge_ts: string;
  hostname: string;
  error_codes?: string[];
}

interface SuspiciousActivityFlags {
  perfectAccuracy: boolean;
  instantMoves: boolean;
  inhuman: boolean;
  lowScore: boolean;
}

/**
 * Verify reCAPTCHA token with Google's API
 */
export async function verifyRecaptchaToken(token: string): Promise<RecaptchaResponse> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  
  if (!secretKey) {
    throw new Error('RECAPTCHA_SECRET_KEY not configured');
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    if (!response.ok) {
      throw new Error(`reCAPTCHA API error: ${response.status}`);
    }

    const data = await response.json() as RecaptchaResponse;
    return data;
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    throw error;
  }
}

/**
 * Detect suspicious activity based on user behavior and reCAPTCHA score
 */
export function detectSuspiciousActivity(
  recaptchaScore: number,
  userStats: {
    accuracy?: number;
    avgTimePerMove?: number;
    totalAttempts?: number;
  }
): SuspiciousActivityFlags {
  const flags: SuspiciousActivityFlags = {
    perfectAccuracy: false,
    instantMoves: false,
    inhuman: false,
    lowScore: false,
  };

  // Flag 1: Perfect accuracy (100%) on many attempts
  if (userStats.accuracy === 100 && (userStats.totalAttempts || 0) > 5) {
    flags.perfectAccuracy = true;
    flags.inhuman = true;
  }

  // Flag 2: Instant moves (< 100ms average)
  if ((userStats.avgTimePerMove || 0) < 100) {
    flags.instantMoves = true;
    flags.inhuman = true;
  }

  // Flag 3: Low reCAPTCHA score (< 0.3 indicates suspicious)
  if (recaptchaScore < 0.3) {
    flags.lowScore = true;
    flags.inhuman = true;
  }

  return flags;
}

/**
 * Determine if user needs CAPTCHA challenge based on suspicious activity
 */
export function shouldRequireCaptchaChallenge(
  recaptchaScore: number,
  suspiciousFlags: SuspiciousActivityFlags
): boolean {
  // Require CAPTCHA if:
  // 1. reCAPTCHA score is very low (< 0.2)
  // 2. Multiple suspicious activity flags detected
  // 3. Inhuman behavior detected

  if (recaptchaScore < 0.2) {
    return true;
  }

  const flagCount = Object.values(suspiciousFlags).filter(Boolean).length;
  if (flagCount >= 2) {
    return true;
  }

  if (suspiciousFlags.inhuman) {
    return true;
  }

  return false;
}

/**
 * Log suspicious activity for monitoring
 */
export async function logSuspiciousActivity(
  userId: string | null,
  deviceId: string | null,
  recaptchaScore: number,
  suspiciousFlags: SuspiciousActivityFlags,
  action: string
): Promise<void> {
  const logEntry = {
    timestamp: new Date().toISOString(),
    userId,
    deviceId,
    recaptchaScore,
    suspiciousFlags,
    action,
  };

  console.warn('[SUSPICIOUS_ACTIVITY]', JSON.stringify(logEntry));
  
  // TODO: Send to analytics/monitoring service
  // await sendToMonitoring(logEntry);
}
