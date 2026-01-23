import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Navigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import Planos from "./Planos";

export default function Home() {
  const { user, profile, isLoading } = useAuth();

  const onboardingBypassKey = useMemo(() => {
    return user?.id ? `onboarding_bypass:${user.id}` : null;
  }, [user?.id]);

  const onboardingBypass = useMemo(() => {
    if (!onboardingBypassKey) return false;
    return localStorage.getItem(onboardingBypassKey) === "1";
  }, [onboardingBypassKey]);

  // Check if user is organization owner (only owners see onboarding)
  const { data: isOwner, isLoading: isOwnerLoading } = useQuery({
    queryKey: ["is-org-owner", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_current_user_org_owner");
      if (error) {
        console.error("Error checking owner status:", error);
        return false;
      }
      return data ?? false;
    },
    enabled: !!user && !!profile?.organization_id,
  });

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
    // Only check onboarding if user is owner
    enabled: !!user && !!profile?.organization_id && isOwner === true,
  });

  // Cleanup: if onboarding is completed, remove any temporary bypass flag
  useEffect(() => {
    if (!onboardingBypassKey) return;
    if (onboardingCompleted === true) {
      localStorage.removeItem(onboardingBypassKey);
    }
  }, [onboardingBypassKey, onboardingCompleted]);

  const stillLoading = isLoading || 
    (user && profile?.organization_id && isOwnerLoading) ||
    (user && profile?.organization_id && isOwner === true && onboardingLoading);

  if (stillLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in
  if (user) {
    // Only show onboarding to OWNERS when onboarding is not completed
    if (isOwner && profile?.organization_id && onboardingCompleted === false && !onboardingBypass) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Dashboard />;
  }

  // If not logged in, show landing page
  return <Planos />;
}
