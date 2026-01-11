import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { toast } from "sonner";

// Tipos
export interface AIBot {
  id: string;
  organization_id: string;
  name: string;
  avatar_url: string | null;
  gender: 'male' | 'female' | 'neutral';
  brazilian_state: string | null;
  age_range: '18-25' | '26-35' | '36-50' | '50+';
  service_type: 'sales' | 'support' | 'sac' | 'social_selling' | 'qualification';
  response_length: 'short' | 'medium' | 'detailed';
  company_differential: string | null;
  personality_description: string | null;
  regional_expressions: string[] | null;
  system_prompt: string;
  is_active: boolean;
  working_hours_start: string | null;
  working_hours_end: string | null;
  working_days: number[] | null;
  out_of_hours_message: string | null;
  transfer_keywords: string[] | null;
  max_messages_before_transfer: number | null;
  transfer_on_confusion: boolean | null;
  welcome_message: string | null;
  transfer_message: string | null;
  max_energy_per_message: number | null;
  max_energy_per_conversation: number | null;
  initial_qualification_enabled: boolean | null;
  initial_questions: any[] | null;
  created_at: string;
  updated_at: string;
}

export interface AIBotKnowledge {
  id: string;
  bot_id: string;
  organization_id: string;
  knowledge_type: 'faq' | 'document' | 'script' | 'custom';
  title: string | null;
  question: string | null;
  answer: string | null;
  content_url: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationEnergy {
  included_energy: number;
  bonus_energy: number;
  used_energy: number;
  available_energy: number;
  reset_at: string;
}

// Hook para listar robôs da organização
export function useAIBots() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['ai-bots', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('ai_bots')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as AIBot[];
    },
    enabled: !!tenantId,
  });
}

// Hook para obter um robô específico
export function useAIBot(botId: string | null) {
  return useQuery({
    queryKey: ['ai-bot', botId],
    queryFn: async () => {
      if (!botId) return null;
      
      const { data, error } = await supabase
        .from('ai_bots')
        .select('*')
        .eq('id', botId)
        .single();
      
      if (error) throw error;
      return data as AIBot;
    },
    enabled: !!botId,
  });
}

// Hook para criar robô
export function useCreateAIBot() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (bot: Partial<AIBot>) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('ai_bots')
        .insert({
          ...bot,
          organization_id: tenantId,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data as AIBot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-bots', tenantId] });
      toast.success('Robô criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar robô: ${error.message}`);
    },
  });
}

// Hook para atualizar robô
export function useUpdateAIBot() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AIBot> & { id: string }) => {
      const { data, error } = await supabase
        .from('ai_bots')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as AIBot;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bots', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['ai-bot', data.id] });
      toast.success('Robô atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });
}

// Hook para deletar robô
export function useDeleteAIBot() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (botId: string) => {
      const { error } = await supabase
        .from('ai_bots')
        .delete()
        .eq('id', botId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-bots', tenantId] });
      toast.success('Robô removido!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });
}

// Hook para base de conhecimento do robô
export function useAIBotKnowledge(botId: string | null) {
  return useQuery({
    queryKey: ['ai-bot-knowledge', botId],
    queryFn: async () => {
      if (!botId) return [];
      
      const { data, error } = await supabase
        .from('ai_bot_knowledge')
        .select('*')
        .eq('bot_id', botId)
        .order('priority', { ascending: true });
      
      if (error) throw error;
      return data as AIBotKnowledge[];
    },
    enabled: !!botId,
  });
}

// Hook para adicionar conhecimento
export function useAddAIBotKnowledge() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (knowledge: Partial<AIBotKnowledge>) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      
      const { data, error } = await supabase
        .from('ai_bot_knowledge')
        .insert({
          ...knowledge,
          organization_id: tenantId,
        } as any)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bot-knowledge', data.bot_id] });
      toast.success('Conhecimento adicionado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Hook para remover conhecimento
export function useRemoveAIBotKnowledge() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, botId }: { id: string; botId: string }) => {
      const { error } = await supabase
        .from('ai_bot_knowledge')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return botId;
    },
    onSuccess: (botId) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bot-knowledge', botId] });
      toast.success('Removido!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Hook para energia da organização
export function useOrganizationEnergy() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['organization-energy', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      const { data, error } = await supabase
        .rpc('get_available_energy', { p_organization_id: tenantId });
      
      if (error) throw error;
      return data as unknown as OrganizationEnergy;
    },
    enabled: !!tenantId,
    refetchInterval: 30000, // Atualizar a cada 30 segundos
  });
}

// Hook para produtos vinculados ao robô
export function useAIBotProducts(botId: string | null) {
  return useQuery({
    queryKey: ['ai-bot-products', botId],
    queryFn: async () => {
      if (!botId) return [];
      
      const { data, error } = await supabase
        .from('ai_bot_products')
        .select(`
          *,
          product:lead_products(id, name, image_url, price_1_unit)
        `)
        .eq('bot_id', botId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!botId,
  });
}

// Hook para vincular/desvincular produtos
export function useToggleAIBotProduct() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async ({ botId, productId, isLinked }: { botId: string; productId: string; isLinked: boolean }) => {
      if (!tenantId) throw new Error('Organização não encontrada');
      
      if (isLinked) {
        // Remover vínculo
        const { error } = await supabase
          .from('ai_bot_products')
          .delete()
          .eq('bot_id', botId)
          .eq('product_id', productId);
        
        if (error) throw error;
      } else {
        // Adicionar vínculo
        const { error } = await supabase
          .from('ai_bot_products')
          .insert({
            bot_id: botId,
            product_id: productId,
            organization_id: tenantId,
          });
        
        if (error) throw error;
      }
      
      return botId;
    },
    onSuccess: (botId) => {
      queryClient.invalidateQueries({ queryKey: ['ai-bot-products', botId] });
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Hook para robôs ativos em uma instância
export function useInstanceBots(instanceId: string | null) {
  return useQuery({
    queryKey: ['instance-bots', instanceId],
    queryFn: async () => {
      if (!instanceId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_instance_bots')
        .select(`
          *,
          bot:ai_bots(id, name, avatar_url, is_active)
        `)
        .eq('instance_id', instanceId);
      
      if (error) throw error;
      return data;
    },
    enabled: !!instanceId,
  });
}

// Hook para definir robô ativo na instância
export function useSetActiveInstanceBot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ instanceId, botId }: { instanceId: string; botId: string | null }) => {
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({ active_bot_id: botId })
        .eq('id', instanceId);
      
      if (error) throw error;
      return instanceId;
    },
    onSuccess: (instanceId) => {
      queryClient.invalidateQueries({ queryKey: ['evolution-instances'] });
      queryClient.invalidateQueries({ queryKey: ['instance-bots', instanceId] });
      toast.success(instanceId ? 'Robô ativado!' : 'Robô desativado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}
