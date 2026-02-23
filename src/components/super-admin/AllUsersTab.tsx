import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Users, Loader2, Pencil, Trash2, Building2, Search, UserX, Mail, Phone, Eye, KeyRound, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useImpersonation } from "@/hooks/useImpersonation";

interface AuthEmailInfo {
  email: string;
  phone: string | null;
  last_sign_in: string | null;
}

interface FullProfile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  avatar_url: string | null;
  organization_id: string | null;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationMember {
  organization_id: string;
  user_id: string;
  role: string;
}

export function AllUsersTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<FullProfile | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    whatsapp: "",
    instagram: "",
  });
  const [userToDelete, setUserToDelete] = useState<FullProfile | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [sendingCredentialsFor, setSendingCredentialsFor] = useState<string | null>(null);
  const { impersonateUser, isLoading: isImpersonating } = useImpersonation();

  const { data: allProfiles, isLoading: profilesLoading } = useQuery({
    queryKey: ["super-admin-all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name", { ascending: true });

      if (error) throw error;
      return data as FullProfile[];
    },
  });

  // Fetch auth emails (real login emails from auth.users)
  const { data: authEmails } = useQuery({
    queryKey: ["super-admin-auth-emails"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        authEmails: Record<string, AuthEmailInfo>;
      }>("get-auth-emails");

      if (error) throw error;
      if (!data?.success) throw new Error("Failed to fetch auth emails");
      return data.authEmails;
    },
  });

  const { data: organizations } = useQuery({
    queryKey: ["super-admin-all-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug")
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Organization[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["super-admin-all-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("*");

      if (error) throw error;
      return data as OrganizationMember[];
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<FullProfile> }) => {
      const { error } = await supabase
        .from("profiles")
        .update(data)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso!" });
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-profiles"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      // Delete from organization_members first
      const { error: memberError } = await supabase
        .from("organization_members")
        .delete()
        .eq("user_id", userId);

      if (memberError) throw memberError;

      // Delete from profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (profileError) throw profileError;

      // Delete from user_roles
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      // Note: The auth.users deletion would need a service role or edge function
      // For now we just clean up the app-level data
      if (rolesError) console.warn("Could not delete user roles:", rolesError);
    },
    onSuccess: () => {
      toast({ title: "Usuário removido com sucesso!" });
      setUserToDelete(null);
      setDeleteConfirmText("");
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changeUserOrgMutation = useMutation({
    mutationFn: async ({ userId, oldOrgId, newOrgId }: { userId: string; oldOrgId: string | null; newOrgId: string | null }) => {
      // Remove from old org if exists
      if (oldOrgId) {
        const { error: deleteError } = await supabase
          .from("organization_members")
          .delete()
          .eq("user_id", userId)
          .eq("organization_id", oldOrgId);

        if (deleteError) throw deleteError;
      }

      // Add to new org if provided
      if (newOrgId) {
        const { error: insertError } = await supabase
          .from("organization_members")
          .insert({
            user_id: userId,
            organization_id: newOrgId,
            role: "member",
          });

        if (insertError) throw insertError;
      }

      // Update profile organization_id
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ organization_id: newOrgId })
        .eq("user_id", userId);

      if (profileError) throw profileError;
    },
    onSuccess: () => {
      toast({ title: "Organização do usuário atualizada!" });
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin-all-members"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao mudar organização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSendCredentials = async (user: FullProfile) => {
    try {
      setSendingCredentialsFor(user.user_id);
      
      // Use fetch direto para garantir envio do JWT no header Authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão não encontrada');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.user_id,
          sendEmail: true,
          sendWhatsapp: true,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erro ao enviar credenciais');
      const results = [];
      if (data?.emailSent) results.push("📧 Email");
      if (data?.whatsappSent) results.push("📱 WhatsApp");
      toast({
        title: "Credenciais enviadas!",
        description: results.length > 0
          ? `Enviado via: ${results.join(", ")}`
          : `Senha provisória: ${data?.tempPassword || "gerada"}`,
      });
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

  const openEditDialog = (user: FullProfile) => {
    setEditForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email || "",
      whatsapp: user.whatsapp || "",
      instagram: user.instagram || "",
    });
    setEditingUser(user);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setIsSaving(true);
    try {
      await updateProfileMutation.mutateAsync({
        userId: editingUser.user_id,
        data: {
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          email: editForm.email || null,
          whatsapp: editForm.whatsapp || null,
          instagram: editForm.instagram || null,
        },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getOrgForUser = (userId: string) => {
    const member = members?.find(m => m.user_id === userId);
    if (!member) return null;
    return organizations?.find(o => o.id === member.organization_id);
  };

  const getRoleForUser = (userId: string) => {
    const member = members?.find(m => m.user_id === userId);
    return member?.role || null;
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case "owner":
        return <Badge className="bg-amber-500">Dono</Badge>;
      case "admin":
        return <Badge className="bg-primary">Admin</Badge>;
      case "manager":
        return <Badge className="bg-indigo-500 text-white">Gerente</Badge>;
      case "seller":
        return <Badge className="bg-green-500 text-white">Vendedor</Badge>;
      case "member":
        return <Badge variant="secondary">Membro</Badge>;
      case "partner_affiliate":
        return <Badge className="bg-blue-500 text-white">Afiliado</Badge>;
      case "partner_coproducer":
        return <Badge className="bg-green-600 text-white">Co-Produtor</Badge>;
      case "partner_industry":
        return <Badge className="bg-orange-500 text-white">Indústria</Badge>;
      case "partner_factory":
        return <Badge className="bg-red-500 text-white">Fábrica</Badge>;
      default:
        return <Badge variant="outline">{role || "-"}</Badge>;
    }
  };

  const filteredProfiles = allProfiles?.filter(profile => {
    const fullName = `${profile.first_name} ${profile.last_name}`.toLowerCase();
    const email = profile.email?.toLowerCase() || "";
    const org = getOrgForUser(profile.user_id);
    const orgName = org?.name.toLowerCase() || "";
    const search = searchTerm.toLowerCase();
    const role = getRoleForUser(profile.user_id);

    // Text search filter
    const matchesSearch = fullName.includes(search) || email.includes(search) || orgName.includes(search);
    
    // Role filter
    let matchesRole = true;
    if (roleFilter !== "all") {
      if (roleFilter === "partners") {
        // Any partner type
        matchesRole = role?.startsWith("partner_") || false;
      } else if (roleFilter === "clients") {
        // Only regular clients (non-partner roles)
        matchesRole = role !== null && !role.startsWith("partner_");
      } else {
        matchesRole = role === roleFilter;
      }
    }

    return matchesSearch && matchesRole;
  });

  // Count users by role for badges
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: allProfiles?.length || 0,
      clients: 0,
      partners: 0,
      partner_affiliate: 0,
      partner_coproducer: 0,
      partner_industry: 0,
      partner_factory: 0,
      owner: 0,
      admin: 0,
      manager: 0,
      seller: 0,
      member: 0,
    };

    allProfiles?.forEach(profile => {
      const role = getRoleForUser(profile.user_id);
      if (role) {
        if (counts[role] !== undefined) {
          counts[role]++;
        }
        if (role.startsWith("partner_")) {
          counts.partners++;
        } else {
          counts.clients++;
        }
      }
    });

    return counts;
  }, [allProfiles, members]);

  if (profilesLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Todos os Usuários ({allProfiles?.length || 0})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          
          {/* Role Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={roleFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("all")}
            >
              Todos ({roleCounts.all})
            </Button>
            <Button
              variant={roleFilter === "clients" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("clients")}
              className={roleFilter === "clients" ? "" : "border-amber-300 text-amber-700 hover:bg-amber-50"}
            >
              👤 Clientes ({roleCounts.clients})
            </Button>
            <Button
              variant={roleFilter === "partners" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("partners")}
              className={roleFilter === "partners" ? "" : "border-purple-300 text-purple-700 hover:bg-purple-50"}
            >
              🤝 Parceiros ({roleCounts.partners})
            </Button>
            <Button
              variant={roleFilter === "partner_affiliate" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("partner_affiliate")}
              className={roleFilter === "partner_affiliate" ? "" : "border-blue-300 text-blue-700 hover:bg-blue-50"}
            >
              Afiliados ({roleCounts.partner_affiliate})
            </Button>
            <Button
              variant={roleFilter === "partner_coproducer" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("partner_coproducer")}
              className={roleFilter === "partner_coproducer" ? "" : "border-green-300 text-green-700 hover:bg-green-50"}
            >
              Co-Produtores ({roleCounts.partner_coproducer})
            </Button>
            <Button
              variant={roleFilter === "partner_industry" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("partner_industry")}
              className={roleFilter === "partner_industry" ? "" : "border-orange-300 text-orange-700 hover:bg-orange-50"}
            >
              Indústrias ({roleCounts.partner_industry})
            </Button>
            <Button
              variant={roleFilter === "partner_factory" ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter("partner_factory")}
              className={roleFilter === "partner_factory" ? "" : "border-red-300 text-red-700 hover:bg-red-50"}
            >
              Fábricas ({roleCounts.partner_factory})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {filteredProfiles?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <KeyRound className="h-3 w-3" />
                        Login
                      </div>
                    </TableHead>
                    <TableHead>Email Perfil</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles?.map((profile) => {
                    const org = getOrgForUser(profile.user_id);
                    const role = getRoleForUser(profile.user_id);
                    const authInfo = authEmails?.[profile.user_id];

                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {profile.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={profile.first_name}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                                {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div>{profile.first_name} {profile.last_name}</div>
                              {profile.instagram && (
                                <div className="text-xs text-muted-foreground">@{profile.instagram}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {/* Login Email (from auth.users) */}
                        <TableCell>
                          {authInfo?.email ? (
                            <div className="flex flex-col gap-0.5">
                              <a href={`mailto:${authInfo.email}`} className="text-amber-600 hover:underline flex items-center gap-1 font-medium">
                                <KeyRound className="h-3 w-3" />
                                {authInfo.email}
                              </a>
                              {authInfo.phone && (
                                <span className="text-xs text-muted-foreground">{authInfo.phone}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        {/* Profile Email */}
                        <TableCell>
                          {profile.email ? (
                            <a href={`mailto:${profile.email}`} className="text-primary hover:underline flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {profile.email}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          {profile.whatsapp ? (
                            <a
                              href={`https://wa.me/${profile.whatsapp.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:underline flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              {profile.whatsapp}
                            </a>
                          ) : "-"}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={org?.id || "none"}
                            onValueChange={(value) => {
                              const newOrgId = value === "none" ? null : value;
                              changeUserOrgMutation.mutate({
                                userId: profile.user_id,
                                oldOrgId: org?.id || null,
                                newOrgId,
                              });
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue>
                                {org ? (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {org.name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">Sem organização</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  <UserX className="h-3 w-3" />
                                  Sem organização
                                </span>
                              </SelectItem>
                              {organizations?.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{getRoleBadge(role)}</TableCell>
                        <TableCell>
                          {authInfo?.last_sign_in ? (
                            <div className="flex flex-col">
                              <span>{format(new Date(authInfo.last_sign_in), "dd/MM/yyyy", { locale: ptBR })}</span>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(authInfo.last_sign_in), "HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Nunca</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Espiar usuário"
                              onClick={() => impersonateUser(profile.user_id)}
                              disabled={isImpersonating}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Reenviar credenciais (email + WhatsApp)"
                              onClick={() => handleSendCredentials(profile)}
                              disabled={sendingCredentialsFor === profile.user_id}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              {sendingCredentialsFor === profile.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Editar usuário"
                              onClick={() => openEditDialog(profile)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Excluir usuário"
                              onClick={() => setUserToDelete(profile)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Sobrenome *</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={editForm.whatsapp}
                onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })}
                placeholder="Ex: 5511999999999"
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={editForm.instagram}
                onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                placeholder="Sem @"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setEditingUser(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editForm.first_name || !editForm.last_name || isSaving}
              className="flex-1"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a excluir o usuário{" "}
              <strong>{userToDelete?.first_name} {userToDelete?.last_name}</strong>.
              <br /><br />
              Esta ação removerá todos os dados do usuário do sistema e não pode ser desfeita.
              <br /><br />
              Para confirmar, digite o nome do usuário abaixo:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder="Digite o nome para confirmar"
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => userToDelete && deleteUserMutation.mutate(userToDelete.user_id)}
              disabled={deleteConfirmText !== userToDelete?.first_name || deleteUserMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteUserMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
