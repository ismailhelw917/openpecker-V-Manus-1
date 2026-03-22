declare module 'matomo-tracker' {
  interface MatomoTrackerOptions {
    trackerUrl: string;
    siteId: number;
    userId?: string;
  }

  interface PageViewOptions {
    documentTitle?: string;
    href?: string;
  }

  interface EventOptions {
    category: string;
    action: string;
    name?: string;
    value?: number;
  }

  class MatomoTracker {
    constructor(options: MatomoTrackerOptions);
    setUserId(userId: string): void;
    trackPageView(options: PageViewOptions): void;
    trackEvent(options: EventOptions): void;
  }

  export default MatomoTracker;
}
