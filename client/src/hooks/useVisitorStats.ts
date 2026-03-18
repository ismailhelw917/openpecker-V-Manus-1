/**
 * Hook to fetch visitor statistics from the server
 */

import { useState, useEffect, useCallback } from "react";

interface VisitorStats {
  totalVisitors: number;
  todayVisitors: number;
  totalPageViews: number;
  todayPageViews: number;
  recentVisitors: number;
}

const DEFAULT_STATS: VisitorStats = {
  totalVisitors: 0,
  todayVisitors: 0,
  totalPageViews: 0,
  todayPageViews: 0,
  recentVisitors: 0,
};

export function useVisitorStats(refreshIntervalMs = 60_000) {
  const [stats, setStats] = useState<VisitorStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/visitor-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStats, refreshIntervalMs]);

  return { stats, loading, refetch: fetchStats };
}
