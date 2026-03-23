import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Hook to send heartbeat to server every 30 seconds.
 * Uses user_heartbeats table with 45s expiry window.
 * Tracks both authenticated users (by userId) and guests (by deviceId).
 */
export function useHeartbeat() {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) {
          deviceId = typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem("deviceId", deviceId);
        }

        await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user?.id || null,
            deviceId,
            name: user?.name || `Guest-${deviceId.substring(0, 8)}`,
          }),
        });
      } catch (error) {
        // Silent fail — heartbeat is non-critical
      }
    };

    sendHeartbeat();
    intervalRef.current = setInterval(sendHeartbeat, 30_000);

    const handleVisibility = () => {
      if (document.hidden) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      } else {
        sendHeartbeat();
        intervalRef.current = setInterval(sendHeartbeat, 30_000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.id, user?.name]);
}

/**
 * Get current online user count.
 */
export async function getOnlineCount(): Promise<number> {
  try {
    const response = await fetch("/api/heartbeat/active");
    const data = await response.json();
    return data.onlineCount || 0;
  } catch (error) {
    console.error("[Online Count] Failed to fetch", error);
    return 0;
  }
}
