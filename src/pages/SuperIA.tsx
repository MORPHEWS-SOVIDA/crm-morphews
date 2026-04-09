import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Zap, Settings, BarChart3, List } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SuperIADashboard } from "@/components/super-ia/SuperIADashboard";
import { SuperIAQueue } from "@/components/super-ia/SuperIAQueue";
import { SuperIAConfig } from "@/components/super-ia/SuperIAConfig";

export default function SuperIA() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id || "";

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            Super IA — Vendedor Autônomo
          </h1>
          <p className="text-muted-foreground">
            Agente inteligente que vende, faz follow-up e fecha negócios automaticamente
          </p>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <List className="h-4 w-4" />
              Fila de Follow-ups
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <SuperIADashboard organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="queue">
            <SuperIAQueue organizationId={organizationId} />
          </TabsContent>

          <TabsContent value="config">
            <SuperIAConfig organizationId={organizationId} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
