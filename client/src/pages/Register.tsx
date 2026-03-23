import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

// This page now redirects to /auth which has the full email/password registration form
export default function Register() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/train");
    } else if (!loading && !user) {
      setLocation("/auth");
    }
  }, [user, loading, setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-slate-400">Loading...</div>
    </div>
  );
}
