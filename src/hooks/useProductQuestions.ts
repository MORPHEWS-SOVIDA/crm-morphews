import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface ProductQuestion {
  id: string;
  product_id: string;
  organization_id: string;
  question_text: string;
  position: number;
  created_at: string;
}

export interface LeadQuestionAnswer {
  id: string;
  lead_id: string;
  product_id: string;
  question_id: string;
  organization_id: string;
  answer_text: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadQuestionAnswerWithDetails extends LeadQuestionAnswer {
  question?: ProductQuestion;
  updated_by_profile?: {
    first_name: string;
    last_name: string;
  } | null;
}

// Get questions for a specific product
export function useProductQuestions(productId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-questions', productId],
    queryFn: async () => {
      if (!productId || !tenantId) return [];

      const { data, error } = await supabase
        .from('product_questions')
        .select('*')
        .eq('product_id', productId)
        .order('position');

      if (error) throw error;
      return data as ProductQuestion[];
    },
    enabled: !!productId && !!tenantId,
  });
}

// Get all questions for all products (for bulk operations)
export function useAllProductQuestions(productIds: string[]) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['product-questions-bulk', productIds],
    queryFn: async () => {
      if (!productIds.length || !tenantId) return [];

      const { data, error } = await supabase
        .from('product_questions')
        .select('*')
        .in('product_id', productIds)
        .order('position');

      if (error) throw error;
      return data as ProductQuestion[];
    },
    enabled: productIds.length > 0 && !!tenantId,
  });
}

// Create a new question
export function useCreateProductQuestion() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ productId, questionText, position }: { 
      productId: string; 
      questionText: string; 
      position: number 
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('product_questions')
        .insert({
          product_id: productId,
          organization_id: tenantId,
          question_text: questionText,
          position,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ProductQuestion;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-questions', variables.productId] });
    },
  });
}

// Update a question
export function useUpdateProductQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, questionText, position }: { 
      id: string; 
      questionText: string;
      position?: number;
    }) => {
      const updateData: Partial<ProductQuestion> = { question_text: questionText };
      if (position !== undefined) updateData.position = position;

      const { data, error } = await supabase
        .from('product_questions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductQuestion;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['product-questions', data.product_id] });
    },
  });
}

// Delete a question
export function useDeleteProductQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
      const { error } = await supabase
        .from('product_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ['product-questions', productId] });
    },
  });
}

// Bulk save questions (for form submission)
export function useSaveProductQuestions() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async ({ 
      productId, 
      questions 
    }: { 
      productId: string; 
      questions: { id?: string; question_text: string; position: number }[] 
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      // Get existing questions
      const { data: existing } = await supabase
        .from('product_questions')
        .select('id')
        .eq('product_id', productId);

      const existingIds = existing?.map(q => q.id) || [];
      const newQuestionIds = questions.filter(q => q.id).map(q => q.id);
      
      // Delete removed questions
      const toDelete = existingIds.filter(id => !newQuestionIds.includes(id));
      if (toDelete.length > 0) {
        await supabase
          .from('product_questions')
          .delete()
          .in('id', toDelete);
      }

      // Upsert questions
      for (const question of questions) {
        if (question.id) {
          // Update existing
          await supabase
            .from('product_questions')
            .update({
              question_text: question.question_text,
              position: question.position,
            })
            .eq('id', question.id);
        } else {
          // Insert new
          await supabase
            .from('product_questions')
            .insert({
              product_id: productId,
              organization_id: tenantId,
              question_text: question.question_text,
              position: question.position,
            });
        }
      }

      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ['product-questions', productId] });
    },
  });
}

// ============ Answer hooks ============

// Get all answers for a lead (grouped by product)
export function useLeadQuestionAnswers(leadId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-question-answers', leadId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_product_question_answers')
        .select(`
          *,
          question:product_questions(*)
        `)
        .eq('lead_id', leadId)
        .eq('organization_id', tenantId);

      if (error) throw error;

      // Fetch profiles for updated_by
      const updatedByIds = [...new Set((data || []).map(a => a.updated_by).filter(Boolean))] as string[];
      let profiles: Record<string, { first_name: string; last_name: string }> = {};

      if (updatedByIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', updatedByIds);

        if (profilesData) {
          profiles = profilesData.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      return (data || []).map(answer => ({
        ...answer,
        updated_by_profile: answer.updated_by ? profiles[answer.updated_by] : null,
      })) as LeadQuestionAnswerWithDetails[];
    },
    enabled: !!leadId && !!tenantId,
  });
}

// Get answers for a specific lead-product combination
export function useLeadProductQuestionAnswers(leadId: string | undefined, productId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-product-question-answers', leadId, productId],
    queryFn: async () => {
      if (!leadId || !productId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_product_question_answers')
        .select(`
          *,
          question:product_questions(*)
        `)
        .eq('lead_id', leadId)
        .eq('product_id', productId)
        .eq('organization_id', tenantId);

      if (error) throw error;
      return data as LeadQuestionAnswerWithDetails[];
    },
    enabled: !!leadId && !!productId && !!tenantId,
  });
}

// Upsert answers for a lead-product
export function useUpsertLeadQuestionAnswers() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      leadId, 
      productId, 
      answers 
    }: { 
      leadId: string; 
      productId: string; 
      answers: { questionId: string; answerText: string | null }[] 
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      for (const answer of answers) {
        await supabase
          .from('lead_product_question_answers')
          .upsert({
            lead_id: leadId,
            product_id: productId,
            question_id: answer.questionId,
            organization_id: tenantId,
            answer_text: answer.answerText,
            updated_by: user?.id || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'lead_id,question_id',
          });
      }

      return { leadId, productId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-question-answers', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-product-question-answers', variables.leadId, variables.productId] });
      toast.success('Respostas salvas com sucesso!');
    },
    onError: (error) => {
      console.error('Error saving answers:', error);
      toast.error('Erro ao salvar respostas');
    },
  });
}

// Delete all answers for a lead-product
export function useDeleteLeadProductQuestionAnswers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, productId }: { leadId: string; productId: string }) => {
      const { error } = await supabase
        .from('lead_product_question_answers')
        .delete()
        .eq('lead_id', leadId)
        .eq('product_id', productId);

      if (error) throw error;
      return { leadId, productId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-question-answers', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['lead-product-question-answers', variables.leadId, variables.productId] });
      toast.success('Respostas removidas');
    },
    onError: (error) => {
      console.error('Error deleting answers:', error);
      toast.error('Erro ao remover respostas');
    },
  });
}
