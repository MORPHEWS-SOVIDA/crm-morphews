import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Eye, Send, Shield, Clock, RefreshCw, Zap, Trash2, Bot, Hand } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InstanceBotSchedulesManager } from "./InstanceBotSchedulesManager";

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
  const [distributionMode, setDistributionMode] = useState<"bot" | "manual" | "auto">("manual");
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(5);

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

  // Fetch instance distribution mode and settings
  const { data: instanceSettings } = useQuery({
    queryKey: ["instance-distribution-mode", instanceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("distribution_mode, redistribution_timeout_minutes")
        .eq("id", instanceId)
        .single();

      if (error) throw error;
      return data as { 
        distribution_mode: string | null; 
        redistribution_timeout_minutes: number | null;
      };
    },
    enabled: open,
  });

  // Update local state when settings load
  useEffect(() => {
    if (instanceSettings?.distribution_mode) {
      setDistributionMode(instanceSettings.distribution_mode as "bot" | "manual" | "auto");
    }
    if (instanceSettings?.redistribution_timeout_minutes !== undefined && instanceSettings?.redistribution_timeout_minutes !== null) {
      setTimeoutMinutes(instanceSettings.redistribution_timeout_minutes);
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
    mutationFn: async (mode: "bot" | "manual" | "auto") => {
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

  // Update redistribution timeout
  const updateTimeoutMutation = useMutation({
    mutationFn: async (minutes: number) => {
      const { error } = await supabase
        .from("whatsapp_instances")
        .update({ redistribution_timeout_minutes: minutes })
        .eq("id", instanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instance-distribution-mode", instanceId] });
      toast({ title: "Timeout de redistribuição atualizado!" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar timeout", description: error.message, variant: "destructive" });
    },
  });

  const getUserPermission = (userId: string) => {
    return instanceUsers?.find((u) => u.user_id === userId);
  };

  // Get users with access
  const usersWithAccess = orgMembers?.filter(m => getUserPermission(m.user_id)) || [];
  const usersWithoutAccess = orgMembers?.filter(m => !getUserPermission(m.user_id)) || [];

  const isLoading = loadingMembers || loadingPermissions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Permissões – {instanceName}
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
          <div className="space-y-4 overflow-y-auto flex-1">
            {/* SELETOR DE MODO DE DISTRIBUIÇÃO */}
            <div className="bg-muted/50 rounded-lg p-4 border-2 border-primary/20">
              <Label htmlFor="distribution-mode" className="text-base font-semibold flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                Modo de Distribuição de Conversas
              </Label>
              <Select
                value={distributionMode}
                onValueChange={(value: "bot" | "manual" | "auto") => {
                  setDistributionMode(value);
                  updateDistributionModeMutation.mutate(value);
                }}
              >
                <SelectTrigger id="distribution-mode" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bot">
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-purple-600" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Robô de IA</span>
                        <span className="text-xs text-muted-foreground">O robô atende primeiro e qualifica os leads</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Distribuição Automática</span>
                        <span className="text-xs text-muted-foreground">Conversas entram como "Pra você" via rodízio</span>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="manual">
                    <div className="flex items-center gap-2">
                      <Hand className="h-4 w-4 text-amber-600" />
                      <div className="flex flex-col items-start">
                        <span className="font-semibold">Todas as conversas em PENDENTES</span>
                        <span className="text-xs text-muted-foreground">Usuários escolhem qual conversa assumir</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {distributionMode === "bot" 
                  ? "🤖 Novas conversas vão para o ROBÔ DE IA. Ele atende, qualifica e transfere para um humano quando necessário."
                  : distributionMode === "auto"
                    ? "⚡ Novas conversas são distribuídas automaticamente via rodízio entre usuários participantes e aparecem na aba PRA VOCÊ apenas para o designado."
                    : "🔵 Novas conversas aparecem na aba PENDENTES para todos os usuários. Qualquer um pode clicar em ATENDER para assumir."}
              </p>

              {/* Aviso sobre robô */}
              {distributionMode === "bot" && (
                <div className="mt-4 pt-4 border-t border-purple-200 dark:border-purple-800 space-y-2">
                  <div className="flex items-center gap-3 bg-purple-100/50 dark:bg-purple-950/50 p-3 rounded-md">
                    <Bot className="h-4 w-4 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Configure os robôs abaixo</p>
                      <p className="text-xs text-purple-700 dark:text-purple-300">Adicione robôs de IA com horários de funcionamento na seção "Robôs IA com Agendamento"</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Configurações adicionais para modo auto */}
              {distributionMode === "auto" && (
                <div className="mt-4 pt-4 border-t border-primary/10 space-y-4">
                  {/* Visibilidade */}
                  <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-950/30 p-3 rounded-md">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Visibilidade: Só o designado vê</p>
                      <p className="text-xs text-blue-700 dark:text-blue-300">Conversas auto-distribuídas ficam visíveis apenas para o vendedor designado</p>
                    </div>
                  </div>

                  {/* Timeout de redistribuição */}
                  <div className="flex items-center gap-3 bg-amber-50/50 dark:bg-amber-950/30 p-3 rounded-md">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Redistribuição automática</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">Se não atender, passa para próximo vendedor após:</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={timeoutMinutes}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 5;
                          setTimeoutMinutes(value);
                        }}
                        onBlur={() => {
                          updateTimeoutMutation.mutate(timeoutMinutes);
                        }}
                        className="w-16 h-8 text-center"
                      />
                      <span className="text-sm text-amber-700 dark:text-amber-300">minutos</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Robôs IA com Agendamento */}
            <div className="bg-purple-50/50 dark:bg-purple-950/30 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-800">
              <InstanceBotSchedulesManager 
                instanceId={instanceId} 
                distributionMode={distributionMode}
                onRequestBotMode={() => {
                  setDistributionMode("bot");
                  updateDistributionModeMutation.mutate("bot");
                }}
              />
            </div>

            {/* Adicionar usuário */}
            {usersWithoutAccess.length > 0 && (
              <div className="flex items-center gap-3">
                <Label className="shrink-0">Adicionar usuário:</Label>
                <Select onValueChange={(userId) => addUserMutation.mutate(userId)}>
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usersWithoutAccess.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.profiles 
                          ? `${member.profiles.first_name} ${member.profiles.last_name}`
                          : member.profiles?.email || "Usuário"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Tabela de permissões */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[180px]">Usuário</TableHead>
                    <TableHead className="text-center w-[70px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <Eye className="h-4 w-4" />
                        <span className="text-[10px]">Ver</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-[70px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <Send className="h-4 w-4" />
                        <span className="text-[10px]">Enviar</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-center w-[90px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <Shield className="h-4 w-4" />
                        <span className="text-[10px]">Admin</span>
                      </div>
                    </TableHead>
                    {distributionMode === "auto" && (
                      <>
                        <TableHead className="text-center w-[90px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <RefreshCw className="h-4 w-4" />
                            <span className="text-[10px]">Participa</span>
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-[200px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <Clock className="h-4 w-4" />
                            <span className="text-[10px]">Disponibilidade</span>
                          </div>
                        </TableHead>
                      </>
                    )}
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersWithAccess.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={distributionMode === "auto" ? 7 : 5} className="text-center py-8 text-muted-foreground">
                        Nenhum usuário adicionado
                      </TableCell>
                    </TableRow>
                  ) : (
                    usersWithAccess.map((member) => {
                      const permission = getUserPermission(member.user_id)!;
                      const memberName = member.profiles 
                        ? `${member.profiles.first_name} ${member.profiles.last_name}`
                        : "Usuário";

                      return (
                        <TableRow key={member.user_id}>
                          {/* Usuário */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                  {memberName.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{memberName}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {member.profiles?.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Ver */}
                          <TableCell className="text-center">
                            <Switch
                              checked={permission.can_view}
                              onCheckedChange={(checked) =>
                                updatePermissionMutation.mutate({
                                  id: permission.id,
                                  can_view: checked,
                                })
                              }
                            />
                          </TableCell>

                          {/* Enviar */}
                          <TableCell className="text-center">
                            <Switch
                              checked={permission.can_send}
                              onCheckedChange={(checked) =>
                                updatePermissionMutation.mutate({
                                  id: permission.id,
                                  can_send: checked,
                                })
                              }
                            />
                          </TableCell>

                          {/* Admin */}
                          <TableCell className="text-center">
                            <Switch
                              checked={permission.is_instance_admin}
                              onCheckedChange={(checked) =>
                                updatePermissionMutation.mutate({
                                  id: permission.id,
                                  is_instance_admin: checked,
                                })
                              }
                            />
                          </TableCell>

                          {distributionMode === "auto" && (
                            <>
                              {/* Participa da distribuição */}
                              <TableCell className="text-center">
                                <Switch
                                  checked={permission.participates_in_distribution}
                                  onCheckedChange={(checked) =>
                                    updatePermissionMutation.mutate({
                                      id: permission.id,
                                      participates_in_distribution: checked,
                                    })
                                  }
                                />
                              </TableCell>

                              {/* Disponibilidade */}
                              <TableCell className="text-center">
                                {permission.participates_in_distribution ? (
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <Switch
                                        checked={permission.is_always_available}
                                        onCheckedChange={(checked) =>
                                          updatePermissionMutation.mutate({
                                            id: permission.id,
                                            is_always_available: checked,
                                          })
                                        }
                                        className="scale-75"
                                      />
                                      <span className="text-[10px] text-muted-foreground">24h</span>
                                    </div>
                                    {!permission.is_always_available && (
                                      <div className="flex items-center gap-1">
                                        <Input
                                          type="time"
                                          value={permission.available_from || "08:00"}
                                          onChange={(e) =>
                                            updatePermissionMutation.mutate({
                                              id: permission.id,
                                              available_from: e.target.value,
                                            })
                                          }
                                          className="w-[70px] h-6 text-[10px] px-1"
                                        />
                                        <span className="text-[10px]">-</span>
                                        <Input
                                          type="time"
                                          value={permission.available_until || "18:00"}
                                          onChange={(e) =>
                                            updatePermissionMutation.mutate({
                                              id: permission.id,
                                              available_until: e.target.value,
                                            })
                                          }
                                          className="w-[70px] h-6 text-[10px] px-1"
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </>
                          )}

                          {/* Remover */}
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => removeUserMutation.mutate(permission.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
              <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Ver = visualizar conversas</span>
              <span className="flex items-center gap-1"><Send className="h-3 w-3" /> Enviar = enviar mensagens</span>
              <span className="flex items-center gap-1"><Shield className="h-3 w-3" /> Admin = acesso total + reatribuir</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
