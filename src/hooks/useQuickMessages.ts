import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type QuickMessage = {
  id: string;
  organization_id: string;
  title: string;
  message_text: string | null;
  media_type: "image" | "audio" | "document" | null;
  media_url: string | null;
  media_filename: string | null;
  category: string | null;
  position: number;
  is_active: boolean;
  created_at: string;
};

export function useQuickMessages() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ["quick-messages", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("quick_messages")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QuickMessage[];
    },
    enabled: !!orgId,
  });
}

export function useQuickMessagesAdmin() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["quick-messages-admin", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("quick_messages")
        .select("*")
        .eq("organization_id", orgId)
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as QuickMessage[];
    },
    enabled: !!orgId,
  });

  const createMutation = useMutation({
    mutationFn: async (msg: {
      title: string;
      message_text?: string;
      media_type?: "image" | "audio" | "document" | null;
      media_url?: string | null;
      media_filename?: string | null;
      category?: string | null;
    }) => {
      if (!orgId) throw new Error("Org not found");
      const { data, error } = await supabase
        .from("quick_messages")
        .insert({
          organization_id: orgId,
          title: msg.title,
          message_text: msg.message_text || null,
          media_type: msg.media_type || null,
          media_url: msg.media_url || null,
          media_filename: msg.media_filename || null,
          category: msg.category || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-messages-admin"] });
      queryClient.invalidateQueries({ queryKey: ["quick-messages"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuickMessage> & { id: string }) => {
      const { error } = await supabase
        .from("quick_messages")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-messages-admin"] });
      queryClient.invalidateQueries({ queryKey: ["quick-messages"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quick_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quick-messages-admin"] });
      queryClient.invalidateQueries({ queryKey: ["quick-messages"] });
    },
  });

  return {
    ...query,
    createMessage: createMutation.mutateAsync,
    updateMessage: updateMutation.mutateAsync,
    deleteMessage: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
