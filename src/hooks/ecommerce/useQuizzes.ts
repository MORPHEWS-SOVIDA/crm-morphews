import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '../useTenant';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

export type QuizStepType = 
  | 'single_choice' 
  | 'multiple_choice' 
  | 'text_input' 
  | 'number_input' 
  | 'lead_capture' 
  | 'imc_calculator' 
  | 'result' 
  | 'info';

export type QuizCtaType = 'url' | 'whatsapp' | 'storefront' | 'product';

export type QuizEventType = 
  | 'quiz_view' 
  | 'step_view' 
  | 'step_complete' 
  | 'lead_captured' 
  | 'quiz_complete' 
  | 'cta_click' 
  | 'drop_off';

export interface QuizStepOption {
  id: string;
  step_id: string;
  organization_id: string;
  label: string;
  value: string | null;
  image_url: string | null;
  emoji: string | null;
  next_step_id: string | null;
  score: number;
  result_tag: string | null;
  position: number;
  created_at: string;
}

export interface QuizStep {
  id: string;
  quiz_id: string;
  organization_id: string;
  step_type: QuizStepType;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  video_url: string | null;
  capture_name: boolean;
  capture_email: boolean;
  capture_whatsapp: boolean;
  capture_cpf: boolean;
  result_title: string | null;
  result_description: string | null;
  result_image_url: string | null;
  result_cta_type: QuizCtaType | null;
  result_cta_url: string | null;
  result_cta_text: string;
  result_whatsapp_message: string | null;
  result_whatsapp_number: string | null;
  result_product_id: string | null;
  result_storefront_id: string | null;
  position: number;
  next_step_id: string | null;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  options?: QuizStepOption[];
}

export interface Quiz {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  primary_color: string;
  background_color: string;
  show_progress_bar: boolean;
  is_active: boolean;
  requires_lead_capture: boolean;
  default_product_id: string | null;
  default_funnel_stage_id: string | null;
  default_seller_id: string | null;
  auto_start_followup: boolean;
  followup_reason_id: string | null;
  facebook_pixel_id: string | null;
  google_analytics_id: string | null;
  tiktok_pixel_id: string | null;
  created_at: string;
  updated_at: string;
  steps?: QuizStep[];
}

export interface QuizSession {
  id: string;
  quiz_id: string;
  organization_id: string;
  visitor_fingerprint: string | null;
  lead_id: string | null;
  captured_name: string | null;
  captured_email: string | null;
  captured_whatsapp: string | null;
  captured_cpf: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_address: string | null;
  current_step_id: string | null;
  is_completed: boolean;
  completed_at: string | null;
  final_result_tag: string | null;
  total_score: number;
  started_at: string;
  updated_at: string;
}

export interface QuizEvent {
  id: string;
  quiz_id: string;
  session_id: string | null;
  step_id: string | null;
  organization_id: string;
  event_type: QuizEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QuizAnalytics {
  quiz_id: string;
  total_views: number;
  total_started: number;
  total_completed: number;
  total_leads: number;
  total_cta_clicks: number;
  completion_rate: number;
  lead_capture_rate: number;
  step_analytics: StepAnalytics[];
}

export interface StepAnalytics {
  step_id: string;
  step_title: string;
  step_position: number;
  views: number;
  completions: number;
  drop_offs: number;
  pass_rate: number;
}

// =============================================================================
// QUERY HOOKS
// =============================================================================

export function useQuizzes() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['quizzes', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('quizzes')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Quiz[];
    },
    enabled: !!tenantId,
  });
}

export function useQuiz(quizId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: async () => {
      if (!quizId || !tenantId) return null;

      // Fetch quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .eq('organization_id', tenantId)
        .single();

      if (quizError) throw quizError;

      // Fetch steps
      const { data: steps, error: stepsError } = await supabase
        .from('quiz_steps')
        .select('*')
        .eq('quiz_id', quizId)
        .order('position');

      if (stepsError) throw stepsError;

      // Fetch options for all steps
      const stepIds = steps?.map(s => s.id) || [];
      let options: QuizStepOption[] = [];
      
      if (stepIds.length > 0) {
        const { data: optionsData, error: optionsError } = await supabase
          .from('quiz_step_options')
          .select('*')
          .in('step_id', stepIds)
          .order('position');

        if (optionsError) throw optionsError;
        options = optionsData as QuizStepOption[];
      }

      // Attach options to steps
      const stepsWithOptions = steps?.map(step => ({
        ...step,
        options: options.filter(o => o.step_id === step.id),
      })) as QuizStep[];

      return {
        ...quiz,
        steps: stepsWithOptions,
      } as Quiz;
    },
    enabled: !!quizId && !!tenantId,
  });
}

export function useQuizBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['quiz-public', slug],
    queryFn: async () => {
      if (!slug) return null;

      // Fetch quiz
      const { data: quiz, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      if (quizError) throw quizError;

      // Fetch steps
      const { data: steps, error: stepsError } = await supabase
        .from('quiz_steps')
        .select('*')
        .eq('quiz_id', quiz.id)
        .order('position');

      if (stepsError) throw stepsError;

      // Fetch options for all steps
      const stepIds = steps?.map(s => s.id) || [];
      let options: QuizStepOption[] = [];
      
      if (stepIds.length > 0) {
        const { data: optionsData, error: optionsError } = await supabase
          .from('quiz_step_options')
          .select('*')
          .in('step_id', stepIds)
          .order('position');

        if (optionsError) throw optionsError;
        options = optionsData as QuizStepOption[];
      }

      // Attach options to steps
      const stepsWithOptions = steps?.map(step => ({
        ...step,
        options: options.filter(o => o.step_id === step.id),
      })) as QuizStep[];

      return {
        ...quiz,
        steps: stepsWithOptions,
      } as Quiz;
    },
    enabled: !!slug,
  });
}

export function useQuizSessions(quizId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['quiz-sessions', quizId],
    queryFn: async () => {
      if (!quizId || !tenantId) return [];

      const { data, error } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('organization_id', tenantId)
        .order('started_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as QuizSession[];
    },
    enabled: !!quizId && !!tenantId,
  });
}

export function useQuizAnalytics(quizId: string | undefined) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['quiz-analytics', quizId],
    queryFn: async () => {
      if (!quizId || !tenantId) return null;

      // Fetch all events for the quiz
      const { data: events, error: eventsError } = await supabase
        .from('quiz_events')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('organization_id', tenantId);

      if (eventsError) throw eventsError;

      // Fetch steps for this quiz
      const { data: steps, error: stepsError } = await supabase
        .from('quiz_steps')
        .select('id, title, position')
        .eq('quiz_id', quizId)
        .order('position');

      if (stepsError) throw stepsError;

      // Calculate analytics
      const quizViews = events?.filter(e => e.event_type === 'quiz_view').length || 0;
      const stepViews = events?.filter(e => e.event_type === 'step_view').length || 0;
      const totalStarted = new Set(events?.filter(e => e.session_id).map(e => e.session_id)).size;
      const totalCompleted = events?.filter(e => e.event_type === 'quiz_complete').length || 0;
      const totalLeads = events?.filter(e => e.event_type === 'lead_captured').length || 0;
      const totalCtaClicks = events?.filter(e => e.event_type === 'cta_click').length || 0;

      // Calculate step analytics
      const stepAnalytics: StepAnalytics[] = steps?.map(step => {
        const stepEvents = events?.filter(e => e.step_id === step.id) || [];
        const views = stepEvents.filter(e => e.event_type === 'step_view').length;
        const completions = stepEvents.filter(e => e.event_type === 'step_complete').length;
        const dropOffs = stepEvents.filter(e => e.event_type === 'drop_off').length;

        return {
          step_id: step.id,
          step_title: step.title,
          step_position: step.position,
          views,
          completions,
          drop_offs: dropOffs,
          pass_rate: views > 0 ? (completions / views) * 100 : 0,
        };
      }) || [];

      return {
        quiz_id: quizId,
        total_views: quizViews,
        total_started: totalStarted,
        total_completed: totalCompleted,
        total_leads: totalLeads,
        total_cta_clicks: totalCtaClicks,
        completion_rate: totalStarted > 0 ? (totalCompleted / totalStarted) * 100 : 0,
        lead_capture_rate: totalStarted > 0 ? (totalLeads / totalStarted) * 100 : 0,
        step_analytics: stepAnalytics,
      } as QuizAnalytics;
    },
    enabled: !!quizId && !!tenantId,
  });
}

// =============================================================================
// MUTATION HOOKS
// =============================================================================

export interface CreateQuizInput {
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
  background_color?: string;
}

export function useCreateQuiz() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateQuizInput) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('quizzes')
        .insert({
          organization_id: tenantId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Quiz;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar quiz');
    },
  });
}

export function useUpdateQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Quiz> & { id: string }) => {
      const { data, error } = await supabase
        .from('quizzes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Quiz;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      queryClient.invalidateQueries({ queryKey: ['quiz', data.id] });
      toast.success('Quiz atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar quiz');
    },
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quizId: string) => {
      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', quizId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      toast.success('Quiz excluído!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir quiz');
    },
  });
}

// =============================================================================
// STEP MUTATIONS
// =============================================================================

export interface CreateStepInput {
  quiz_id: string;
  step_type: QuizStepType;
  title: string;
  subtitle?: string;
  position?: number;
}

export function useCreateQuizStep() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateStepInput) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('quiz_steps')
        .insert({
          organization_id: tenantId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as QuizStep;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', data.quiz_id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar etapa');
    },
  });
}

export function useUpdateQuizStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuizStep> & { id: string }) => {
      const { data, error } = await supabase
        .from('quiz_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as QuizStep;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', data.quiz_id] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar etapa');
    },
  });
}

export function useDeleteQuizStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stepId, quizId }: { stepId: string; quizId: string }) => {
      const { error } = await supabase
        .from('quiz_steps')
        .delete()
        .eq('id', stepId);

      if (error) throw error;
      return quizId;
    },
    onSuccess: (quizId) => {
      queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir etapa');
    },
  });
}

// =============================================================================
// OPTION MUTATIONS
// =============================================================================

export interface CreateOptionInput {
  step_id: string;
  label: string;
  value?: string;
  emoji?: string;
  image_url?: string;
  score?: number;
  result_tag?: string;
  next_step_id?: string;
  position?: number;
}

export function useCreateQuizOption() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateOptionInput) => {
      if (!tenantId) throw new Error('Organização não encontrada');

      const { data, error } = await supabase
        .from('quiz_step_options')
        .insert({
          organization_id: tenantId,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as QuizStepOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar opção');
    },
  });
}

export function useUpdateQuizOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuizStepOption> & { id: string }) => {
      const { data, error } = await supabase
        .from('quiz_step_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as QuizStepOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar opção');
    },
  });
}

export function useDeleteQuizOption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (optionId: string) => {
      const { error } = await supabase
        .from('quiz_step_options')
        .delete()
        .eq('id', optionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir opção');
    },
  });
}

// =============================================================================
// SESSION & EVENT MUTATIONS (for public quiz)
// =============================================================================

export function useCreateQuizSession() {
  return useMutation({
    mutationFn: async (input: {
      quiz_id: string;
      organization_id: string;
      visitor_fingerprint?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      utm_content?: string;
      utm_term?: string;
      fbclid?: string;
      gclid?: string;
      ttclid?: string;
      referrer?: string;
      user_agent?: string;
    }) => {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data as QuizSession;
    },
  });
}

export function useUpdateQuizSession() {
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QuizSession> & { id: string }) => {
      const { data, error } = await supabase
        .from('quiz_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as QuizSession;
    },
  });
}

export function useTrackQuizEvent() {
  return useMutation({
    mutationFn: async (input: {
      quiz_id: string;
      organization_id: string;
      session_id?: string;
      step_id?: string;
      event_type: QuizEventType;
      metadata?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase
        .from('quiz_events')
        .insert([{
          quiz_id: input.quiz_id,
          organization_id: input.organization_id,
          session_id: input.session_id || null,
          step_id: input.step_id || null,
          event_type: input.event_type,
          metadata: input.metadata || {},
        }] as any)
        .select()
        .single();

      if (error) throw error;
      return data as QuizEvent;
    },
  });
}

export function useSaveQuizAnswer() {
  return useMutation({
    mutationFn: async (input: {
      session_id: string;
      step_id: string;
      organization_id: string;
      selected_option_ids?: string[];
      text_value?: string;
      numeric_value?: number;
      imc_weight?: number;
      imc_height?: number;
      imc_result?: number;
      imc_category?: string;
    }) => {
      const { data, error } = await supabase
        .from('quiz_answers')
        .upsert(input, { onConflict: 'session_id,step_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
  });
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const STEP_TYPE_LABELS: Record<QuizStepType, string> = {
  single_choice: 'Escolha Única',
  multiple_choice: 'Múltipla Escolha',
  text_input: 'Campo de Texto',
  number_input: 'Campo Numérico',
  lead_capture: 'Captura de Lead',
  imc_calculator: 'Calculadora IMC',
  result: 'Resultado Final',
  info: 'Tela Informativa',
};

export const CTA_TYPE_LABELS: Record<QuizCtaType, string> = {
  url: 'Redirecionar para URL',
  whatsapp: 'Enviar WhatsApp',
  storefront: 'Ir para Loja',
  product: 'Ver Produto',
};
