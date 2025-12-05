import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Eye, Send, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface InstancePermissionsProps {
  instanceId: string;
  instanceName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OrgMember {
  user_id: string;
  role: string;
  profiles: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
}

interface InstanceUser {
  id: string;
  user_id: string;
  can_view: boolean;
  can_send: boolean;
}

export function InstancePermissions({ instanceId, instanceName, open, onOpenChange }: InstancePermissionsProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  // Fetch organization members
  const { data: orgMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["org-members-for-permissions", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from("organization_members")
        .select("user_id, role, profiles:user_id(first_name, last_name, email)")
        .eq("organization_id", profile.organization_id);

      if (error) throw error;
      return data as unknown as OrgMember[];
    },
    enabled: open && !!profile?.organization_id,
  });

  // Fetch current instance permissions
  const { data: instanceUsers, isLoading: loadingPermissions } = useQuery({
    queryKey: ["instance-permissions", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instance_users")
        .select("*")
        .eq("instance_id", instanceId);

      if (error) throw error;
      return data as InstanceUser[];
    },
    enabled: open,
  });

  // Add user to instance
  const addUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("whatsapp_instance_users")
        .insert({
          instance_id: instanceId,
          user_id: userId,
          can_view: true,
          can_send: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-permissions", instanceId] });
      toast({ title: "Usuário adicionado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    },
  });

  // Update user permissions
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ id, can_view, can_send }: { id: string; can_view?: boolean; can_send?: boolean }) => {
      const update: any = {};
      if (can_view !== undefined) update.can_view = can_view;
      if (can_send !== undefined) update.can_send = can_send;

      const { error } = await supabase
        .from("whatsapp_instance_users")
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-permissions", instanceId] });
    },
  });

  // Remove user from instance
  const removeUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_instance_users")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-permissions", instanceId] });
      toast({ title: "Usuário removido!" });
    },
  });

  const getUserPermission = (userId: string) => {
    return instanceUsers?.find((u) => u.user_id === userId);
  };

  const isLoading = loadingMembers || loadingPermissions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Permissões - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Defina quais membros da equipe podem ver e enviar mensagens
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {orgMembers?.map((member) => {
              const permission = getUserPermission(member.user_id);
              const hasAccess = !!permission;
              const memberName = member.profiles 
                ? `${member.profiles.first_name} ${member.profiles.last_name}`
                : "Usuário";

              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {memberName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{memberName}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.profiles?.email}
                      </p>
                      <Badge variant="outline" className="text-xs mt-1">
                        {member.role === "owner" ? "Dono" : member.role === "admin" ? "Admin" : "Membro"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {hasAccess ? (
                      <>
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          <Switch
                            checked={permission?.can_view || false}
                            onCheckedChange={(checked) =>
                              updatePermissionMutation.mutate({
                                id: permission!.id,
                                can_view: checked,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-muted-foreground" />
                          <Switch
                            checked={permission?.can_send || false}
                            onCheckedChange={(checked) =>
                              updatePermissionMutation.mutate({
                                id: permission!.id,
                                can_send: checked,
                              })
                            }
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => removeUserMutation.mutate(permission!.id)}
                        >
                          Remover
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addUserMutation.mutate(member.user_id)}
                        disabled={addUserMutation.isPending}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>Ver mensagens</span>
          </div>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span>Enviar mensagens</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
