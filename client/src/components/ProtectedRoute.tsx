import { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useEffect } from "react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: "admin" | "user";
}

/**
 * ProtectedRoute component that redirects unauthenticated users to login
 * Optionally requires a specific user role
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // If not loading and not authenticated, redirect to login with return path
    if (!loading && !isAuthenticated) {
      console.log('[ProtectedRoute] Unauthenticated user, redirecting to login');
      // Pass current pathname as returnPath so user returns here after login
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      window.location.href = getLoginUrl(currentPath);
      return;
    }

    // If role is required and user doesn't have it, redirect to home
    if (!loading && isAuthenticated && user && requiredRole) {
      if (user.role !== requiredRole && user.role !== 'admin') {
        console.log(`[ProtectedRoute] User role ${user.role} does not match required role ${requiredRole}`);
        setLocation('/');
      }
    }
  }, [loading, isAuthenticated, user, requiredRole, setLocation]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-teal-950 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!isAuthenticated) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
