import { LayoutSuperAdmin } from "@/components/layout/LayoutSuperAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export default function PlanEditorPage() {
  const { user, isLoading: authLoading } = useAuth();

  if (!authLoading && user?.email !== MASTER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <LayoutSuperAdmin>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/super-admin">
            <Button variant="outline" size="icon" className="rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-primary rounded-xl">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Editor de Planos</h1>
              <p className="text-muted-foreground">
                Crie e edite planos de assinatura
              </p>
            </div>
          </div>
        </div>

        <PlanEditor />
      </div>
    </LayoutSuperAdmin>
  );
}
