import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentSubscription, useCustomerPortal, useSubscriptionPlans, useCreateCheckout } from "@/hooks/useSubscription";
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
  Settings,
  Pencil,
  ArrowUp,
  Check,
  Phone,
  Eye,
  EyeOff,
  Shield
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { UserPermissionsEditor } from "@/components/team/UserPermissionsEditor";
import { useApplyRoleDefaults } from "@/hooks/useUserPermissions";
import { AvatarUpload } from "@/components/team/AvatarUpload";
import { useTeams } from "@/hooks/useTeams";

// All organization roles from org_role enum
type OrgRole = "owner" | "admin" | "member" | "manager" | "seller" | "shipping" | "finance" | "delivery";

const ORG_ROLE_LABELS: Record<OrgRole, { label: string; description: string }> = {
  owner: { label: "Proprietário", description: "Dono da organização com todos os poderes" },
  admin: { label: "Administrador", description: "Pode gerenciar equipe, configurações e vê todos os leads" },
  manager: { label: "Gerente", description: "Pode gerenciar equipe e ver relatórios" },
  seller: { label: "Vendedor", description: "Acesso a leads, produtos e WhatsApp" },
  member: { label: "Membro", description: "Acesso básico a leads e produtos" },
  shipping: { label: "Expedição", description: "Valida expedição e despacha vendas" },
  delivery: { label: "Entregador", description: "Vê apenas suas entregas atribuídas" },
  finance: { label: "Financeiro", description: "Confirma pagamentos e acessa relatórios" },
};

// Roles that can be assigned (owner is never assignable via UI)
const ASSIGNABLE_ROLES: OrgRole[] = ["admin", "manager", "seller", "member", "shipping", "delivery", "finance"];

interface OrgMember {
  id: string;
  user_id: string;
  role: OrgRole;
  can_see_all_leads: boolean;
  commission_percentage: number | null;
  extension: string | null;
  is_sales_manager: boolean;
  earns_team_commission: boolean;
  team_commission_percentage: number | null;
  team_id: string | null;
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
    user_id: string;
    email?: string;
    whatsapp?: string;
    instagram?: string;
    avatar_cartoon_url?: string;
    avatar_fighter_url?: string;
    avatar_horse_url?: string;
    favorite_drink?: string;
    favorite_chocolate?: string;
    dream_prize?: string;
    nickname?: string;
    daily_goal_cents?: number;
    weekly_goal_cents?: number;
    monthly_goal_cents?: number;
  } | null;
  team?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

export default function Team() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { data: teams = [] } = useTeams();
  const { data: subscription, isLoading: loadingSubscription } = useCurrentSubscription();
  const { data: allPlans = [], isLoading: loadingPlans } = useSubscriptionPlans();
  const customerPortal = useCustomerPortal();
  const createCheckout = useCreateCheckout();
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);
  const [isExtraUsersDialogOpen, setIsExtraUsersDialogOpen] = useState(false);
  const [extraUsersToAdd, setExtraUsersToAdd] = useState(1);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
  const [editRole, setEditRole] = useState<OrgRole>("member");
  const [editCanSeeAllLeads, setEditCanSeeAllLeads] = useState(true);
  const [editMemberData, setEditMemberData] = useState({
    firstName: "",
    lastName: "",
    whatsapp: "",
    instagram: "",
    commissionPercentage: 0,
    extension: "",
    teamId: null as string | null,
    // Gamification fields
    avatarCartoonUrl: "",
    avatarFighterUrl: "",
    avatarHorseUrl: "",
    favoriteDrink: "",
    favoriteChocolate: "",
    dreamPrize: "",
    nickname: "",
    // Sales goals
    dailyGoalCents: 0,
    weeklyGoalCents: 0,
    monthlyGoalCents: 0,
    // Sales manager
    isSalesManager: false,
    earnsTeamCommission: false,
    teamCommissionPercentage: 0,
  });
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string[]>([]);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState<string | null>(null);
  const [newUserData, setNewUserData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsapp: "",
  });
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  
  // My Profile state
  const [isEditingMyProfile, setIsEditingMyProfile] = useState(false);
  const [isSavingMyProfile, setIsSavingMyProfile] = useState(false);
  const [myProfileData, setMyProfileData] = useState({
    firstName: "",
    lastName: "",
    whatsapp: "",
    instagram: "",
    // Gamification fields
    avatarCartoonUrl: "",
    avatarFighterUrl: "",
    avatarHorseUrl: "",
    favoriteDrink: "",
    favoriteChocolate: "",
    dreamPrize: "",
    nickname: "",
    // Sales goals
    dailyGoalCents: 0,
    weeklyGoalCents: 0,
    monthlyGoalCents: 0,
  });

  // Fetch current user's full profile
  const { data: myFullProfile, refetch: refetchMyProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Initialize myProfileData when profile loads
  useState(() => {
    if (myFullProfile) {
      setMyProfileData({
        firstName: myFullProfile.first_name || "",
        lastName: myFullProfile.last_name || "",
        whatsapp: myFullProfile.whatsapp || "",
        instagram: myFullProfile.instagram || "",
        avatarCartoonUrl: myFullProfile.avatar_cartoon_url || "",
        avatarFighterUrl: myFullProfile.avatar_fighter_url || "",
        avatarHorseUrl: myFullProfile.avatar_horse_url || "",
        favoriteDrink: myFullProfile.favorite_drink || "",
        favoriteChocolate: myFullProfile.favorite_chocolate || "",
        dreamPrize: myFullProfile.dream_prize || "",
        nickname: myFullProfile.nickname || "",
        dailyGoalCents: myFullProfile.daily_goal_cents || 0,
        weeklyGoalCents: myFullProfile.weekly_goal_cents || 0,
        monthlyGoalCents: myFullProfile.monthly_goal_cents || 0,
      });
    }
  });

  // Fetch org members
  const { data: members = [], isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ["org-members", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];

      // Get members including can_see_all_leads, commission, extension, team_id and sales manager fields
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("id, user_id, role, can_see_all_leads, commission_percentage, extension, is_sales_manager, earns_team_commission, team_commission_percentage, team_id, created_at, organization_id")
        .eq("organization_id", profile.organization_id);

      if (membersError) throw membersError;

      // Get profiles for each member with email and whatsapp
      const memberIds = membersData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("first_name, last_name, user_id, email, whatsapp, instagram, avatar_cartoon_url, avatar_fighter_url, avatar_horse_url, favorite_drink, favorite_chocolate, dream_prize, nickname, daily_goal_cents, weekly_goal_cents, monthly_goal_cents")
        .in("user_id", memberIds);

      if (profilesError) throw profilesError;

      // Get teams for members that have team_id
      const teamIds = membersData.filter(m => m.team_id).map(m => m.team_id);
      let teamsMap: Record<string, { id: string; name: string; color: string }> = {};
      if (teamIds.length > 0) {
        const { data: teams, error: teamsError } = await supabase
          .from("teams")
          .select("id, name, color")
          .in("id", teamIds);
        
        if (!teamsError && teams) {
          teams.forEach(t => {
            teamsMap[t.id] = t;
          });
        }
      }

      const membersWithProfiles = membersData.map(member => ({
        ...member,
        profile: profiles?.find(p => p.user_id === member.user_id) || null,
        team: member.team_id ? teamsMap[member.team_id] || null : null,
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

  // Filter plans for change (all plans except current and hidden ones)
  const currentPlanId = plan?.id;
  const availablePlans = allPlans.filter(p => 
    p.id !== currentPlanId && 
    p.name !== "INFLUENCER" // Hide special plans
  );

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
          ownerPhone: newUserData.whatsapp.replace(/\D/g, ''),
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

      setNewUserData({ firstName: "", lastName: "", email: "", whatsapp: "" });
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

  const handleUpgradePlan = (planId: string) => {
    createCheckout.mutate(planId);
  };

  const handleStartEditMyProfile = () => {
    setMyProfileData({
      firstName: myFullProfile?.first_name || "",
      lastName: myFullProfile?.last_name || "",
      whatsapp: myFullProfile?.whatsapp || "",
      instagram: myFullProfile?.instagram || "",
      avatarCartoonUrl: myFullProfile?.avatar_cartoon_url || "",
      avatarFighterUrl: myFullProfile?.avatar_fighter_url || "",
      avatarHorseUrl: myFullProfile?.avatar_horse_url || "",
      favoriteDrink: myFullProfile?.favorite_drink || "",
      favoriteChocolate: myFullProfile?.favorite_chocolate || "",
      dreamPrize: myFullProfile?.dream_prize || "",
      nickname: myFullProfile?.nickname || "",
      dailyGoalCents: myFullProfile?.daily_goal_cents || 0,
      weeklyGoalCents: myFullProfile?.weekly_goal_cents || 0,
      monthlyGoalCents: myFullProfile?.monthly_goal_cents || 0,
    });
    setIsEditingMyProfile(true);
  };

  const handleSaveMyProfile = async () => {
    if (!user?.id) return;
    
    setIsSavingMyProfile(true);
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: myProfileData.firstName,
          last_name: myProfileData.lastName,
          whatsapp: myProfileData.whatsapp.replace(/\D/g, '') || null,
          instagram: myProfileData.instagram || null,
          avatar_cartoon_url: myProfileData.avatarCartoonUrl || null,
          avatar_fighter_url: myProfileData.avatarFighterUrl || null,
          avatar_horse_url: myProfileData.avatarHorseUrl || null,
          favorite_drink: myProfileData.favoriteDrink || null,
          favorite_chocolate: myProfileData.favoriteChocolate || null,
          dream_prize: myProfileData.dreamPrize || null,
          nickname: myProfileData.nickname || null,
          daily_goal_cents: myProfileData.dailyGoalCents || 0,
          weekly_goal_cents: myProfileData.weeklyGoalCents || 0,
          monthly_goal_cents: myProfileData.monthlyGoalCents || 0,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado!",
        description: "Seus dados foram salvos com sucesso.",
      });
      
      setIsEditingMyProfile(false);
      refetchMyProfile();
      refetchMembers();
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Erro ao salvar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSavingMyProfile(false);
    }
  };

  const handleEditMember = async (member: OrgMember) => {
    setEditingMember(member);
    setEditRole(member.role);
    setEditCanSeeAllLeads(member.can_see_all_leads ?? true);
    setEditMemberData({
      firstName: member.profile?.first_name || "",
      lastName: member.profile?.last_name || "",
      whatsapp: member.profile?.whatsapp || "",
      instagram: member.profile?.instagram || "",
      commissionPercentage: member.commission_percentage || 0,
      extension: member.extension || "",
      teamId: member.team_id || null,
      avatarCartoonUrl: member.profile?.avatar_cartoon_url || "",
      avatarFighterUrl: member.profile?.avatar_fighter_url || "",
      avatarHorseUrl: member.profile?.avatar_horse_url || "",
      favoriteDrink: member.profile?.favorite_drink || "",
      favoriteChocolate: member.profile?.favorite_chocolate || "",
      dreamPrize: member.profile?.dream_prize || "",
      nickname: member.profile?.nickname || "",
      dailyGoalCents: member.profile?.daily_goal_cents || 0,
      weeklyGoalCents: member.profile?.weekly_goal_cents || 0,
      monthlyGoalCents: member.profile?.monthly_goal_cents || 0,
      isSalesManager: member.is_sales_manager ?? false,
      earnsTeamCommission: member.earns_team_commission ?? false,
      teamCommissionPercentage: member.team_commission_percentage || 0,
    });
    
    // Fetch team members if is sales manager
    if (member.is_sales_manager) {
      const { data: teamData } = await supabase
        .from("sales_manager_team_members")
        .select("team_member_user_id")
        .eq("manager_user_id", member.user_id);
      
      setSelectedTeamMembers(teamData?.map(t => t.team_member_user_id) || []);
    } else {
      setSelectedTeamMembers([]);
    }
    
    setIsEditDialogOpen(true);
  };

  const handleToggleVisibility = async (memberId: string, currentValue: boolean) => {
    setIsTogglingVisibility(memberId);
    
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ can_see_all_leads: !currentValue })
        .eq("id", memberId);

      if (error) throw error;

      toast({
        title: "Visibilidade atualizada",
        description: !currentValue 
          ? "O usuário agora pode ver todos os leads."
          : "O usuário agora só pode ver leads que é responsável.",
      });
      
      refetchMembers();
    } catch (error: any) {
      console.error("Error toggling visibility:", error);
      toast({
        title: "Erro ao atualizar visibilidade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsTogglingVisibility(null);
    }
  };

  const handleUpdateRole = async () => {
    if (!editingMember || !profile?.organization_id) return;
    
    setIsUpdatingRole(true);
    
    try {
      // Admins always see all leads
      const finalCanSeeAllLeads = editRole === "admin" ? true : editCanSeeAllLeads;
      
      // Update organization_members
      const { error: memberError } = await supabase
        .from("organization_members")
        .update({ 
          role: editRole,
          can_see_all_leads: finalCanSeeAllLeads,
          commission_percentage: editMemberData.commissionPercentage || 0,
          extension: editMemberData.extension || null,
          team_id: editMemberData.teamId || null,
          is_sales_manager: editMemberData.isSalesManager,
          earns_team_commission: editMemberData.earnsTeamCommission,
          team_commission_percentage: editMemberData.teamCommissionPercentage || 0,
        })
        .eq("id", editingMember.id);

      if (memberError) throw memberError;

      // Update profile data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: editMemberData.firstName,
          last_name: editMemberData.lastName,
          whatsapp: editMemberData.whatsapp.replace(/\D/g, '') || null,
          instagram: editMemberData.instagram || null,
          avatar_cartoon_url: editMemberData.avatarCartoonUrl || null,
          avatar_fighter_url: editMemberData.avatarFighterUrl || null,
          avatar_horse_url: editMemberData.avatarHorseUrl || null,
          favorite_drink: editMemberData.favoriteDrink || null,
          favorite_chocolate: editMemberData.favoriteChocolate || null,
          dream_prize: editMemberData.dreamPrize || null,
          nickname: editMemberData.nickname || null,
          daily_goal_cents: editMemberData.dailyGoalCents || 0,
          weekly_goal_cents: editMemberData.weeklyGoalCents || 0,
          monthly_goal_cents: editMemberData.monthlyGoalCents || 0,
        })
        .eq("user_id", editingMember.user_id);

      if (profileError) throw profileError;

      // Handle sales manager team members
      if (editMemberData.isSalesManager && editMemberData.earnsTeamCommission) {
        // Delete existing team members
        await supabase
          .from("sales_manager_team_members")
          .delete()
          .eq("manager_user_id", editingMember.user_id);
        
        // Insert new team members
        if (selectedTeamMembers.length > 0) {
          const teamInserts = selectedTeamMembers.map(teamMemberId => ({
            organization_id: profile.organization_id,
            manager_user_id: editingMember.user_id,
            team_member_user_id: teamMemberId,
          }));
          
          const { error: teamError } = await supabase
            .from("sales_manager_team_members")
            .insert(teamInserts);
          
          if (teamError) throw teamError;
        }
      } else {
        // If not a sales manager anymore, remove all team associations
        await supabase
          .from("sales_manager_team_members")
          .delete()
          .eq("manager_user_id", editingMember.user_id);
      }

      toast({
        title: "Membro atualizado",
        description: "As alterações foram salvas.",
      });
      
      setIsEditDialogOpen(false);
      setEditingMember(null);
      setSelectedTeamMembers([]);
      refetchMembers();
    } catch (error: any) {
      console.error("Error updating member:", error);
      toast({
        title: "Erro ao atualizar membro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const handleDeleteUser = async (memberId: string, memberUserId: string) => {
    if (!profile?.organization_id) return;
    
    setIsDeletingUser(memberId);
    
    try {
      // Find the owner/admin to transfer leads to
      const ownerOrAdmin = members.find(m => m.role === "owner" || m.role === "admin");
      
      if (ownerOrAdmin && ownerOrAdmin.user_id !== memberUserId) {
        // Transfer all lead_responsibles from deleted user to owner/admin
        const { data: leadResponsibles } = await supabase
          .from("lead_responsibles")
          .select("id, lead_id")
          .eq("user_id", memberUserId);

        if (leadResponsibles && leadResponsibles.length > 0) {
          // For each lead, add owner/admin as responsible if not already
          for (const lr of leadResponsibles) {
            // Check if owner/admin is already responsible for this lead
            const { data: existingResp } = await supabase
              .from("lead_responsibles")
              .select("id")
              .eq("lead_id", lr.lead_id)
              .eq("user_id", ownerOrAdmin.user_id)
              .single();

            if (!existingResp && profile?.organization_id) {
              // Add owner/admin as responsible
              await supabase
                .from("lead_responsibles")
                .insert({
                  lead_id: lr.lead_id,
                  user_id: ownerOrAdmin.user_id,
                  organization_id: profile.organization_id,
                });
            }
          }
          
          // Remove all lead_responsibles for the deleted user
          await supabase
            .from("lead_responsibles")
            .delete()
            .eq("user_id", memberUserId);
        }
      }

      // Remove from organization_members
      const { error: memberError } = await supabase
        .from("organization_members")
        .delete()
        .eq("id", memberId);

      if (memberError) throw memberError;

      toast({
        title: "Usuário removido",
        description: "O usuário foi removido da equipe. Os leads foram transferidos para o administrador.",
      });
      
      refetchMembers();
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro ao remover usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30"><Crown className="w-3 h-3 mr-1" />Proprietário</Badge>;
      case "admin":
        return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30">Administrador</Badge>;
      case "manager":
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30">Gerente</Badge>;
      case "seller":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Vendedor</Badge>;
      case "shipping":
        return <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30">Expedição</Badge>;
      case "delivery":
        return <Badge className="bg-cyan-500/20 text-cyan-600 border-cyan-500/30">Entregador</Badge>;
      case "finance":
        return <Badge className="bg-teal-500/20 text-teal-600 border-teal-500/30">Financeiro</Badge>;
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
                Gerenciar Pagamento
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
              {/* Change Plan Dialog */}
              <Dialog open={isUpgradeDialogOpen} onOpenChange={setIsUpgradeDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <ArrowUp className="w-4 h-4 mr-2" />
                    Alterar Plano
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Alterar Plano</DialogTitle>
                    <DialogDescription>
                      Escolha o plano ideal para sua equipe
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-4">
                    {/* Current Plan */}
                    {plan && (
                      <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{plan.name}</p>
                              <Badge variant="secondary">Atual</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {plan.max_users} usuários • {plan.max_leads ? `${plan.max_leads} leads/mês` : "Leads ilimitados"}
                            </p>
                          </div>
                          <p className="font-bold text-primary">
                            R$ {(plan.price_cents / 100).toFixed(2).replace(".", ",")}
                            <span className="text-xs text-muted-foreground font-normal">/mês</span>
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {loadingPlans ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    ) : availablePlans.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>Nenhum outro plano disponível</p>
                      </div>
                    ) : (
                      availablePlans.map((availablePlan) => {
                        const isUpgrade = availablePlan.price_cents > (plan?.price_cents || 0);
                        return (
                          <div
                            key={availablePlan.id}
                            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{availablePlan.name}</p>
                                {isUpgrade ? (
                                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Upgrade</Badge>
                                ) : (
                                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Downgrade</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {availablePlan.max_users} usuários • {availablePlan.max_leads ? `${availablePlan.max_leads} leads/mês` : "Leads ilimitados"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <p className="font-bold text-primary">
                                R$ {(availablePlan.price_cents / 100).toFixed(2).replace(".", ",")}
                                <span className="text-xs text-muted-foreground font-normal">/mês</span>
                              </p>
                              <Button
                                size="sm"
                                variant={isUpgrade ? "default" : "outline"}
                                onClick={() => handleUpgradePlan(availablePlan.id)}
                                disabled={createCheckout.isPending}
                              >
                                {createCheckout.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  "Escolher"
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsUpgradeDialogOpen(false)}>
                      Fechar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Extra Users Dialog */}
              <Dialog open={isExtraUsersDialogOpen} onOpenChange={setIsExtraUsersDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Usuários Extras
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Adicionar Usuários Extras</DialogTitle>
                    <DialogDescription>
                      Cada usuário extra custa R$ {extraUserPrice.toFixed(2).replace(".", ",")}/mês
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-6">
                    <div className="flex items-center justify-center gap-4">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setExtraUsersToAdd(Math.max(1, extraUsersToAdd - 1))}
                        disabled={extraUsersToAdd <= 1}
                      >
                        -
                      </Button>
                      <div className="text-center">
                        <p className="text-4xl font-bold text-primary">{extraUsersToAdd}</p>
                        <p className="text-sm text-muted-foreground">
                          {extraUsersToAdd === 1 ? "usuário" : "usuários"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setExtraUsersToAdd(extraUsersToAdd + 1)}
                      >
                        +
                      </Button>
                    </div>
                    
                    <div className="mt-6 p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground">Valor adicional mensal</p>
                      <p className="text-2xl font-bold text-primary">
                        R$ {(extraUsersToAdd * extraUserPrice).toFixed(2).replace(".", ",")}
                        <span className="text-sm text-muted-foreground font-normal">/mês</span>
                      </p>
                    </div>

                    {subscription?.extra_users > 0 && (
                      <p className="text-sm text-muted-foreground text-center mt-4">
                        Você já tem {subscription.extra_users} usuário(s) extra(s)
                      </p>
                    )}
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setIsExtraUsersDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => {
                        setIsExtraUsersDialogOpen(false);
                        handleManageSubscription();
                      }}
                      disabled={customerPortal.isPending}
                    >
                      {customerPortal.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Continuar para Pagamento
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* My Profile Card */}
        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <User className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <CardTitle>Meu Cadastro</CardTitle>
                  <CardDescription>
                    {myFullProfile?.email || user?.email}
                  </CardDescription>
                </div>
              </div>
              {!isEditingMyProfile && (
                <Button variant="outline" onClick={handleStartEditMyProfile}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditingMyProfile ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="myFirstName">Nome</Label>
                    <Input
                      id="myFirstName"
                      value={myProfileData.firstName}
                      onChange={(e) => setMyProfileData({ ...myProfileData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="myLastName">Sobrenome</Label>
                    <Input
                      id="myLastName"
                      value={myProfileData.lastName}
                      onChange={(e) => setMyProfileData({ ...myProfileData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="myWhatsapp">WhatsApp</Label>
                    <Input
                      id="myWhatsapp"
                      type="tel"
                      placeholder="5511999999999"
                      value={myProfileData.whatsapp}
                      onChange={(e) => setMyProfileData({ ...myProfileData, whatsapp: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Número com código do país. Este número poderá atualizar leads via conversa no WhatsApp pelo número 555130760100.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="myInstagram">Instagram</Label>
                    <Input
                      id="myInstagram"
                      placeholder="@seuinstagram"
                      value={myProfileData.instagram}
                      onChange={(e) => setMyProfileData({ ...myProfileData, instagram: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Coloque o endereço completo: https://instagram.com/usuario
                    </p>
                  </div>
                </div>

                {/* Gamification Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4 text-primary">🎮 Gamificação & Personalização</h4>
                  
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="myNickname">Apelido</Label>
                    <Input
                      id="myNickname"
                      placeholder="Como gosta de ser chamado?"
                      value={myProfileData.nickname}
                      onChange={(e) => setMyProfileData({ ...myProfileData, nickname: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AvatarUpload
                      currentUrl={myProfileData.avatarCartoonUrl}
                      onUploadComplete={(url) => setMyProfileData({ ...myProfileData, avatarCartoonUrl: url })}
                      userId={user?.id || ''}
                      avatarType="cartoon"
                      label="Foto Cartoon"
                    />
                    <AvatarUpload
                      currentUrl={myProfileData.avatarFighterUrl}
                      onUploadComplete={(url) => setMyProfileData({ ...myProfileData, avatarFighterUrl: url })}
                      userId={user?.id || ''}
                      avatarType="fighter"
                      label="Foto Lutador/Street Fighter"
                    />
                    <AvatarUpload
                      currentUrl={myProfileData.avatarHorseUrl}
                      onUploadComplete={(url) => setMyProfileData({ ...myProfileData, avatarHorseUrl: url })}
                      userId={user?.id || ''}
                      avatarType="horse"
                      label="Foto no Cavalo"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="myFavoriteDrink">Bebida Favorita</Label>
                      <Input
                        id="myFavoriteDrink"
                        placeholder="Ex: Café, Suco de laranja..."
                        value={myProfileData.favoriteDrink}
                        onChange={(e) => setMyProfileData({ ...myProfileData, favoriteDrink: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="myFavoriteChocolate">Chocolate Favorito</Label>
                      <Input
                        id="myFavoriteChocolate"
                        placeholder="Ex: Bis, KitKat..."
                        value={myProfileData.favoriteChocolate}
                        onChange={(e) => setMyProfileData({ ...myProfileData, favoriteChocolate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="myDreamPrize">Sonho/Prêmio Desejado</Label>
                      <Input
                        id="myDreamPrize"
                        placeholder="Ex: Viagem, iPhone..."
                        value={myProfileData.dreamPrize}
                        onChange={(e) => setMyProfileData({ ...myProfileData, dreamPrize: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Sales Goals Section */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4 text-primary">🎯 Metas de Vendas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="myDailyGoal">Meta Diária (R$)</Label>
                      <Input
                        id="myDailyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(myProfileData.dailyGoalCents / 100) || ""}
                        onChange={(e) => setMyProfileData({ 
                          ...myProfileData, 
                          dailyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="myWeeklyGoal">Meta Semanal (R$)</Label>
                      <Input
                        id="myWeeklyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(myProfileData.weeklyGoalCents / 100) || ""}
                        onChange={(e) => setMyProfileData({ 
                          ...myProfileData, 
                          weeklyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                      <p className="text-xs text-muted-foreground">Segunda a Domingo</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="myMonthlyGoal">Meta Mensal (R$)</Label>
                      <Input
                        id="myMonthlyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(myProfileData.monthlyGoalCents / 100) || ""}
                        onChange={(e) => setMyProfileData({ 
                          ...myProfileData, 
                          monthlyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setIsEditingMyProfile(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveMyProfile} disabled={isSavingMyProfile}>
                    {isSavingMyProfile && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground mb-1">Nome</p>
                  <p className="font-medium">{myFullProfile?.first_name || "—"} {myFullProfile?.last_name || ""}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground mb-1">Email</p>
                  <p className="font-medium truncate">{myFullProfile?.email || user?.email || "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <Phone className="w-3 h-3" />
                    WhatsApp
                  </div>
                  <p className="font-medium">{myFullProfile?.whatsapp || "—"}</p>
                </div>
                <div className="p-4 rounded-lg bg-card border">
                  <p className="text-sm text-muted-foreground mb-1">Instagram</p>
                  <p className="font-medium">{myFullProfile?.instagram || "—"}</p>
                </div>
              </div>
            )}
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
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp *</Label>
                      <Input
                        id="whatsapp"
                        type="tel"
                        placeholder="5511999999999"
                        value={newUserData.whatsapp}
                        onChange={(e) => setNewUserData({ ...newUserData, whatsapp: e.target.value })}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Número com código do país (ex: 5511999999999). Este número poderá atualizar leads via conversa no WhatsApp pelo número 555130760100.
                      </p>
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
                        <span>{member.profile?.email || "—"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {getRoleBadge(member.role)}
                    {/* Team badge */}
                    {member.team && (
                      <Badge 
                        variant="outline" 
                        className="border-opacity-30"
                        style={{ 
                          backgroundColor: `${member.team.color}20`,
                          color: member.team.color,
                          borderColor: `${member.team.color}50`,
                        }}
                      >
                        <Users className="w-3 h-3 mr-1" />
                        {member.team.name}
                      </Badge>
                    )}
                    {/* Sales Manager badge */}
                    {member.is_sales_manager && (
                      <Badge 
                        variant="outline" 
                        className="bg-purple-500/10 text-purple-600 border-purple-500/30"
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Gerente
                      </Badge>
                    )}
                    {/* Visibility badge */}
                    {member.role !== "owner" && (
                      <Badge 
                        variant="outline" 
                        className={member.can_see_all_leads 
                          ? "bg-green-500/10 text-green-600 border-green-500/30" 
                          : "bg-amber-500/10 text-amber-600 border-amber-500/30"}
                      >
                        {member.can_see_all_leads ? (
                          <><Eye className="w-3 h-3 mr-1" />Vê todos</>
                        ) : (
                          <><EyeOff className="w-3 h-3 mr-1" />Só seus</>
                        )}
                      </Badge>
                    )}
                    {/* Edit button for all members except self */}
                    {member.user_id !== user?.id && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => handleEditMember(member)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {/* Delete button only for non-owners and non-self */}
                    {member.user_id !== user?.id && member.role !== "owner" && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteUser(member.id, member.user_id)}
                        disabled={isDeletingUser === member.id}
                      >
                        {isDeletingUser === member.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
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

        {/* Edit Member Role Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Membro</DialogTitle>
              <DialogDescription>
                Edite os dados e permissões de {editingMember?.profile?.first_name} {editingMember?.profile?.last_name}
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados">
                  <User className="w-4 h-4 mr-2" />
                  Dados e Papel
                </TabsTrigger>
                <TabsTrigger value="permissoes">
                  <Shield className="w-4 h-4 mr-2" />
                  Permissões Detalhadas
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="dados" className="space-y-6 py-4">
                {/* Nome e Sobrenome */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editFirstName">Nome</Label>
                    <Input
                      id="editFirstName"
                      value={editMemberData.firstName}
                      onChange={(e) => setEditMemberData({ ...editMemberData, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editLastName">Sobrenome</Label>
                    <Input
                      id="editLastName"
                      value={editMemberData.lastName}
                      onChange={(e) => setEditMemberData({ ...editMemberData, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="editWhatsapp">WhatsApp</Label>
                  <Input
                    id="editWhatsapp"
                    type="tel"
                    placeholder="5511999999999"
                    value={editMemberData.whatsapp}
                    onChange={(e) => setEditMemberData({ ...editMemberData, whatsapp: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Número com código do país. Este número poderá atualizar leads via conversa no WhatsApp pelo número 555130760100.
                  </p>
                </div>

                {/* Instagram */}
                <div className="space-y-2">
                  <Label htmlFor="editInstagram">Instagram</Label>
                  <Input
                    id="editInstagram"
                    placeholder="@usuario"
                    value={editMemberData.instagram}
                    onChange={(e) => setEditMemberData({ ...editMemberData, instagram: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Coloque o endereço completo: https://instagram.com/usuario
                  </p>
                </div>

                {/* Gamification Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 text-primary">🎮 Gamificação & Personalização</h4>
                  
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="editNickname">Apelido</Label>
                    <Input
                      id="editNickname"
                      placeholder="Como gosta de ser chamado?"
                      value={editMemberData.nickname}
                      onChange={(e) => setEditMemberData({ ...editMemberData, nickname: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <AvatarUpload
                      currentUrl={editMemberData.avatarCartoonUrl}
                      onUploadComplete={(url) => setEditMemberData({ ...editMemberData, avatarCartoonUrl: url })}
                      userId={editingMember?.user_id || ''}
                      avatarType="cartoon"
                      label="Foto Cartoon"
                    />
                    <AvatarUpload
                      currentUrl={editMemberData.avatarFighterUrl}
                      onUploadComplete={(url) => setEditMemberData({ ...editMemberData, avatarFighterUrl: url })}
                      userId={editingMember?.user_id || ''}
                      avatarType="fighter"
                      label="Foto Lutador/Street Fighter"
                    />
                    <AvatarUpload
                      currentUrl={editMemberData.avatarHorseUrl}
                      onUploadComplete={(url) => setEditMemberData({ ...editMemberData, avatarHorseUrl: url })}
                      userId={editingMember?.user_id || ''}
                      avatarType="horse"
                      label="Foto no Cavalo"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="editFavoriteDrink">Bebida Favorita</Label>
                      <Input
                        id="editFavoriteDrink"
                        placeholder="Ex: Café, Suco de laranja..."
                        value={editMemberData.favoriteDrink}
                        onChange={(e) => setEditMemberData({ ...editMemberData, favoriteDrink: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editFavoriteChocolate">Chocolate Favorito</Label>
                      <Input
                        id="editFavoriteChocolate"
                        placeholder="Ex: Bis, KitKat..."
                        value={editMemberData.favoriteChocolate}
                        onChange={(e) => setEditMemberData({ ...editMemberData, favoriteChocolate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editDreamPrize">Sonho/Prêmio Desejado</Label>
                      <Input
                        id="editDreamPrize"
                        placeholder="Ex: Viagem, iPhone..."
                        value={editMemberData.dreamPrize}
                        onChange={(e) => setEditMemberData({ ...editMemberData, dreamPrize: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Sales Goals Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 text-primary">🎯 Metas de Vendas</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="editDailyGoal">Meta Diária (R$)</Label>
                      <Input
                        id="editDailyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(editMemberData.dailyGoalCents / 100) || ""}
                        onChange={(e) => setEditMemberData({ 
                          ...editMemberData, 
                          dailyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editWeeklyGoal">Meta Semanal (R$)</Label>
                      <Input
                        id="editWeeklyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(editMemberData.weeklyGoalCents / 100) || ""}
                        onChange={(e) => setEditMemberData({ 
                          ...editMemberData, 
                          weeklyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                      <p className="text-xs text-muted-foreground">Segunda a Domingo</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="editMonthlyGoal">Meta Mensal (R$)</Label>
                      <Input
                        id="editMonthlyGoal"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={(editMemberData.monthlyGoalCents / 100) || ""}
                        onChange={(e) => setEditMemberData({ 
                          ...editMemberData, 
                          monthlyGoalCents: Math.round(parseFloat(e.target.value || "0") * 100) 
                        })}
                      />
                    </div>
                  </div>
                </div>

                {/* Commission and Extension */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="editCommission">Comissão (%)</Label>
                    <Input
                      id="editCommission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="0.00"
                      value={editMemberData.commissionPercentage || ""}
                      onChange={(e) => setEditMemberData({ 
                        ...editMemberData, 
                        commissionPercentage: parseFloat(e.target.value) || 0 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual de comissão sobre vendas (0% a 100%)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editExtension">Ramal</Label>
                    <Input
                      id="editExtension"
                      placeholder="Ex: 101, A1"
                      value={editMemberData.extension}
                      onChange={(e) => setEditMemberData({ ...editMemberData, extension: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Para integrações futuras (telefonia, etc.)
                    </p>
                  </div>
                </div>

                {/* Sales Manager Section */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-4 text-primary">👑 Gerente de Time de Vendas</h4>
                  
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30 mb-4">
                    <div className="space-y-0.5">
                      <div className="font-medium">Usuário é Gerente de Time de Vendas?</div>
                      <p className="text-xs text-muted-foreground">
                        Gerentes podem ganhar comissão sobre vendas do seu time
                      </p>
                    </div>
                    <Switch
                      checked={editMemberData.isSalesManager}
                      onCheckedChange={(checked) => setEditMemberData({ 
                        ...editMemberData, 
                        isSalesManager: checked,
                        earnsTeamCommission: checked ? editMemberData.earnsTeamCommission : false,
                        teamCommissionPercentage: checked ? editMemberData.teamCommissionPercentage : 0,
                      })}
                    />
                  </div>
                  
                  {editMemberData.isSalesManager && (
                    <div className="space-y-4 ml-4 pl-4 border-l-2 border-primary/30">
                      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                        <div className="space-y-0.5">
                          <div className="font-medium">Ganha comissão em cima do seu time?</div>
                          <p className="text-xs text-muted-foreground">
                            Recebe uma porcentagem sobre as vendas dos vendedores do seu time
                          </p>
                        </div>
                        <Switch
                          checked={editMemberData.earnsTeamCommission}
                          onCheckedChange={(checked) => setEditMemberData({ 
                            ...editMemberData, 
                            earnsTeamCommission: checked 
                          })}
                        />
                      </div>
                      
                      {editMemberData.earnsTeamCommission && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="teamCommission">Comissão sobre o time (%)</Label>
                            <Input
                              id="teamCommission"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              placeholder="0.00"
                              value={editMemberData.teamCommissionPercentage || ""}
                              onChange={(e) => setEditMemberData({ 
                                ...editMemberData, 
                                teamCommissionPercentage: parseFloat(e.target.value) || 0 
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Percentual de comissão sobre vendas entregues do time
                            </p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Quais vendedores fazem parte do time?</Label>
                            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                              {members
                                .filter(m => m.user_id !== editingMember?.user_id) // Exclude self
                                .map(m => (
                                  <div key={m.user_id} className="flex items-center gap-3">
                                    <input
                                      type="checkbox"
                                      id={`team-${m.user_id}`}
                                      checked={selectedTeamMembers.includes(m.user_id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedTeamMembers([...selectedTeamMembers, m.user_id]);
                                        } else {
                                          setSelectedTeamMembers(selectedTeamMembers.filter(id => id !== m.user_id));
                                        }
                                      }}
                                      className="w-4 h-4 rounded border-input"
                                    />
                                    <label htmlFor={`team-${m.user_id}`} className="flex-1 cursor-pointer">
                                      <span className="font-medium">
                                        {m.profile?.first_name} {m.profile?.last_name}
                                      </span>
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({ORG_ROLE_LABELS[m.role]?.label || m.role})
                                      </span>
                                    </label>
                                  </div>
                                ))}
                              {members.filter(m => m.user_id !== editingMember?.user_id).length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                  Nenhum outro membro disponível
                                </p>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Selecione os vendedores que fazem parte do time deste gerente
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Team */}
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select 
                    value={editMemberData.teamId || "none"} 
                    onValueChange={(v) => setEditMemberData({ ...editMemberData, teamId: v === "none" ? null : v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">Sem time</span>
                      </SelectItem>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: team.color || '#6366f1' }} 
                            />
                            <span>{team.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Agrupe usuários por time para organização. Cadastre times em Configurações.
                  </p>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <Label>Papel</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as OrgRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex flex-col">
                            <span>{ORG_ROLE_LABELS[role].label}</span>
                            <span className="text-xs text-muted-foreground">{ORG_ROLE_LABELS[role].description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ao mudar o papel, as permissões padrão serão aplicadas. Você pode personalizá-las na aba "Permissões Detalhadas".
                  </p>
                </div>
                
                {/* Visibility - Only show for non-admin/owner roles */}
                {!["admin", "owner"].includes(editRole) && (
                  <div className="space-y-2">
                    <Label>Visibilidade de Leads</Label>
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 font-medium">
                          {editCanSeeAllLeads ? (
                            <Eye className="w-4 h-4 text-green-500" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-amber-500" />
                          )}
                          {editCanSeeAllLeads ? "Ver todos os leads" : "Apenas seus leads"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {editCanSeeAllLeads 
                            ? "Pode visualizar todos os leads da empresa" 
                            : "Só vê leads que criou ou é responsável"}
                        </p>
                      </div>
                      <Switch
                        checked={editCanSeeAllLeads}
                        onCheckedChange={setEditCanSeeAllLeads}
                      />
                    </div>
                  </div>
                )}
                
                {["admin", "owner"].includes(editRole) && (
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-600">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">{ORG_ROLE_LABELS[editRole].label}s sempre veem todos os leads</span>
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleUpdateRole} disabled={isUpdatingRole}>
                    {isUpdatingRole && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Salvar
                  </Button>
                </DialogFooter>
              </TabsContent>
              
              <TabsContent value="permissoes" className="py-4">
                {editingMember && (
                  <UserPermissionsEditor 
                    userId={editingMember.user_id} 
                    userRole={editRole}
                    onClose={() => setIsEditDialogOpen(false)}
                  />
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
