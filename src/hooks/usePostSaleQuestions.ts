import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type QuestionType = 'yes_no' | 'rating_0_10' | 'text' | 'medication';

export interface PostSaleQuestion {
  id: string;
  organization_id: string;
  question: string;
  question_type: QuestionType;
  position: number;
  is_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PostSaleResponse {
  id: string;
  survey_id: string;
  question_id: string;
  organization_id: string;
  answer_text: string | null;
  answer_number: number | null;
  answer_boolean: boolean | null;
  created_at: string;
}

export const questionTypeLabels: Record<QuestionType, string> = {
  yes_no: 'Sim/Não',
  rating_0_10: 'Nota (0-10)',
  text: 'Texto livre',
  medication: 'Medicação contínua',
};

// Hook para buscar perguntas da organização
export function usePostSaleQuestions() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['post-sale-questions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('post_sale_questions')
        .select('*')
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as PostSaleQuestion[];
    },
    enabled: !!organizationId,
  });
}

// Hook para buscar apenas perguntas ativas
export function useActivePostSaleQuestions() {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['post-sale-questions-active', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('post_sale_questions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('position', { ascending: true });

      if (error) throw error;
      return (data || []) as PostSaleQuestion[];
    },
    enabled: !!organizationId,
  });
}

// Hook para criar pergunta
export function useCreatePostSaleQuestion() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      question: string;
      question_type: QuestionType;
      is_required?: boolean;
      position?: number;
    }) => {
      if (!profile?.organization_id) throw new Error('Sem organização');

      // Get max position
      const { data: existing } = await supabase
        .from('post_sale_questions')
        .select('position')
        .eq('organization_id', profile.organization_id)
        .order('position', { ascending: false })
        .limit(1);

      const maxPosition = existing?.[0]?.position ?? -1;

      const { data: result, error } = await supabase
        .from('post_sale_questions')
        .insert({
          organization_id: profile.organization_id,
          question: data.question,
          question_type: data.question_type,
          is_required: data.is_required ?? false,
          position: data.position ?? maxPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-questions'] });
      toast.success('Pergunta criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar pergunta', { description: error.message });
    },
  });
}

// Hook para atualizar pergunta
export function useUpdatePostSaleQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      question?: string;
      question_type?: QuestionType;
      is_required?: boolean;
      is_active?: boolean;
      position?: number;
    }) => {
      const { data: result, error } = await supabase
        .from('post_sale_questions')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-questions'] });
      toast.success('Pergunta atualizada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar pergunta', { description: error.message });
    },
  });
}

// Hook para deletar pergunta
export function useDeletePostSaleQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('post_sale_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-questions'] });
      toast.success('Pergunta removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover pergunta', { description: error.message });
    },
  });
}

// Hook para reordenar perguntas
export function useReorderPostSaleQuestions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      // Update positions for each question
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('post_sale_questions')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-questions'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao reordenar perguntas', { description: error.message });
    },
  });
}

// Hook para buscar respostas de um survey
export function useSurveyResponses(surveyId: string | undefined) {
  return useQuery({
    queryKey: ['post-sale-responses', surveyId],
    queryFn: async () => {
      if (!surveyId) return [];

      const { data, error } = await supabase
        .from('post_sale_responses')
        .select('*, question:post_sale_questions(*)')
        .eq('survey_id', surveyId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!surveyId,
  });
}

// Hook para salvar respostas
export function useSavePostSaleResponses() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({
      surveyId,
      responses,
    }: {
      surveyId: string;
      responses: {
        question_id: string;
        answer_text?: string | null;
        answer_number?: number | null;
        answer_boolean?: boolean | null;
      }[];
    }) => {
      if (!profile?.organization_id) throw new Error('Sem organização');

      // Upsert all responses
      const upserts = responses.map((r) => ({
        survey_id: surveyId,
        question_id: r.question_id,
        organization_id: profile.organization_id,
        answer_text: r.answer_text ?? null,
        answer_number: r.answer_number ?? null,
        answer_boolean: r.answer_boolean ?? null,
      }));

      const { error } = await supabase
        .from('post_sale_responses')
        .upsert(upserts, { onConflict: 'survey_id,question_id' });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-responses', variables.surveyId] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar respostas', { description: error.message });
    },
  });
}

// Hook para buscar todas as respostas para relatório
export function usePostSaleReport(filters?: {
  startDate?: Date;
  endDate?: Date;
  sellerId?: string;
}) {
  const { profile } = useAuth();
  const organizationId = profile?.organization_id;

  return useQuery({
    queryKey: ['post-sale-report', organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from('post_sale_surveys')
        .select(`
          *,
          sale:sales(id, romaneio_number, total_cents, delivered_at, seller_user_id),
          lead:leads(id, name, whatsapp),
          responses:post_sale_responses(*, question:post_sale_questions(*))
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('completed_at', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        query = query.lte('completed_at', filters.endDate.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by seller if needed (done client-side since it's a nested field)
      let results = data || [];
      if (filters?.sellerId) {
        results = results.filter((s: any) => s.sale?.seller_user_id === filters.sellerId);
      }

      return results;
    },
    enabled: !!organizationId,
  });
}
