import { useEffect, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Hook to send heartbeat to server every 30 seconds
 * Tracks active user sessions with real names from Google Sign-In
 */
export function useHeartbeat() {
  const { user } = useAuth();
  const sessionIdRef = useRef<string>(
    sessionStorage.getItem("sessionId") ||
    (() => {
      const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("sessionId", newId);
      return newId;
    })()
  );

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const name = user?.name || "Guest Player";
        const email = user?.email || null;
        const isGuest = !user;
        const currentPath = window.location.pathname;
        const deviceId = localStorage.getItem("deviceId") || `device-${Date.now()}`;

        if (!localStorage.getItem("deviceId")) {
          localStorage.setItem("deviceId", deviceId);
        }

        await fetch("/api/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            name,
            email,
            isGuest,
            currentPath,
            deviceId,
          }),
        });
      } catch (error) {
        console.debug("[Heartbeat] Failed to send", error);
      }
    };

    // Send heartbeat immediately
    sendHeartbeat();

    // Then send every 30 seconds
    const interval = setInterval(sendHeartbeat, 30000);

    return () => clearInterval(interval);
  }, [user]);
}

/**
 * Hook to get currently active sessions
 */
export async function getActiveSessions(): Promise<any[]> {
  try {
    const response = await fetch("/api/heartbeat/active");
    const data = await response.json();
    return data.sessions || [];
  } catch (error) {
    console.error("[Active Sessions] Failed to fetch", error);
    return [];
  }
}
