import { Layout } from '@/components/layout/Layout';
import { TeamManagerDashboard } from '@/components/dashboard/TeamManagerDashboard';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Crown } from 'lucide-react';

export default function TeamPanel() {
  const { data: currentMember, isLoading } = useCurrentMember();

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </Layout>
    );
  }

  // Se o usuário não é gerente de vendas, mostrar mensagem
  if (!currentMember?.is_sales_manager) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Painel da Equipe</h1>
            <p className="text-muted-foreground mt-1 text-sm lg:text-base">
              Acompanhe as métricas e atividades da sua equipe
            </p>
          </div>
          
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Crown className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Acesso restrito a gerentes</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Este painel é exclusivo para gerentes de vendas. Para ter acesso, 
                solicite ao administrador que configure seu perfil como "Gerente de Vendas" 
                e associe vendedores à sua equipe.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Painel da Equipe</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            Acompanhe as métricas e atividades dos vendedores associados a você
          </p>
        </div>

        <TeamManagerDashboard />
      </div>
    </Layout>
  );
}
