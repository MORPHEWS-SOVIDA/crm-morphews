import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentSubscription, useCustomerPortal } from "@/hooks/useSubscription";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  Users, 
  Plus, 
  Crown, 
  CreditCard, 
  Loader2, 
  AlertTriangle,
  CheckCircle,
  User,
  Mail,
  Trash2,
  Settings
} from "lucide-react";

interface OrgMember {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
    user_id: string;
  } | null;
  email?: string;
}

export default function Team() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: subscription, isLoading: loadingSubscription } = useCurrentSubscription();
  const customerPortal = useCustomerPortal();
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });

  // Fetch org members
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["org-members", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get members
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", profile.organization_id);

      if (membersError) throw membersError;

      // Get profiles for each member
      const memberIds = membersData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("first_name, last_name, user_id")
        .in("user_id", memberIds);

      if (profilesError) throw profilesError;

      // Get emails from auth (we'll use the profile's user_id to match)
      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id) || null,
      }));

      return membersWithProfiles as OrgMember[];
    },
    enabled: !!profile?.organization_id,
  });

  const plan = subscription?.subscription_plans;
  const currentUserCount = members.length;
  const maxUsers = (plan?.max_users || 3) + (subscription?.extra_users || 0);
  const canAddUser = currentUserCount < maxUsers;
  const extraUserPrice = plan?.extra_user_price_cents ? plan.extra_user_price_cents / 100 : 37;

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profile?.organization_id) {
      toast({
        title: "Erro",
        description: "Organização não encontrada.",
        variant: "destructive",
      });
      return;
    }

    if (!canAddUser) {
      toast({
        title: "Limite atingido",
        description: "Você atingiu o limite de usuários do seu plano. Faça upgrade ou adicione usuários extras.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingUser(true);

    try {
      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke("create-org-user", {
        body: {
          organizationId: profile.organization_id,
          ownerName: `${newUserData.firstName} ${newUserData.lastName}`,
          ownerEmail: newUserData.email,
          ownerPhone: "",
          planName: plan?.name || "Morphews CRM",
          isAdditionalUser: true,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Usuário adicionado!",
        description: `Credenciais enviadas para ${newUserData.email}`,
      });

      setNewUserData({ firstName: "", lastName: "", email: "" });
      setIsDialogOpen(false);
      refetchMembers();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast({
        title: "Erro ao adicionar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleManageSubscription = () => {
    customerPortal.mutate();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30"><Crown className="w-3 h-3 mr-1" />Proprietário</Badge>;
      case "admin":
        return <Badge variant="secondary">Admin</Badge>;
      default:
        return <Badge variant="outline">Membro</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
      case "trialing":
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Teste</Badge>;
      case "past_due":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Pagamento Pendente</Badge>;
      case "canceled":
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loadingSubscription || loadingMembers) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Minha Equipe</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os usuários e o plano da sua empresa
            </p>
          </div>
        </div>

        {/* Plan Info Card */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <CreditCard className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{plan?.name || "Plano Atual"}</CardTitle>
                  <CardDescription>
                    {subscription?.status && getStatusBadge(subscription.status)}
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={handleManageSubscription}
                disabled={customerPortal.isPending}
              >
                {customerPortal.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Settings className="w-4 h-4 mr-2" />
                )}
                Gerenciar Plano
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Users Limit */}
              <div className="p-4 rounded-lg bg-card border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Usuários</span>
                </div>
                <div className="text-2xl font-bold">
                  {currentUserCount} <span className="text-muted-foreground text-lg font-normal">/ {maxUsers}</span>
                </div>
                {subscription?.extra_users > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    +{subscription.extra_users} usuários extras
                  </p>
                )}
              </div>

              {/* Leads Limit */}
              <div className="p-4 rounded-lg bg-card border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <User className="w-4 h-4" />
                  <span className="text-sm">Leads</span>
                </div>
                <div className="text-2xl font-bold">
                  {plan?.max_leads ? `${plan.max_leads}` : "Ilimitado"}
                  <span className="text-muted-foreground text-lg font-normal">/mês</span>
                </div>
              </div>

              {/* Price */}
              <div className="p-4 rounded-lg bg-card border">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-sm">Valor</span>
                </div>
                <div className="text-2xl font-bold">
                  R$ {plan?.price_cents ? (plan.price_cents / 100).toFixed(2).replace(".", ",") : "0,00"}
                  <span className="text-muted-foreground text-lg font-normal">/mês</span>
                </div>
              </div>
            </div>

            {/* Upgrade/Add Users Buttons */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              <Button variant="outline" onClick={handleManageSubscription} disabled={customerPortal.isPending}>
                Fazer Upgrade
              </Button>
              <Button variant="outline" onClick={handleManageSubscription} disabled={customerPortal.isPending}>
                Adicionar Usuários Extras (R$ {extraUserPrice.toFixed(2).replace(".", ",")}/usuário)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Team Members Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle>Membros da Equipe</CardTitle>
                  <CardDescription>
                    {currentUserCount} de {maxUsers} usuários
                  </CardDescription>
                </div>
              </div>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canAddUser}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      O usuário receberá um email com as credenciais de acesso.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">Nome</Label>
                        <Input
                          id="firstName"
                          value={newUserData.firstName}
                          onChange={(e) => setNewUserData({ ...newUserData, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Sobrenome</Label>
                        <Input
                          id="lastName"
                          value={newUserData.lastName}
                          onChange={(e) => setNewUserData({ ...newUserData, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newUserData.email}
                        onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={isAddingUser}>
                        {isAddingUser && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {!canAddUser && (
              <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-600">Limite de usuários atingido</p>
                  <p className="text-sm text-muted-foreground">
                    Faça upgrade do plano ou adicione usuários extras para continuar adicionando membros.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                      {member.profile?.first_name?.[0] || "U"}
                    </div>
                    <div>
                      <p className="font-medium">
                        {member.profile 
                          ? `${member.profile.first_name} ${member.profile.last_name}`
                          : "Usuário"}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        <span>—</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getRoleBadge(member.role)}
                    {member.user_id !== user?.id && member.role !== "owner" && (
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {members.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum membro encontrado</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
