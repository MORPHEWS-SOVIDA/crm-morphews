import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import Dashboard from "./Dashboard";
import Planos from "./Planos";

export default function SecretariaWhatsapp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is logged in, show dashboard directly
  if (user) {
    return <Dashboard />;
  }

  // If not logged in, show old Planos landing page
  return <Planos />;
}
