import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Dashboard from "./Dashboard";
import SalesLanding from "./SalesLanding";

export default function Home() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in, show dashboard directly - NO onboarding redirect
  if (user) {
    return <Dashboard />;
  }

  // If not logged in, show Sales landing page (main landing)
  return <SalesLanding />;
}
