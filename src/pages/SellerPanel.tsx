import { Layout } from '@/components/layout/Layout';
import { SellerDashboard } from '@/components/dashboard/SellerDashboard';

export default function SellerPanel() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Meu Painel</h1>
          <p className="text-muted-foreground mt-1 text-sm lg:text-base">
            Acompanhe suas vendas, comissões e atividades
          </p>
        </div>

        <SellerDashboard />
      </div>
    </Layout>
  );
}
