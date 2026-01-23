import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export default function PlanEditorPage() {
  const { user, isLoading: authLoading } = useAuth();

  if (!authLoading && user?.email !== MASTER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/super-admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Editor de Planos</h1>
            <p className="text-muted-foreground">
              Crie e edite planos de assinatura
            </p>
          </div>
        </div>

        <PlanEditor />
      </div>
    </Layout>
  );
}
