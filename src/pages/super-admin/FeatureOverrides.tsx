import { Layout } from "@/components/layout/Layout";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { OrgFeatureOverridesEditor } from "@/components/super-admin/OrgFeatureOverridesEditor";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

export default function FeatureOverrides() {
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
            <h1 className="text-2xl font-bold">Override de Features</h1>
            <p className="text-muted-foreground">
              Sobrescreva features específicas por organização
            </p>
          </div>
        </div>

        <OrgFeatureOverridesEditor />
      </div>
    </Layout>
  );
}
