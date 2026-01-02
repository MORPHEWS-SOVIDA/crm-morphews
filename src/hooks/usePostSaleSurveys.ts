import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type PostSaleSurveyStatus = 'pending' | 'completed' | 'attempted';
export type DeliveryType = 'motoboy' | 'carrier' | 'counter';

export interface PostSaleSurvey {
  id: string;
  sale_id: string;
  lead_id: string;
  organization_id: string;
  status: PostSaleSurveyStatus;
  
  // Fixed questions
  received_order: boolean | null;
  knows_how_to_use: boolean | null;
  seller_rating: number | null;
  
  // Continuous medication
  uses_continuous_medication: boolean | null;
  continuous_medication_details: string | null;
  
  // Delivery-specific
  delivery_type: DeliveryType | null;
  delivery_rating: number | null;
  
  // Metadata
  notes: string | null;
  attempted_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  
  created_at: string;
  updated_at: string;
  
  // Joined data
  sale?: {
    id: string;
    total_cents: number;
    delivered_at: string | null;
    seller_user_id: string | null;
    delivery_type: string | null;
    created_at: string;
  };
  lead?: {
    id: string;
    name: string;
    whatsapp: string;
    instagram: string | null;
  };
  completed_by_profile?: {
    first_name: string;
    last_name: string;
  };
}

export interface CreatePostSaleSurveyData {
  sale_id: string;
  lead_id: string;
  delivery_type?: DeliveryType;
}

export interface UpdatePostSaleSurveyData {
  received_order?: boolean;
  knows_how_to_use?: boolean;
  seller_rating?: number;
  uses_continuous_medication?: boolean;
  continuous_medication_details?: string;
  delivery_type?: DeliveryType;
  delivery_rating?: number;
  notes?: string;
  status?: PostSaleSurveyStatus;
}

// Get all pending post-sale surveys
export function usePendingPostSaleSurveys() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['post-sale-surveys', 'pending', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('post_sale_surveys')
        .select(`
          *,
          sale:sales!sale_id(
            id,
            total_cents,
            delivered_at,
            seller_user_id,
            delivery_type,
            created_at
          ),
          lead:leads!lead_id(
            id,
            name,
            whatsapp,
            instagram
          )
        `)
        .eq('organization_id', tenantId)
        .in('status', ['pending', 'attempted'])
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PostSaleSurvey[];
    },
    enabled: !!tenantId,
  });
}

// Get all post-sale surveys (for history)
export function useAllPostSaleSurveys() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['post-sale-surveys', 'all', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('post_sale_surveys')
        .select(`
          *,
          sale:sales!sale_id(
            id,
            total_cents,
            delivered_at,
            seller_user_id,
            delivery_type,
            created_at
          ),
          lead:leads!lead_id(
            id,
            name,
            whatsapp,
            instagram
          )
        `)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PostSaleSurvey[];
    },
    enabled: !!tenantId,
  });
}

// Get post-sale surveys for a specific lead
export function useLeadPostSaleSurveys(leadId: string | undefined) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['post-sale-surveys', 'lead', leadId, tenantId],
    queryFn: async () => {
      if (!tenantId || !leadId) return [];
      
      const { data, error } = await supabase
        .from('post_sale_surveys')
        .select(`
          *,
          sale:sales!sale_id(
            id,
            total_cents,
            delivered_at,
            seller_user_id,
            delivery_type,
            created_at
          )
        `)
        .eq('organization_id', tenantId)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PostSaleSurvey[];
    },
    enabled: !!tenantId && !!leadId,
  });
}

// Get a single post-sale survey
export function usePostSaleSurvey(surveyId: string | undefined) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['post-sale-survey', surveyId, tenantId],
    queryFn: async () => {
      if (!tenantId || !surveyId) return null;
      
      const { data, error } = await supabase
        .from('post_sale_surveys')
        .select(`
          *,
          sale:sales!sale_id(
            id,
            total_cents,
            delivered_at,
            seller_user_id,
            delivery_type,
            created_at
          ),
          lead:leads!lead_id(
            id,
            name,
            whatsapp,
            instagram
          )
        `)
        .eq('id', surveyId)
        .single();
      
      if (error) throw error;
      return data as PostSaleSurvey;
    },
    enabled: !!tenantId && !!surveyId,
  });
}

// Create a new post-sale survey
export function useCreatePostSaleSurvey() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  
  return useMutation({
    mutationFn: async (data: CreatePostSaleSurveyData) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data: survey, error } = await supabase
        .from('post_sale_surveys')
        .insert({
          organization_id: tenantId,
          sale_id: data.sale_id,
          lead_id: data.lead_id,
          delivery_type: data.delivery_type || null,
          status: 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      return survey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-surveys'] });
    },
    onError: (error: any) => {
      // Ignore duplicate errors silently
      if (error.code !== '23505') {
        toast.error('Erro ao criar pesquisa pós-venda', { description: error.message });
      }
    },
  });
}

// Update a post-sale survey
export function useUpdatePostSaleSurvey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdatePostSaleSurveyData & { id: string }) => {
      const updateData: Record<string, unknown> = { ...data };
      
      // Set timestamps based on status
      if (data.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = user?.id || null;
      } else if (data.status === 'attempted') {
        updateData.attempted_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('post_sale_surveys')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-surveys'] });
      queryClient.invalidateQueries({ queryKey: ['post-sale-survey'] });
      toast.success('Pesquisa atualizada!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar pesquisa', { description: error.message });
    },
  });
}

// Delete a post-sale survey
export function useDeletePostSaleSurvey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('post_sale_surveys')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-surveys'] });
      toast.success('Pesquisa removida!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover pesquisa', { description: error.message });
    },
  });
}

// Get status label
export function getPostSaleSurveyStatusLabel(status: PostSaleSurveyStatus): string {
  switch (status) {
    case 'pending': return 'Pendente';
    case 'attempted': return 'Tentativa';
    case 'completed': return 'Concluída';
    default: return status;
  }
}

// Get status color
export function getPostSaleSurveyStatusColor(status: PostSaleSurveyStatus): string {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'attempted': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-gray-100 text-gray-800';
  }
}

// Get delivery type label
export function getDeliveryTypeLabel(type: DeliveryType | null | undefined): string {
  switch (type) {
    case 'motoboy': return 'Motoboy';
    case 'carrier': return 'Transportadora';
    case 'counter': return 'Balcão';
    default: return 'Não definido';
  }
}
