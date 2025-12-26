import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface LeadProductAnswer {
  id: string;
  lead_id: string;
  product_id: string;
  organization_id: string;
  answer_1: string | null;
  answer_2: string | null;
  answer_3: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadProductAnswerWithProduct extends LeadProductAnswer {
  product?: {
    id: string;
    name: string;
    key_question_1: string | null;
    key_question_2: string | null;
    key_question_3: string | null;
  };
}

export interface AnswerFormData {
  lead_id: string;
  product_id: string;
  answer_1?: string | null;
  answer_2?: string | null;
  answer_3?: string | null;
}

// Get all answers for a specific lead
export function useLeadAnswers(leadId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-product-answers', leadId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_product_answers')
        .select(`
          *,
          product:lead_products(id, name, key_question_1, key_question_2, key_question_3)
        `)
        .eq('lead_id', leadId)
        .eq('organization_id', tenantId);

      if (error) throw error;
      return data as LeadProductAnswerWithProduct[];
    },
    enabled: !!leadId && !!tenantId,
  });
}

// Get answer for a specific lead-product combination
export function useLeadProductAnswer(leadId: string | undefined, productId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-product-answer', leadId, productId],
    queryFn: async () => {
      if (!leadId || !productId || !tenantId) return null;

      const { data, error } = await supabase
        .from('lead_product_answers')
        .select('*')
        .eq('lead_id', leadId)
        .eq('product_id', productId)
        .eq('organization_id', tenantId)
        .maybeSingle();

      if (error) throw error;
      return data as LeadProductAnswer | null;
    },
    enabled: !!leadId && !!productId && !!tenantId,
  });
}

// Get all answers for a specific product (across all leads)
export function useProductAnswers(productId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-answers', productId],
    queryFn: async () => {
      if (!productId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_product_answers')
        .select(`
          *,
          lead:leads(id, name, whatsapp, email)
        `)
        .eq('product_id', productId)
        .eq('organization_id', tenantId);

      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!tenantId,
  });
}

// Upsert (create or update) an answer
export function useUpsertLeadProductAnswer() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (formData: AnswerFormData) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('lead_product_answers')
        .upsert({
          lead_id: formData.lead_id,
          product_id: formData.product_id,
          organization_id: tenantId,
          answer_1: formData.answer_1 || null,
          answer_2: formData.answer_2 || null,
          answer_3: formData.answer_3 || null,
        }, {
          onConflict: 'lead_id,product_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-product-answers', variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['lead-product-answer', variables.lead_id, variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ['product-answers', variables.product_id] });
      toast.success('Respostas salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving answers:', error);
      toast.error('Erro ao salvar respostas');
    },
  });
}

// Delete an answer
export function useDeleteLeadProductAnswer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, productId }: { leadId: string; productId: string }) => {
      const { error } = await supabase
        .from('lead_product_answers')
        .delete()
        .eq('lead_id', leadId)
        .eq('product_id', productId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-product-answers', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-product-answer', variables.leadId, variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-answers', variables.productId] });
      toast.success('Respostas removidas');
    },
    onError: (error) => {
      console.error('Error deleting answers:', error);
      toast.error('Erro ao remover respostas');
    },
  });
}
