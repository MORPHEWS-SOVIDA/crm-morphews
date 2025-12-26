import { useState } from "react";
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
import { Users, Loader2, Pencil, Trash2, Building2, Search, UserX, Mail, Phone } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
      case "member":
        return <Badge variant="secondary">Membro</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const filteredProfiles = allProfiles?.filter(profile => {
    const fullName = `${profile.first_name} ${profile.last_name}`.toLowerCase();
    const email = profile.email?.toLowerCase() || "";
    const org = getOrgForUser(profile.user_id);
    const orgName = org?.name.toLowerCase() || "";
    const search = searchTerm.toLowerCase();

    return fullName.includes(search) || email.includes(search) || orgName.includes(search);
  });

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
        <CardHeader>
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
                    <TableHead>Email</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles?.map((profile) => {
                    const org = getOrgForUser(profile.user_id);
                    const role = getRoleForUser(profile.user_id);

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
                          {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
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
