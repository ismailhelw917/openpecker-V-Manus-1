/**
 * Page tracking hook - records page views to the server
 * Uses a lightweight browser fingerprint (not a full fingerprinting library)
 */

import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const FINGERPRINT_KEY = "openpecker-visitor-fp";

/**
 * Generate a simple browser fingerprint using available browser properties
 * This is NOT a full fingerprinting solution, but good enough for visitor counting
 */
function generateFingerprint(): string {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    (navigator as any).deviceMemory || 0,
  ];
  
  // Simple hash function
  const str = components.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Add a random component stored in localStorage for uniqueness
  let storedRandom = "";
  try {
    storedRandom = localStorage.getItem(FINGERPRINT_KEY) || "";
    if (!storedRandom) {
      storedRandom = Math.random().toString(36).substring(2, 10);
      localStorage.setItem(FINGERPRINT_KEY, storedRandom);
    }
  } catch {
    storedRandom = Math.random().toString(36).substring(2, 10);
  }
  
  return Math.abs(hash).toString(36) + storedRandom;
}

let cachedFingerprint: string | null = null;

function getFingerprint(): string {
  if (!cachedFingerprint) {
    cachedFingerprint = generateFingerprint();
  }
  return cachedFingerprint;
}

/**
 * Track a page view - fire and forget
 */
function trackPageView(page: string) {
  try {
    const fingerprint = getFingerprint();
    const payload = {
      fingerprint,
      page,
      referrer: document.referrer || undefined,
      screenSize: `${screen.width}x${screen.height}`,
      language: navigator.language,
    };

    // Use sendBeacon for reliability, fallback to fetch
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {}); // Silently fail
    }
  } catch {
    // Never break the app for tracking
  }
}

/**
 * Hook to automatically track page views on navigation
 */
export function usePageTracking() {
  const [location] = useLocation();
  const lastTrackedPage = useRef<string>("");

  useEffect(() => {
    // Only track if the page actually changed
    if (location !== lastTrackedPage.current) {
      lastTrackedPage.current = location;
      trackPageView(location);
    }
  }, [location]);
}
