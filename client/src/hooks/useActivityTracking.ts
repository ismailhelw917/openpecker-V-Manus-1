import { useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  initializeActivityTracking,
  trackPageView,
  trackPuzzleSessionStart,
  trackPuzzleComplete,
  trackClick,
  trackScroll,
  updateActivityTimestamp,
  getSessionSummary,
} from '@/lib/cookieTracking';

/**
 * Hook for integrating activity tracking throughout the app
 */
export function useActivityTracking() {
  const [location] = useLocation();

  // Initialize tracking on mount
  useEffect(() => {
    initializeActivityTracking();
  }, []);

  // Track page views
  useEffect(() => {
    trackPageView(location);
  }, [location]);

  // Track user activity (clicks, scrolls, etc.)
  useEffect(() => {
    const handleUserActivity = () => {
      updateActivityTimestamp();
    };

    // Track various user interactions
    document.addEventListener('click', handleUserActivity);
    document.addEventListener('scroll', handleUserActivity);
    document.addEventListener('keydown', handleUserActivity);
    document.addEventListener('mousemove', handleUserActivity);

    return () => {
      document.removeEventListener('click', handleUserActivity);
      document.removeEventListener('scroll', handleUserActivity);
      document.removeEventListener('keydown', handleUserActivity);
      document.removeEventListener('mousemove', handleUserActivity);
    };
  }, []);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercentage =
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
      trackScroll(Math.min(scrollPercentage, 100));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const trackPuzzleStart = useCallback((openingName: string, variation: string) => {
    trackPuzzleSessionStart(openingName, variation);
  }, []);

  const trackPuzzleSolved = useCallback((correct: boolean, timeSpent: number) => {
    trackPuzzleComplete(correct, timeSpent);
  }, []);

  const trackElementClick = useCallback((elementId: string, elementClass: string) => {
    trackClick(elementId, elementClass);
  }, []);

  const getSessionStats = useCallback(() => {
    return getSessionSummary();
  }, []);

  return {
    trackPuzzleStart,
    trackPuzzleSolved,
    trackElementClick,
    getSessionStats,
  };
}
