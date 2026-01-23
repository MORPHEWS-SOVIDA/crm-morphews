import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";

export interface KeywordBotRouter {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  fallback_bot_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  fallback_bot?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

export interface KeywordBotRule {
  id: string;
  router_id: string;
  organization_id: string;
  keywords: string[];
  target_bot_id: string;
  priority: number;
  is_active: boolean;
  created_at: string;
  target_bot?: {
    id: string;
    name: string;
    avatar_url: string | null;
  };
}

// Fetch all keyword routers for the organization
export function useKeywordRouters() {
  const { tenantId: organizationId } = useTenant();

  return useQuery({
    queryKey: ["keyword-routers", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("keyword_bot_routers")
        .select(`
          *,
          fallback_bot:ai_bots!keyword_bot_routers_fallback_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as KeywordBotRouter[];
    },
    enabled: !!organizationId,
  });
}

// Fetch a single keyword router with its rules
export function useKeywordRouter(routerId: string | null) {
  const { tenantId: organizationId } = useTenant();

  return useQuery({
    queryKey: ["keyword-router", routerId],
    queryFn: async () => {
      if (!routerId) return null;

      const { data, error } = await supabase
        .from("keyword_bot_routers")
        .select(`
          *,
          fallback_bot:ai_bots!keyword_bot_routers_fallback_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("id", routerId)
        .single();

      if (error) throw error;
      return data as KeywordBotRouter;
    },
    enabled: !!routerId && !!organizationId,
  });
}

// Fetch rules for a specific router
export function useKeywordRouterRules(routerId: string | null) {
  const { tenantId: organizationId } = useTenant();

  return useQuery({
    queryKey: ["keyword-router-rules", routerId],
    queryFn: async () => {
      if (!routerId) return [];

      const { data, error } = await supabase
        .from("keyword_bot_rules")
        .select(`
          *,
          target_bot:ai_bots!keyword_bot_rules_target_bot_id_fkey(id, name, avatar_url)
        `)
        .eq("router_id", routerId)
        .order("priority", { ascending: false });

      if (error) throw error;
      return data as KeywordBotRule[];
    },
    enabled: !!routerId && !!organizationId,
  });
}

// Create a new keyword router
export function useCreateKeywordRouter() {
  const queryClient = useQueryClient();
  const { tenantId: organizationId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      fallback_bot_id: string;
    }) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: router, error } = await supabase
        .from("keyword_bot_routers")
        .insert({
          organization_id: organizationId,
          name: data.name,
          description: data.description,
          fallback_bot_id: data.fallback_bot_id,
        })
        .select()
        .single();

      if (error) throw error;
      return router;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-routers"] });
      toast.success("Roteador por palavras-chave criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating keyword router:", error);
      toast.error("Erro ao criar roteador por palavras-chave");
    },
  });
}

// Update a keyword router
export function useUpdateKeywordRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      fallback_bot_id?: string;
      is_active?: boolean;
    }) => {
      const { data: router, error } = await supabase
        .from("keyword_bot_routers")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return router;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["keyword-routers"] });
      queryClient.invalidateQueries({ queryKey: ["keyword-router", variables.id] });
      toast.success("Roteador atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating keyword router:", error);
      toast.error("Erro ao atualizar roteador");
    },
  });
}

// Delete a keyword router
export function useDeleteKeywordRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routerId: string) => {
      const { error } = await supabase
        .from("keyword_bot_routers")
        .delete()
        .eq("id", routerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keyword-routers"] });
      toast.success("Roteador removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting keyword router:", error);
      toast.error("Erro ao remover roteador");
    },
  });
}

// Add a rule to a router
export function useAddKeywordRule() {
  const queryClient = useQueryClient();
  const { tenantId: organizationId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      router_id: string;
      keywords: string[];
      target_bot_id: string;
      priority?: number;
    }) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const { data: rule, error } = await supabase
        .from("keyword_bot_rules")
        .insert({
          organization_id: organizationId,
          router_id: data.router_id,
          keywords: data.keywords,
          target_bot_id: data.target_bot_id,
          priority: data.priority ?? 0,
        })
        .select()
        .single();

      if (error) throw error;
      return rule;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["keyword-router-rules", variables.router_id] });
      toast.success("Regra de palavra-chave adicionada!");
    },
    onError: (error) => {
      console.error("Error adding keyword rule:", error);
      toast.error("Erro ao adicionar regra");
    },
  });
}

// Update a rule
export function useUpdateKeywordRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      router_id,
      ...data
    }: {
      id: string;
      router_id: string;
      keywords?: string[];
      target_bot_id?: string;
      priority?: number;
      is_active?: boolean;
    }) => {
      const { data: rule, error } = await supabase
        .from("keyword_bot_rules")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return { ...rule, router_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["keyword-router-rules", data.router_id] });
      toast.success("Regra atualizada!");
    },
    onError: (error) => {
      console.error("Error updating keyword rule:", error);
      toast.error("Erro ao atualizar regra");
    },
  });
}

// Delete a rule
export function useDeleteKeywordRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, router_id }: { id: string; router_id: string }) => {
      const { error } = await supabase
        .from("keyword_bot_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { router_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["keyword-router-rules", data.router_id] });
      toast.success("Regra removida!");
    },
    onError: (error) => {
      console.error("Error deleting keyword rule:", error);
      toast.error("Erro ao remover regra");
    },
  });
}
