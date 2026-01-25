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
import { Building2, Users, CreditCard, Loader2, TrendingUp, Crown, Plus, UserPlus, Mail, Phone, Globe, FileText, Eye, Pencil, Power, PowerOff, Send, Tag, AlertTriangle, Package, Zap, MessageSquare, Smartphone, Cpu, MailOpen, HelpCircle, Wallet, Percent, Settings, Store, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { CouponsTab } from "@/components/super-admin/CouponsTab";
import { WhatsAppCreditsTab } from "@/components/super-admin/WhatsAppCreditsTab";
import { WhatsAppProvidersTab } from "@/components/super-admin/WhatsAppProvidersTab";
import { AllUsersTab } from "@/components/super-admin/AllUsersTab";
import { ErrorLogsTab } from "@/components/super-admin/ErrorLogsTab";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { OrgFeatureOverridesEditor } from "@/components/super-admin/OrgFeatureOverridesEditor";
import { EnergyManagementTab } from "@/components/super-admin/EnergyManagementTab";
import { AdminWhatsAppInstanceTab } from "@/components/super-admin/AdminWhatsAppInstanceTab";
import { AIModelCostsTab } from "@/components/super-admin/AIModelCostsTab";
import { OnboardingEmailsManager } from "@/components/super-admin/OnboardingEmailsManager";
import { SecretaryMessagesManager } from "@/components/super-admin/SecretaryMessagesManager";
import { HelperConversationsTab } from "@/components/super-admin/HelperConversationsTab";
import { SubscriptionKPIs } from "@/components/super-admin/SubscriptionKPIs";
import { BillingManagementTab } from "@/components/super-admin/BillingManagementTab";
import { PlatformGatewaysTab } from "@/components/super-admin/PlatformGatewaysTab";
import { GatewayFinancialDashboard } from "@/components/super-admin/GatewayFinancialDashboard";
import { TenantPaymentFeesTab } from "@/components/super-admin/TenantPaymentFeesTab";
import { LandingTemplatesTab } from "@/components/super-admin/LandingTemplatesTab";
import { SuperAdminNavigation, SUPER_ADMIN_CATEGORIES } from "@/components/super-admin/SuperAdminNavigation";
import { cn } from "@/lib/utils";

const MASTER_ADMIN_EMAIL = "thiago.morphews@gmail.com";

interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_name: string | null;
  owner_email: string | null;
  phone: string | null;
  whatsapp_dms_enabled: boolean;
  receptive_module_enabled: boolean;
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
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    owner_name: "",
    owner_email: "",
    phone: "",
    planId: "",
    extraUsers: 0,
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
  const [activeTab, setActiveTab] = useState("organizations");

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
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        const { data, error } = await supabase.functions.invoke("create-org-user", {
          headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
          body: {
            organizationId: org.id,
            ownerName: newOrg.ownerName,
            ownerEmail: newOrg.ownerEmail,
            ownerPhone: newOrg.ownerPhone,
            planName: planName,
            accessToken,
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

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      const { data, error } = await supabase.functions.invoke("create-org-user", {
        headers: accessToken ? { authorization: `Bearer ${accessToken}` } : undefined,
        body: {
          organizationId: org.id,
          ownerName: org.owner_name,
          ownerEmail: org.owner_email,
          ownerPhone: org.phone || "",
          planName: planName,
          accessToken,
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
    mutationFn: async ({ orgId, data, planId, extraUsers }: { orgId: string; data: Partial<Organization>; planId?: string; extraUsers?: number }) => {
      // Update organization
      const { error: orgError } = await supabase
        .from("organizations")
        .update(data)
        .eq("id", orgId);

      if (orgError) throw orgError;

      // Update subscription plan and extra users if provided
      if (planId || extraUsers !== undefined) {
        const updateData: Record<string, unknown> = {};
        if (planId) updateData.plan_id = planId;
        if (extraUsers !== undefined) updateData.extra_users = extraUsers;

        const { error: subError } = await supabase
          .from("subscriptions")
          .update(updateData)
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
      extraUsers: subscription?.extra_users || 0,
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
        extraUsers: editForm.extraUsers,
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

        {/* Stats Cards with Filters */}
        <SubscriptionKPIs 
          organizations={organizations || []}
          subscriptions={subscriptions || []}
          members={members || []}
          onFilterChange={setStatusFilter}
          activeFilter={statusFilter}
        />

        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <SuperAdminNavigation activeTab={activeTab} onTabChange={setActiveTab} />
          
          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {activeTab === "organizations" && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {statusFilter 
                        ? `Organizações - ${statusFilter === 'active' ? 'Ativas' : statusFilter === 'trialing' ? 'Trial' : statusFilter === 'past_due' ? 'Inadimplentes' : 'Canceladas'}`
                        : 'Todas as Organizações'
                      }
                    </CardTitle>
                    {statusFilter && (
                      <Button variant="ghost" size="sm" onClick={() => setStatusFilter(null)}>
                        Limpar filtro
                      </Button>
                    )}
                  </div>
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
                        {organizations
                          ?.filter((org) => {
                            if (!statusFilter) return true;
                            const sub = getSubscriptionForOrg(org.id);
                            return sub?.status === statusFilter;
                          })
                          .map((org) => {
                          const subscription = getSubscriptionForOrg(org.id);
                          const memberCount = getMemberCountForOrg(org.id);

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
                                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(org)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  {subscription && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleSubscriptionStatusMutation.mutate({
                                        subId: subscription.id,
                                        newStatus: subscription.status === "active" ? "canceled" : "active"
                                      })}
                                    >
                                      {subscription.status === "active" ? (
                                        <PowerOff className="h-4 w-4 text-destructive" />
                                      ) : (
                                        <Power className="h-4 w-4 text-green-500" />
                                      )}
                                    </Button>
                                  )}
                                  {memberCount === 0 && org.owner_email && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => sendCredentialsToOrg(org)}
                                      disabled={sendingCredentialsFor === org.id}
                                      title="Enviar credenciais por email"
                                    >
                                      {sendingCredentialsFor === org.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Send className="h-4 w-4" />
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
            )}

            {activeTab === "interested" && (
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
            )}

            {activeTab === "all-users" && <AllUsersTab />}
            {activeTab === "billing" && <BillingManagementTab />}
            {activeTab === "coupons" && <CouponsTab />}
            {activeTab === "plan-editor" && <PlanEditor />}
            {activeTab === "gateway-financial" && <GatewayFinancialDashboard />}
            {activeTab === "gateways" && <PlatformGatewaysTab />}
            {activeTab === "tenant-fees" && <TenantPaymentFeesTab />}
            {activeTab === "landing-templates" && <LandingTemplatesTab />}
            {activeTab === "whatsapp" && <WhatsAppCreditsTab />}
            {activeTab === "providers" && <WhatsAppProvidersTab />}
            {activeTab === "admin-whatsapp" && <AdminWhatsAppInstanceTab />}
            {activeTab === "energy" && <EnergyManagementTab />}
            {activeTab === "ai-costs" && <AIModelCostsTab />}
            {activeTab === "secretary-messages" && <SecretaryMessagesManager />}
            {activeTab === "helper-donna" && <HelperConversationsTab />}
            {activeTab === "org-overrides" && <OrgFeatureOverridesEditor />}
            {activeTab === "error-logs" && <ErrorLogsTab />}
            {activeTab === "onboarding-emails" && <OnboardingEmailsManager />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
