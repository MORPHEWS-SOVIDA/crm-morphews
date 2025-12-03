import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Users, CreditCard, Loader2, TrendingUp, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface Subscription {
  id: string;
  organization_id: string;
  status: string;
  plan_id: string;
  extra_users: number;
  current_period_end: string | null;
  subscription_plans: {
    name: string;
    price_cents: number;
  } | null;
}

interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: string;
}

export default function SuperAdmin() {
  const { user, isLoading: authLoading } = useAuth();

  // Only allow master admin
  if (!authLoading && user?.email !== MASTER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const { data: organizations, isLoading: orgsLoading } = useQuery({
    queryKey: ["super-admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Organization[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const { data: subscriptions, isLoading: subsLoading } = useQuery({
    queryKey: ["super-admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*, subscription_plans(name, price_cents)");

      if (error) throw error;
      return data as Subscription[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const { data: members } = useQuery({
    queryKey: ["super-admin-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*");

      if (error) throw error;
      return data as OrganizationMember[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const { data: plans } = useQuery({
    queryKey: ["super-admin-plans"],
    queryFn: async () => {
      // Fetch all plans including inactive ones for super admin
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const getSubscriptionForOrg = (orgId: string) => {
    return subscriptions?.find((s) => s.organization_id === orgId);
  };

  const getMemberCountForOrg = (orgId: string) => {
    return members?.filter((m) => m.organization_id === orgId).length || 0;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500">Ativo</Badge>;
      case "trialing":
        return <Badge variant="secondary">Trial</Badge>;
      case "past_due":
        return <Badge variant="destructive">Pagamento Pendente</Badge>;
      case "canceled":
        return <Badge variant="outline">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  };

  const totalMRR = subscriptions?.reduce((acc, sub) => {
    if (sub.status === "active" && sub.subscription_plans) {
      return acc + sub.subscription_plans.price_cents;
    }
    return acc;
  }, 0) || 0;

  const isLoading = authLoading || orgsLoading || subsLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Crown className="h-8 w-8 text-amber-500" />
          <div>
            <h1 className="text-2xl font-bold">Super Admin</h1>
            <p className="text-muted-foreground">
              Visão geral de todas as organizações e assinaturas
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Organizações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                {organizations?.length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assinaturas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-green-500" />
                {subscriptions?.filter((s) => s.status === "active").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                {members?.length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MRR (Receita Mensal)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {formatPrice(totalMRR)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Planos Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {plans?.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-4 rounded-lg border ${
                    plan.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{plan.name}</span>
                    {!plan.is_active && (
                      <Badge variant="outline" className="text-xs">
                        Oculto
                      </Badge>
                    )}
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {formatPrice(plan.price_cents)}
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {plan.max_leads ? `${plan.max_leads} leads` : "Leads ilimitados"} •{" "}
                    {plan.max_users} usuários
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Organizations Table */}
        <Card>
          <CardHeader>
            <CardTitle>Todas as Organizações</CardTitle>
          </CardHeader>
          <CardContent>
            {organizations?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma organização cadastrada ainda.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organização</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Vence em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {organizations?.map((org) => {
                    const subscription = getSubscriptionForOrg(org.id);
                    const memberCount = getMemberCountForOrg(org.id);

                    return (
                      <TableRow key={org.id}>
                        <TableCell className="font-medium">{org.name}</TableCell>
                        <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {subscription?.subscription_plans?.name || "Sem plano"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {subscription ? getStatusBadge(subscription.status) : (
                            <Badge variant="outline">-</Badge>
                          )}
                        </TableCell>
                        <TableCell>{memberCount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {subscription?.current_period_end
                            ? format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
