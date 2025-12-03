import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Users, CreditCard, Loader2, TrendingUp, Crown, Plus, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

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

interface Plan {
  id: string;
  name: string;
  price_cents: number;
  max_users: number;
  max_leads: number | null;
  is_active: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  organization_id: string | null;
}

export default function SuperAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedOrgForUser, setSelectedOrgForUser] = useState<string | null>(null);
  const [newOrg, setNewOrg] = useState({ name: "", planId: "" });
  const [userEmail, setUserEmail] = useState("");

  // Only allow master admin
  if (!authLoading && user?.email !== MASTER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const { data: organizations, isLoading: orgsLoading, refetch: refetchOrgs } = useQuery({
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

  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubs } = useQuery({
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

  const { data: members, refetch: refetchMembers } = useQuery({
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
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_cents", { ascending: true });

      if (error) throw error;
      return data as Plan[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const { data: profiles } = useQuery({
    queryKey: ["super-admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*");

      if (error) throw error;
      return data as Profile[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const createOrgMutation = useMutation({
    mutationFn: async ({ name, planId }: { name: string; planId: string }) => {
      const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ name, slug })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create subscription with the selected plan
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          organization_id: org.id,
          plan_id: planId,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
        });

      if (subError) throw subError;

      return org;
    },
    onSuccess: () => {
      toast({ title: "Organização criada com sucesso!" });
      setShowCreateOrg(false);
      setNewOrg({ name: "", planId: "" });
      refetchOrgs();
      refetchSubs();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addUserToOrgMutation = useMutation({
    mutationFn: async ({ orgId, email }: { orgId: string; email: string }) => {
      // Find user by email in profiles (we need to search by joining with auth)
      // Since we can't query auth.users directly, we'll look for a profile
      // This assumes the user exists - for now we'll show instructions
      
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .limit(100);

      if (profileError) throw profileError;

      // We need to find the user - for now let's check if we have a profile with matching data
      // In a real scenario, you'd need an edge function to look up by email
      
      toast({
        title: "Funcionalidade em desenvolvimento",
        description: "Por enquanto, peça para o usuário se cadastrar e depois associe manualmente pelo ID.",
      });
      
      return null;
    },
    onSuccess: () => {
      setShowAddUser(false);
      setUserEmail("");
      refetchMembers();
    },
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

  const influencerPlan = plans?.find(p => p.name === "Influencer");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-amber-500" />
            <div>
              <h1 className="text-2xl font-bold">Super Admin</h1>
              <p className="text-muted-foreground">
                Visão geral de todas as organizações e assinaturas
              </p>
            </div>
          </div>
          
          <Dialog open={showCreateOrg} onOpenChange={setShowCreateOrg}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Organização
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Organização</DialogTitle>
                <DialogDescription>
                  Crie uma organização e atribua um plano (ex: Influencer para parceiros)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Nome da Organização</Label>
                  <Input
                    id="org-name"
                    placeholder="Ex: Empresa do João"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <Select
                    value={newOrg.planId}
                    onValueChange={(value) => setNewOrg({ ...newOrg, planId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans?.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          <span className="flex items-center gap-2">
                            {plan.name}
                            <span className="text-muted-foreground">
                              ({formatPrice(plan.price_cents)}/mês)
                            </span>
                            {!plan.is_active && (
                              <Badge variant="outline" className="text-xs ml-2">Oculto</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {influencerPlan && (
                    <p className="text-sm text-muted-foreground">
                      💡 Use o plano <strong>Influencer</strong> para parceiros sem cobrança
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCreateOrg(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={() => createOrgMutation.mutate(newOrg)}
                  disabled={!newOrg.name || !newOrg.planId || createOrgMutation.isPending}
                  className="flex-1"
                >
                  {createOrgMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Criar Organização
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                    plan.is_active ? "bg-card" : "bg-muted/50 border-dashed"
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Todas as Organizações</CardTitle>
          </CardHeader>
          <CardContent>
            {organizations?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma organização cadastrada ainda.</p>
                <p className="text-sm mt-2">Clique em "Nova Organização" para criar uma.</p>
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
                          <Badge variant={subscription?.subscription_plans?.price_cents === 0 ? "secondary" : "outline"}>
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

        {/* Users without Organization */}
        {profiles && profiles.filter(p => !p.organization_id).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Usuários sem Organização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.filter(p => !p.organization_id).map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.first_name} {profile.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {profile.user_id}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground mt-4">
                💡 Estes usuários podem ser adicionados manualmente a uma organização editando o banco de dados.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
