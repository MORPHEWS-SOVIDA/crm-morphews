import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Planos from "./Planos";

export default function Home() {
  const { user, profile, isLoading } = useAuth();

  // Check if onboarding is completed using RPC (bypasses RLS issues)
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-check-rpc", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_onboarding_completed");

      if (error) {
        console.error("Error checking onboarding via RPC:", error);
        // On error, assume completed to not block user
        return true;
      }
      return data ?? false;
    },
    enabled: !!user && !!profile?.organization_id,
  });

  if (isLoading || (user && profile?.organization_id && onboardingLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in
  if (user) {
    // Check if onboarding is needed (user has org but onboarding not completed)
    if (profile?.organization_id && onboardingCompleted === false) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Dashboard />;
  }

  // If not logged in, show landing page
  return <Planos />;
}
