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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Building2, Users, CreditCard, Loader2, TrendingUp, Crown, Plus, UserPlus, Mail, Phone, Globe, FileText, Eye, Pencil, Power, PowerOff, Send, Tag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CouponsTab } from "@/components/super-admin/CouponsTab";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  phone: string | null;
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

interface InterestedLead {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string;
  plan_name: string | null;
  status: string;
  created_at: string;
}

interface OnboardingData {
  id: string;
  organization_id: string;
  cnpj: string | null;
  company_site: string | null;
  crm_usage_intent: string | null;
  business_description: string | null;
  completed_at: string | null;
}

export default function SuperAdmin() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [selectedOrgForUser, setSelectedOrgForUser] = useState<string | null>(null);
  const [selectedOrgDetails, setSelectedOrgDetails] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    owner_name: "",
    owner_email: "",
    phone: "",
    planId: "",
  });
  const [newOrg, setNewOrg] = useState({ 
    name: "", 
    planId: "",
    ownerName: "",
    ownerEmail: "",
    ownerPhone: ""
  });
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [sendingCredentialsFor, setSendingCredentialsFor] = useState<string | null>(null);

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

  const { data: interestedLeads } = useQuery({
    queryKey: ["super-admin-interested-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("interested_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InterestedLead[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const { data: onboardingDataList } = useQuery({
    queryKey: ["super-admin-onboarding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_data")
        .select("*");

      if (error) throw error;
      return data as OnboardingData[];
    },
    enabled: user?.email === MASTER_ADMIN_EMAIL,
  });

  const createOrgWithUser = async () => {
    try {
      setIsCreatingOrg(true);
      
      const slug = newOrg.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({ 
          name: newOrg.name, 
          slug,
          owner_name: newOrg.ownerName,
          owner_email: newOrg.ownerEmail,
          phone: newOrg.ownerPhone
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Create subscription with the selected plan
      const { error: subError } = await supabase
        .from("subscriptions")
        .insert({
          organization_id: org.id,
          plan_id: newOrg.planId,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });

      if (subError) throw subError;

      // Get plan name for email
      const selectedPlan = plans?.find(p => p.id === newOrg.planId);
      const planName = selectedPlan?.name || "Morphews CRM";

      // If owner email is provided, create user and send credentials
      if (newOrg.ownerEmail && newOrg.ownerName) {
        const { data, error } = await supabase.functions.invoke("create-org-user", {
          body: {
            organizationId: org.id,
            ownerName: newOrg.ownerName,
            ownerEmail: newOrg.ownerEmail,
            ownerPhone: newOrg.ownerPhone,
            planName: planName,
          },
        });

        if (error) {
          console.error("Error creating user:", error);
          toast({
            title: "Organização criada, mas houve erro ao criar usuário",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({ 
            title: "Sucesso!", 
            description: `Organização criada e credenciais enviadas para ${newOrg.ownerEmail}` 
          });
        }
      } else {
        toast({ title: "Organização criada com sucesso!" });
      }

      setShowCreateOrg(false);
      setNewOrg({ name: "", planId: "", ownerName: "", ownerEmail: "", ownerPhone: "" });
      refetchOrgs();
      refetchSubs();
      refetchMembers();
    } catch (error: any) {
      toast({
        title: "Erro ao criar organização",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreatingOrg(false);
    }
  };

  // Send credentials to an existing org that has no users
  const sendCredentialsToOrg = async (org: Organization) => {
    if (!org.owner_email || !org.owner_name) {
      toast({
        title: "Erro",
        description: "Organização precisa ter email e nome do dono configurados.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingCredentialsFor(org.id);
      
      const subscription = subscriptions?.find(s => s.organization_id === org.id);
      const planName = subscription?.subscription_plans?.name || "Morphews CRM";

      const { data, error } = await supabase.functions.invoke("create-org-user", {
        body: {
          organizationId: org.id,
          ownerName: org.owner_name,
          ownerEmail: org.owner_email,
          ownerPhone: org.phone || "",
          planName: planName,
        },
      });

      if (error) {
        throw error;
      }

      toast({ 
        title: "Sucesso!", 
        description: `Credenciais enviadas para ${org.owner_email}` 
      });

      refetchMembers();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar credenciais",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSendingCredentialsFor(null);
    }
  };

  const addUserToOrgMutation = useMutation({
    mutationFn: async ({ orgId, userId }: { orgId: string; userId: string }) => {
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: orgId,
          user_id: userId,
          role: "member",
        });

      if (memberError) throw memberError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ organization_id: orgId })
        .eq("user_id", userId);

      if (profileError) throw profileError;

      return { orgId, userId };
    },
    onSuccess: () => {
      toast({ title: "Usuário adicionado à organização!" });
      setSelectedOrgForUser(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrganizationMutation = useMutation({
    mutationFn: async ({ orgId, data, planId }: { orgId: string; data: Partial<Organization>; planId?: string }) => {
      // Update organization
      const { error: orgError } = await supabase
        .from("organizations")
        .update(data)
        .eq("id", orgId);

      if (orgError) throw orgError;

      // Update subscription plan if provided
      if (planId) {
        const { error: subError } = await supabase
          .from("subscriptions")
          .update({ plan_id: planId })
          .eq("organization_id", orgId);

        if (subError) throw subError;
      }
    },
    onSuccess: () => {
      toast({ title: "Organização atualizada com sucesso!" });
      setEditingOrg(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleSubscriptionStatusMutation = useMutation({
    mutationFn: async ({ subId, newStatus }: { subId: string; newStatus: "active" | "canceled" | "past_due" | "trialing" | "unpaid" }) => {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: newStatus })
        .eq("id", subId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Status da assinatura atualizado!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-subscriptions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (org: Organization) => {
    const subscription = getSubscriptionForOrg(org.id);
    setEditForm({
      name: org.name,
      owner_name: org.owner_name || "",
      owner_email: org.owner_email || "",
      phone: org.phone || "",
      planId: subscription?.plan_id || "",
    });
    setEditingOrg(org);
  };

  const handleSaveEdit = async () => {
    if (!editingOrg) return;
    setIsSavingEdit(true);
    try {
      await updateOrganizationMutation.mutateAsync({
        orgId: editingOrg.id,
        data: {
          name: editForm.name,
          owner_name: editForm.owner_name || null,
          owner_email: editForm.owner_email || null,
          phone: editForm.phone || null,
        },
        planId: editForm.planId,
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const getSubscriptionForOrg = (orgId: string) => {
    return subscriptions?.find((s) => s.organization_id === orgId);
  };

  const getMemberCountForOrg = (orgId: string) => {
    return members?.filter((m) => m.organization_id === orgId).length || 0;
  };

  const getOnboardingForOrg = (orgId: string) => {
    return onboardingDataList?.find((o) => o.organization_id === orgId);
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

  const getInterestedStatusBadge = (status: string) => {
    switch (status) {
      case "converted":
        return <Badge className="bg-green-500">Convertido</Badge>;
      case "checkout_started":
        return <Badge className="bg-yellow-500">Em Checkout</Badge>;
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
  const usersWithoutOrg = profiles?.filter((p) => !p.organization_id);

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
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Nome da Organização *</Label>
                  <Input
                    id="org-name"
                    placeholder="Ex: Empresa do João"
                    value={newOrg.name}
                    onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Plano *</Label>
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
                
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Dados do Dono (para criar conta e enviar credenciais)
                  </h4>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="owner-name">Nome Completo *</Label>
                      <Input
                        id="owner-name"
                        placeholder="Ex: João da Silva"
                        value={newOrg.ownerName}
                        onChange={(e) => setNewOrg({ ...newOrg, ownerName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-email">E-mail *</Label>
                      <Input
                        id="owner-email"
                        type="email"
                        placeholder="email@exemplo.com"
                        value={newOrg.ownerEmail}
                        onChange={(e) => setNewOrg({ ...newOrg, ownerEmail: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Uma senha provisória será enviada para este e-mail
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="owner-phone">WhatsApp</Label>
                      <Input
                        id="owner-phone"
                        placeholder="Ex: 5511999999999"
                        value={newOrg.ownerPhone}
                        onChange={(e) => setNewOrg({ ...newOrg, ownerPhone: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowCreateOrg(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  onClick={createOrgWithUser}
                  disabled={!newOrg.name || !newOrg.planId || !newOrg.ownerName || !newOrg.ownerEmail || isCreatingOrg}
                  className="flex-1"
                >
                  {isCreatingOrg ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Criar e Enviar Credenciais
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

        <Tabs defaultValue="organizations" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="organizations">Organizações</TabsTrigger>
            <TabsTrigger value="interested">Quiz Interessados ({interestedLeads?.length || 0})</TabsTrigger>
            <TabsTrigger value="coupons" className="gap-1">
              <Tag className="h-3 w-3" />
              Cupons
            </TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="users">Usuários sem Org</TabsTrigger>
          </TabsList>

          <TabsContent value="organizations">
            <Card>
              <CardHeader>
                <CardTitle>Todas as Organizações</CardTitle>
              </CardHeader>
              <CardContent>
                {organizations?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma organização cadastrada ainda.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Organização</TableHead>
                        <TableHead>Dono</TableHead>
                        <TableHead>Contato</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usuários</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {organizations?.map((org) => {
                        const subscription = getSubscriptionForOrg(org.id);
                        const memberCount = getMemberCountForOrg(org.id);
                        const onboarding = getOnboardingForOrg(org.id);

                        return (
                          <TableRow key={org.id}>
                            <TableCell className="font-medium">
                              {org.name}
                              <div className="text-xs text-muted-foreground">{org.slug}</div>
                            </TableCell>
                            <TableCell>
                              {org.owner_name || "-"}
                              {org.owner_email && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {org.owner_email}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {org.phone ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Phone className="h-3 w-3" />
                                  {org.phone}
                                </div>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={subscription?.subscription_plans?.price_cents === 0 ? "secondary" : "outline"}>
                                {subscription?.subscription_plans?.name || "Sem plano"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {subscription ? getStatusBadge(subscription.status) : "-"}
                            </TableCell>
                            <TableCell>{memberCount}</TableCell>
                            <TableCell>
                              {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {/* View Details */}
                                <Dialog open={selectedOrgDetails === org.id} onOpenChange={(open) => setSelectedOrgDetails(open ? org.id : null)}>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" title="Ver detalhes">
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle>Detalhes: {org.name}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label className="text-muted-foreground">Nome do Dono</Label>
                                          <p className="font-medium">{org.owner_name || "-"}</p>
                                        </div>
                                        <div>
                                          <Label className="text-muted-foreground">Email</Label>
                                          <p className="font-medium">{org.owner_email || "-"}</p>
                                        </div>
                                        <div>
                                          <Label className="text-muted-foreground">Telefone</Label>
                                          <p className="font-medium">{org.phone || "-"}</p>
                                        </div>
                                        <div>
                                          <Label className="text-muted-foreground">Plano</Label>
                                          <p className="font-medium">{subscription?.subscription_plans?.name || "-"}</p>
                                        </div>
                                      </div>
                                      
                                      {onboarding && (
                                        <div className="border-t pt-4">
                                          <h4 className="font-semibold mb-3 flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Dados do Onboarding
                                          </h4>
                                          <div className="grid grid-cols-2 gap-4">
                                            <div>
                                              <Label className="text-muted-foreground">CNPJ</Label>
                                              <p className="font-medium">{onboarding.cnpj || "-"}</p>
                                            </div>
                                            <div>
                                              <Label className="text-muted-foreground">Site</Label>
                                              <p className="font-medium">
                                                {onboarding.company_site ? (
                                                  <a href={onboarding.company_site} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    <Globe className="h-3 w-3" />
                                                    {onboarding.company_site}
                                                  </a>
                                                ) : "-"}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="mt-3">
                                            <Label className="text-muted-foreground">Como pretende usar o CRM</Label>
                                            <p className="font-medium text-sm mt-1">{onboarding.crm_usage_intent || "-"}</p>
                                          </div>
                                          <div className="mt-3">
                                            <Label className="text-muted-foreground">Sobre o Negócio</Label>
                                            <p className="font-medium text-sm mt-1">{onboarding.business_description || "-"}</p>
                                          </div>
                                        </div>
                                      )}
                                      
                                      {!onboarding && (
                                        <div className="border-t pt-4 text-center text-muted-foreground">
                                          <p>Onboarding ainda não foi preenchido</p>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>

                                {/* Edit Organization */}
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  title="Editar organização"
                                  onClick={() => openEditDialog(org)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>

                                {/* Send Credentials - show when org has email but no users */}
                                {memberCount === 0 && org.owner_email && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Enviar credenciais para o dono"
                                    onClick={() => sendCredentialsToOrg(org)}
                                    disabled={sendingCredentialsFor === org.id}
                                    className="text-primary hover:text-primary"
                                  >
                                    {sendingCredentialsFor === org.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}

                                {/* Toggle Status */}
                                {subscription && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title={subscription.status === "canceled" ? "Reativar assinatura" : "Desativar assinatura"}
                                    onClick={() => {
                                      const newStatus = subscription.status === "canceled" ? "active" : "canceled";
                                      toggleSubscriptionStatusMutation.mutate({ subId: subscription.id, newStatus });
                                    }}
                                    className={subscription.status === "canceled" ? "text-green-600 hover:text-green-700" : "text-destructive hover:text-destructive"}
                                  >
                                    {subscription.status === "canceled" ? (
                                      <Power className="h-4 w-4" />
                                    ) : (
                                      <PowerOff className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Edit Organization Dialog */}
            <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Organização</DialogTitle>
                  <DialogDescription>
                    Atualize os dados da organização e do plano
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome da Organização *</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Plano</Label>
                    <Select
                      value={editForm.planId}
                      onValueChange={(value) => setEditForm({ ...editForm, planId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um plano" />
                      </SelectTrigger>
                      <SelectContent>
                        {plans?.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.name} ({formatPrice(plan.price_cents)}/mês)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Dados do Dono</h4>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Nome do Dono</Label>
                        <Input
                          value={editForm.owner_name}
                          onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Email do Dono</Label>
                        <Input
                          type="email"
                          value={editForm.owner_email}
                          onChange={(e) => setEditForm({ ...editForm, owner_email: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setEditingOrg(null)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={!editForm.name || isSavingEdit}
                    className="flex-1"
                  >
                    {isSavingEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Salvar Alterações
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="interested">
            <Card>
              <CardHeader>
                <CardTitle>Quiz Preenchidos (Interessados)</CardTitle>
              </CardHeader>
              <CardContent>
                {interestedLeads?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum interessado ainda.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Plano Interesse</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interestedLeads?.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>
                            {lead.email ? (
                              <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                                {lead.email}
                              </a>
                            ) : "-"}
                          </TableCell>
                          <TableCell>
                            <a 
                              href={`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline"
                            >
                              {lead.whatsapp}
                            </a>
                          </TableCell>
                          <TableCell>{lead.plan_name || "-"}</TableCell>
                          <TableCell>{getInterestedStatusBadge(lead.status)}</TableCell>
                          <TableCell>
                            {format(new Date(lead.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plans">
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
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Usuários sem Organização</CardTitle>
              </CardHeader>
              <CardContent>
                {usersWithoutOrg?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Todos os usuários estão em organizações.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersWithoutOrg?.map((profile) => (
                        <TableRow key={profile.id}>
                          <TableCell>{profile.first_name} {profile.last_name}</TableCell>
                          <TableCell>
                            <Dialog open={selectedOrgForUser === profile.user_id} onOpenChange={(open) => setSelectedOrgForUser(open ? profile.user_id : null)}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                  <UserPlus className="h-4 w-4" />
                                  Adicionar a Org
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Adicionar à Organização</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <Select
                                    onValueChange={(orgId) => {
                                      addUserToOrgMutation.mutate({ orgId, userId: profile.user_id });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma organização" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {organizations?.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                          {org.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coupons">
            <CouponsTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
