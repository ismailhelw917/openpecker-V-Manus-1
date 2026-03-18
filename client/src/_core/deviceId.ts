/**
 * Device ID generation and management for anonymous user tracking
 * Generates a unique device ID on first visit and stores it in localStorage
 */

const DEVICE_ID_KEY = 'openpecker-device-id';

/**
 * Generate a unique device ID using crypto API
 */
function generateDeviceId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create a device ID for the current user
 * Returns the stored device ID or generates a new one
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'server-side-device-id';
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  
  if (!deviceId) {
    deviceId = generateDeviceId();
    try {
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    } catch (error) {
      console.warn('Failed to store device ID in localStorage:', error);
    }
  }

  return deviceId;
}

/**
 * Get the current device ID without creating one
 */
export function getDeviceId(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem(DEVICE_ID_KEY);
}

/**
 * Clear the device ID (for testing or logout)
 */
export function clearDeviceId(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(DEVICE_ID_KEY);
}
