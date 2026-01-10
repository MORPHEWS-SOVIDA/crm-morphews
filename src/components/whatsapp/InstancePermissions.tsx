import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Eye, Send, Plus, Shield, Clock, RefreshCw, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    user_id: string;
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
  is_instance_admin: boolean;
  participates_in_distribution: boolean;
  is_always_available: boolean;
  available_from: string | null;
  available_until: string | null;
}

export function InstancePermissions({ instanceId, instanceName, open, onOpenChange }: InstancePermissionsProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [distributionMode, setDistributionMode] = useState<"manual" | "auto">("manual");

  // Fetch organization members
  const { data: orgMembers, isLoading: loadingMembers } = useQuery({
    queryKey: ["org-members-for-permissions", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", profile.organization_id);

      if (membersError) throw membersError;

      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      return members.map(member => ({
        user_id: member.user_id,
        role: member.role,
        profiles: profiles.find(p => p.user_id === member.user_id) || null,
      })) as OrgMember[];
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

  // Fetch instance distribution mode
  const { data: instanceSettings } = useQuery({
    queryKey: ["instance-distribution-mode", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("distribution_mode")
        .eq("id", instanceId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Update local state when settings load
  useEffect(() => {
    if (instanceSettings?.distribution_mode) {
      setDistributionMode(instanceSettings.distribution_mode as "manual" | "auto");
    }
  }, [instanceSettings]);

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
          is_instance_admin: false,
          participates_in_distribution: true,
          is_always_available: true,
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
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<InstanceUser>) => {
      const { error } = await supabase
        .from("whatsapp_instance_users")
        .update(updates)
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

  // Update instance distribution mode
  const updateDistributionModeMutation = useMutation({
    mutationFn: async (mode: "manual" | "auto") => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ distribution_mode: mode })
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-distribution-mode", instanceId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({ title: "Modo de distribuição atualizado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    },
  });

  const getUserPermission = (userId: string) => {
    return instanceUsers?.find((u) => u.user_id === userId);
  };

  const isLoading = loadingMembers || loadingPermissions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Permissões - {instanceName}
          </DialogTitle>
          <DialogDescription>
            Defina o modo de distribuição e permissões de acesso
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* SELETOR DE MODO DE DISTRIBUIÇÃO */}
            <div className="bg-muted/50 rounded-lg p-4 border-2 border-primary/20">
              <Label htmlFor="distribution-mode" className="text-base font-semibold flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                Modo de Distribuição de Conversas
              </Label>
              <Select
                value={distributionMode}
                onValueChange={(value: "manual" | "auto") => {
                  setDistributionMode(value);
                  updateDistributionModeMutation.mutate(value);
                }}
              >
                <SelectTrigger id="distribution-mode" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Todas as conversas em PENDENTES</span>
                      <span className="text-xs text-muted-foreground">Usuários escolhem qual conversa assumir</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="auto">
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">Distribuição Automática</span>
                      <span className="text-xs text-muted-foreground">Conversas entram como "Pra você" via rodízio</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {distributionMode === "manual" 
                  ? "🔵 Novas conversas aparecem na aba PENDENTES para todos os usuários. Qualquer um pode clicar em ATENDER para assumir."
                  : "⚡ Novas conversas são distribuídas automaticamente via rodízio entre usuários participantes e aparecem na aba PRA VOCÊ apenas para o designado."}
              </p>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3 overflow-y-auto flex-1 pr-2">
            {orgMembers?.map((member) => {
              const permission = getUserPermission(member.user_id);
              const hasAccess = !!permission;
              const memberName = member.profiles 
                ? `${member.profiles.first_name} ${member.profiles.last_name}`
                : "Usuário";
              const isExpanded = expandedUser === member.user_id;

              return (
                <div
                  key={member.user_id}
                  className="rounded-lg border bg-muted/30 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {memberName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{memberName}</p>
                          {permission?.is_instance_admin && (
                            <Badge variant="secondary" className="text-[10px] h-5">
                              <Shield className="h-3 w-3 mr-1" />
                              Admin
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.profiles?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasAccess ? (
                        <>
                          <div className="flex items-center gap-3 mr-2">
                            <div className="flex items-center gap-1.5" title="Ver mensagens">
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
                            <div className="flex items-center gap-1.5" title="Enviar mensagens">
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
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedUser(isExpanded ? null : member.user_id)}
                          >
                            {isExpanded ? "Menos" : "Mais"}
                          </Button>
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

                  {/* Expanded settings */}
                  {hasAccess && isExpanded && (
                    <div className="px-3 pb-3 pt-0 space-y-4 border-t bg-background/50">
                      <Separator className="mb-4" />
                      
                      {/* Admin da instância */}
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Admin desta instância
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pode ver todos os atendimentos e reatribuir leads
                          </p>
                        </div>
                        <Switch
                          checked={permission?.is_instance_admin || false}
                          onCheckedChange={(checked) =>
                            updatePermissionMutation.mutate({
                              id: permission!.id,
                              is_instance_admin: checked,
                            })
                          }
                        />
                      </div>

                      {/* Participa da distribuição - APENAS visível no modo AUTO */}
                      {distributionMode === "auto" && (
                        <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-md border border-blue-200/50 dark:border-blue-800/50">
                          <div>
                            <Label className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                              <RefreshCw className="h-4 w-4" />
                              Participa da distribuição
                            </Label>
                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                              Recebe leads automaticamente via rodízio
                            </p>
                          </div>
                          <Switch
                            checked={permission?.participates_in_distribution || false}
                            onCheckedChange={(checked) =>
                              updatePermissionMutation.mutate({
                                id: permission!.id,
                                participates_in_distribution: checked,
                              })
                            }
                          />
                        </div>
                      )}

                      {/* Horário de disponibilidade - APENAS se participa e está em AUTO */}
                      {distributionMode === "auto" && permission?.participates_in_distribution && (
                        <div className="space-y-3 pt-2 bg-blue-50/30 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200/30 dark:border-blue-800/30">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Disponível 24h
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Recebe leads a qualquer horário
                              </p>
                            </div>
                            <Switch
                              checked={permission?.is_always_available || false}
                              onCheckedChange={(checked) =>
                                updatePermissionMutation.mutate({
                                  id: permission!.id,
                                  is_always_available: checked,
                                })
                              }
                            />
                          </div>

                          {!permission?.is_always_available && (
                            <div className="flex items-center gap-4 pl-6">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`from-${member.user_id}`} className="text-sm">De:</Label>
                                <Input
                                  id={`from-${member.user_id}`}
                                  type="time"
                                  value={permission?.available_from || "08:00"}
                                  onChange={(e) =>
                                    updatePermissionMutation.mutate({
                                      id: permission!.id,
                                      available_from: e.target.value,
                                    })
                                  }
                                  className="w-28 h-8"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`until-${member.user_id}`} className="text-sm">Até:</Label>
                                <Input
                                  id={`until-${member.user_id}`}
                                  type="time"
                                  value={permission?.available_until || "18:00"}
                                  onChange={(e) =>
                                    updatePermissionMutation.mutate({
                                      id: permission!.id,
                                      available_until: e.target.value,
                                    })
                                  }
                                  className="w-28 h-8"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            </div>
          </>
        )}

        <div className="flex items-center gap-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            <span>Ver</span>
          </div>
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            <span>Enviar</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Admin = acesso total</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
