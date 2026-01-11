import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export interface InstanceBotSchedule {
  id: string;
  instance_id: string;
  bot_id: string;
  organization_id: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  bot?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export function useInstanceBotSchedules(instanceId: string | null) {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["instance-bot-schedules", instanceId],
    queryFn: async () => {
      if (!instanceId) return [];

      const { data, error } = await supabase
        .from("instance_bot_schedules")
        .select(`
          *,
          bot:ai_bots(id, name, avatar_url)
        `)
        .eq("instance_id", instanceId)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as InstanceBotSchedule[];
    },
    enabled: !!instanceId,
  });
}

export function useAddInstanceBotSchedule() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      instanceId,
      botId,
      daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
      startTime = "00:00",
      endTime = "23:59",
      priority = 0,
    }: {
      instanceId: string;
      botId: string;
      daysOfWeek?: number[];
      startTime?: string;
      endTime?: string;
      priority?: number;
    }) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      // Inserir o agendamento do robô
      const { error } = await supabase.from("instance_bot_schedules").insert({
        instance_id: instanceId,
        bot_id: botId,
        organization_id: profile.organization_id,
        days_of_week: daysOfWeek,
        start_time: startTime,
        end_time: endTime,
        priority,
        is_active: true,
      });

      if (error) throw error;

      // Automaticamente atualizar o distribution_mode para 'bot' 
      // quando um robô é adicionado à instância
      const { error: updateError } = await supabase
        .from("whatsapp_instances")
        .update({ distribution_mode: "bot" })
        .eq("id", instanceId);

      if (updateError) {
        console.error("Erro ao atualizar distribution_mode:", updateError);
        // Não falhar a operação, apenas logar o erro
      }

      return { instanceId };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instance-bot-schedules", variables.instanceId] });
      queryClient.invalidateQueries({ queryKey: ["instance-distribution-mode", variables.instanceId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances"] });
      toast({ 
        title: "Robô agendado com sucesso!",
        description: "O modo de distribuição foi alterado para Robô de IA automaticamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao agendar robô",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateInstanceBotSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      instanceId,
      ...updates
    }: {
      id: string;
      instanceId: string;
      days_of_week?: number[];
      start_time?: string;
      end_time?: string;
      priority?: number;
      is_active?: boolean;
    }) => {
      const { error } = await supabase
        .from("instance_bot_schedules")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instance-bot-schedules", variables.instanceId] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar agendamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useRemoveInstanceBotSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, instanceId }: { id: string; instanceId: string }) => {
      const { error } = await supabase.from("instance_bot_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["instance-bot-schedules", variables.instanceId] });
      toast({ title: "Agendamento removido!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover agendamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
