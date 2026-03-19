import { useEffect, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';

/**
 * Hook to track user session and send heartbeats
 * Automatically tracks when user is on the page and sends heartbeats every 30 seconds
 */
export function useSessionTracking() {
  const { user } = useAuth();
  const sessionIdRef = useRef<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const trackMutation = trpc.session.track.useMutation();
  const heartbeatMutation = trpc.session.heartbeat.useMutation();
  const endSessionMutation = trpc.session.end.useMutation();

  useEffect(() => {
    // Only track if user exists
    if (!user?.id) return;

    // Initialize session tracking
    const initializeSession = async () => {
      try {
        const result = await trackMutation.mutateAsync({
          playerId: user.id,
          userId: user.id,
          deviceId: null,
        });

        if (result && typeof result === 'object' && 'id' in result) {
          sessionIdRef.current = (result as any).id;
        }
      } catch (error) {
        console.error('Failed to initialize session tracking:', error);
      }
    };

    initializeSession();

    // Set up heartbeat interval
    const startHeartbeat = () => {
      heartbeatIntervalRef.current = setInterval(async () => {
        if (sessionIdRef.current) {
          try {
            await heartbeatMutation.mutateAsync({
              playerId: user.id,
            });
          } catch (error) {
            console.error('Failed to send heartbeat:', error);
          }
        }
      }, 30000); // Send heartbeat every 30 seconds
    };

    startHeartbeat();

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, stop heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
      } else {
        // Page is visible again, restart heartbeat
        startHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // End session when component unmounts
      if (sessionIdRef.current) {
        try {
          endSessionMutation.mutate({
            playerId: user.id,
          });
        } catch (error) {
          console.error('Failed to end session:', error);
        }
      }
    };
  }, [user?.id, trackMutation, heartbeatMutation, endSessionMutation]);

  return {
    sessionId: sessionIdRef.current,
    isTracking: !!sessionIdRef.current,
  };
}
