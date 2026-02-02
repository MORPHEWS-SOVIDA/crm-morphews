import { WhiteAdminLayout } from '@/components/white-admin/WhiteAdminLayout';
import { WhiteAdminDashboard } from '@/components/white-admin/WhiteAdminDashboard';
import { WhiteAdminOrganizations } from '@/components/white-admin/WhiteAdminOrganizations';
import { WhiteAdminPlans } from '@/components/white-admin/WhiteAdminPlans';
import { WhiteAdminBranding } from '@/components/white-admin/WhiteAdminBranding';
import { WhiteAdminSettings } from '@/components/white-admin/WhiteAdminSettings';
import { Routes, Route } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Wallet } from 'lucide-react';

// Placeholder for Users page
function WhiteAdminUsers() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-muted-foreground">Gerencie os usuários das organizações</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="text-muted-foreground">
            Esta funcionalidade será implementada em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Placeholder for Financial page
function WhiteAdminFinancial() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-muted-foreground">Acompanhe suas comissões e receitas</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="text-muted-foreground">
            Relatórios financeiros serão disponibilizados em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function WhiteAdminPage() {
  return (
    <WhiteAdminLayout>
      <Routes>
        <Route index element={<WhiteAdminDashboard />} />
        <Route path="organizacoes" element={<WhiteAdminOrganizations />} />
        <Route path="usuarios" element={<WhiteAdminUsers />} />
        <Route path="planos" element={<WhiteAdminPlans />} />
        <Route path="branding" element={<WhiteAdminBranding />} />
        <Route path="financeiro" element={<WhiteAdminFinancial />} />
        <Route path="configuracoes" element={<WhiteAdminSettings />} />
      </Routes>
    </WhiteAdminLayout>
  );
}
