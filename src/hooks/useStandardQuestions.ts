import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface StandardQuestionOption {
  id: string;
  question_id: string;
  option_text: string;
  position: number;
}

export interface StandardQuestion {
  id: string;
  organization_id: string;
  question_text: string;
  question_type: 'multiple_choice' | 'single_choice' | 'imc_calculator' | 'number' | 'text';
  category: string;
  position: number;
  is_active: boolean;
  is_system: boolean;
  options?: StandardQuestionOption[];
}

export interface LeadStandardQuestionAnswer {
  id: string;
  lead_id: string;
  question_id: string;
  organization_id: string;
  selected_option_ids: string[] | null;
  numeric_value: number | null;
  imc_weight: number | null;
  imc_height: number | null;
  imc_age: number | null;
  imc_result: number | null;
  imc_category: string | null;
  answered_by: string | null;
  created_at: string;
  updated_at: string;
}

// Fetch all standard questions with options for the organization
export function useStandardQuestions() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['standard-questions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: questions, error: questionsError } = await supabase
        .from('standard_questions')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('is_active', true)
        .order('position');

      if (questionsError) throw questionsError;
      if (!questions || questions.length === 0) return [];

      const { data: options, error: optionsError } = await supabase
        .from('standard_question_options')
        .select('*')
        .in('question_id', questions.map(q => q.id))
        .order('position');

      if (optionsError) throw optionsError;

      // Attach options to questions
      return questions.map(q => ({
        ...q,
        options: (options || []).filter(o => o.question_id === q.id)
      })) as StandardQuestion[];
    },
    enabled: !!tenantId
  });
}

// Fetch questions by category
export function useStandardQuestionsByCategory(category: string) {
  const { data: allQuestions, ...rest } = useStandardQuestions();
  
  const filteredQuestions = allQuestions?.filter(q => q.category === category) || [];
  
  return { data: filteredQuestions, ...rest };
}

// Fetch answers for a lead
export function useLeadStandardAnswers(leadId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['lead-standard-answers', leadId],
    queryFn: async () => {
      if (!leadId || !tenantId) return [];

      const { data, error } = await supabase
        .from('lead_standard_question_answers')
        .select('*')
        .eq('lead_id', leadId)
        .eq('organization_id', tenantId);

      if (error) throw error;
      return data as LeadStandardQuestionAnswer[];
    },
    enabled: !!leadId && !!tenantId
  });
}

// Upsert answers for a lead
export function useUpsertLeadStandardAnswers() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: {
      leadId: string;
      answers: Array<{
        questionId: string;
        selectedOptionIds?: string[];
        numericValue?: number;
        imcWeight?: number;
        imcHeight?: number;
        imcAge?: number;
        imcResult?: number;
        imcCategory?: string;
      }>;
    }) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const upsertData = params.answers.map(answer => ({
        lead_id: params.leadId,
        question_id: answer.questionId,
        organization_id: tenantId,
        selected_option_ids: answer.selectedOptionIds || null,
        numeric_value: answer.numericValue ?? null,
        imc_weight: answer.imcWeight ?? null,
        imc_height: answer.imcHeight ?? null,
        imc_age: answer.imcAge ?? null,
        imc_result: answer.imcResult ?? null,
        imc_category: answer.imcCategory ?? null,
        answered_by: user?.id || null,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('lead_standard_question_answers')
        .upsert(upsertData, {
          onConflict: 'lead_id,question_id',
          ignoreDuplicates: false
        });

      if (error) throw error;
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['lead-standard-answers', params.leadId] });
      toast.success('Respostas salvas com sucesso');
    },
    onError: (error) => {
      console.error('Error upserting answers:', error);
      toast.error('Erro ao salvar respostas');
    }
  });
}

// Get unique categories from questions
export function useStandardQuestionCategories() {
  const { data: questions } = useStandardQuestions();
  
  const categories = [...new Set(questions?.map(q => q.category) || [])];
  
  return categories;
}

// Category labels for display
export const CATEGORY_LABELS: Record<string, string> = {
  'dores_articulares': 'Dores Articulares',
  'emagrecimento': 'Emagrecimento',
  'diabetes': 'Diabetes',
  'saude_geral': 'Saúde Geral'
};
