import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsSupabase } from "@/integrations/agents-supabase/client";
import { toast } from "sonner";

export interface Agent {
  id: string;
  organization_id: string;
  name: string;
  system_prompt: string | null;
  personality: string;
  welcome_message: string | null;
  is_active: boolean;
  max_messages: number;
  created_at: string;
}

export interface AgentFormData {
  name: string;
  personality: string;
  system_prompt: string;
  welcome_message: string;
  max_messages: number;
}

export function useAgentsIA(organizationId?: string) {
  return useQuery({
    queryKey: ["agents-ia", organizationId],
    queryFn: async () => {
      let query = agentsSupabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Agent[];
    },
    enabled: !!organizationId,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agent: AgentFormData & { organization_id: string }) => {
      const { data, error } = await agentsSupabase
        .from("agents")
        .insert(agent)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents-ia"] });
      toast.success("Agente criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar agente: " + error.message);
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Agent> & { id: string }) => {
      const { data, error } = await agentsSupabase
        .from("agents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents-ia"] });
      toast.success("Agente atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await agentsSupabase
        .from("agents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents-ia"] });
      toast.success("Agente removido!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}
