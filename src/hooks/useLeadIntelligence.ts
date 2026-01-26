import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface LeadSuggestion {
  id?: string; // Database ID when persisted
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  reason: string;
  suggested_action: 'ligar' | 'whatsapp' | 'agendar';
  suggested_script: string;
  recommended_products?: string[];
  priority: 'high' | 'medium' | 'low';
  status?: 'pending' | 'used' | 'dismissed';
  feedback?: 'positive' | 'negative' | null;
}

interface GenerateSuggestionsParams {
  type: 'followup' | 'products';
  excludeLeadIds?: string[];
  limit?: number;
}

interface GenerateSuggestionsResponse {
  suggestions: LeadSuggestion[];
  energyConsumed?: number;
  error?: string;
}

export function useLeadIntelligence() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  // Query to load persisted pending suggestions
  const { data: persistedSuggestions, refetch: refetchSuggestions } = useQuery({
    queryKey: ['ai-suggestions', tenantId, user?.id],
    queryFn: async () => {
      if (!user?.id || !tenantId) return { followup: [], products: [] };

      const { data, error } = await supabase
        .from('ai_lead_suggestions')
        .select('*')
        .eq('user_id', user.id)
        .eq('organization_id', tenantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading suggestions:', error);
        return { followup: [], products: [] };
      }

      const followup: LeadSuggestion[] = [];
      const products: LeadSuggestion[] = [];

      (data || []).forEach((s: any) => {
        const suggestion: LeadSuggestion = {
          id: s.id,
          lead_id: s.lead_id,
          lead_name: s.lead_name,
          lead_whatsapp: s.lead_whatsapp || '',
          reason: s.reason,
          suggested_action: s.suggested_action || 'whatsapp',
          suggested_script: s.suggested_script || '',
          recommended_products: s.recommended_products || [],
          priority: s.priority || 'medium',
          status: s.status,
          feedback: s.feedback,
        };

        if (s.suggestion_type === 'followup') {
          followup.push(suggestion);
        } else {
          products.push(suggestion);
        }
      });

      return { followup, products };
    },
    enabled: !!tenantId && !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const followupSuggestions = persistedSuggestions?.followup || [];
  const productSuggestions = persistedSuggestions?.products || [];

  const generateMutation = useMutation({
    mutationFn: async (params: GenerateSuggestionsParams): Promise<GenerateSuggestionsResponse> => {
      if (!user?.id || !tenantId) {
        throw new Error('Usuário ou organização não encontrados');
      }

      const { data, error } = await supabase.functions.invoke('lead-intelligence', {
        body: {
          type: params.type,
          userId: user.id,
          organizationId: tenantId,
          excludeLeadIds: params.excludeLeadIds || [],
          limit: params.limit || 3,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data as GenerateSuggestionsResponse;
    },
    onSuccess: () => {
      // Refetch persisted suggestions after generating new ones
      refetchSuggestions();
    },
    onError: (error: Error) => {
      console.error('Lead intelligence error:', error);
      if (error.message.includes('Energia insuficiente')) {
        toast.error('Energia IA insuficiente. Entre em contato com o administrador.');
      } else if (error.message.includes('Rate limit') || error.message.includes('429')) {
        toast.error('Limite de requisições. Tente novamente em alguns minutos.');
      } else {
        toast.error(error.message || 'Erro ao gerar sugestões');
      }
    },
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ 
      suggestionId, 
      updates 
    }: { 
      suggestionId: string; 
      updates: { 
        status?: 'pending' | 'used' | 'dismissed'; 
        feedback?: 'positive' | 'negative';
        feedback_note?: string;
        used_at?: string;
        feedback_at?: string;
      } 
    }) => {
      const { error } = await supabase
        .from('ai_lead_suggestions')
        .update(updates)
        .eq('id', suggestionId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchSuggestions();
    },
  });

  const generateFollowupSuggestions = async () => {
    const existingIds = followupSuggestions.map(s => s.lead_id);
    const result = await generateMutation.mutateAsync({
      type: 'followup',
      excludeLeadIds: existingIds,
      limit: 3,
    });

    if (result.suggestions.length > 0) {
      toast.success(`${result.suggestions.length} sugestões geradas!`, {
        description: `Energia consumida: ${result.energyConsumed} pontos`,
      });
    } else {
      toast.info('Nenhuma nova sugestão disponível');
    }

    return result;
  };

  const generateProductSuggestions = async () => {
    const existingIds = productSuggestions.map(s => s.lead_id);
    const result = await generateMutation.mutateAsync({
      type: 'products',
      excludeLeadIds: existingIds,
      limit: 3,
    });

    if (result.suggestions.length > 0) {
      toast.success(`${result.suggestions.length} recomendações geradas!`, {
        description: `Energia consumida: ${result.energyConsumed} pontos`,
      });
    } else {
      toast.info('Nenhuma nova recomendação disponível');
    }

    return result;
  };

  const dismissSuggestion = async (suggestionId: string) => {
    await updateSuggestionMutation.mutateAsync({
      suggestionId,
      updates: { status: 'dismissed' },
    });
  };

  const markSuggestionUsed = async (suggestionId: string) => {
    await updateSuggestionMutation.mutateAsync({
      suggestionId,
      updates: { 
        status: 'used',
        used_at: new Date().toISOString(),
      },
    });
  };

  const submitFeedback = async (suggestionId: string, isUseful: boolean, note?: string) => {
    await updateSuggestionMutation.mutateAsync({
      suggestionId,
      updates: { 
        feedback: isUseful ? 'positive' : 'negative',
        feedback_note: note,
        feedback_at: new Date().toISOString(),
      },
    });
  };

  // Legacy dismiss methods for compatibility
  const dismissFollowupSuggestion = (leadId: string) => {
    const suggestion = followupSuggestions.find(s => s.lead_id === leadId);
    if (suggestion?.id) {
      dismissSuggestion(suggestion.id);
    }
  };

  const dismissProductSuggestion = (leadId: string) => {
    const suggestion = productSuggestions.find(s => s.lead_id === leadId);
    if (suggestion?.id) {
      dismissSuggestion(suggestion.id);
    }
  };

  const resetSuggestions = () => {
    // Refetch from DB to get latest state
    refetchSuggestions();
  };

  return {
    // State
    followupSuggestions,
    productSuggestions,
    isLoading: generateMutation.isPending,
    
    // Actions
    generateFollowupSuggestions,
    generateProductSuggestions,
    dismissFollowupSuggestion,
    dismissProductSuggestion,
    dismissSuggestion,
    markSuggestionUsed,
    submitFeedback,
    resetSuggestions,
    refetchSuggestions,
  };
}

// Hook for viewing suggestion history (for admin/analytics)
export function useSuggestionHistory(filters?: {
  userId?: string;
  type?: 'followup' | 'products';
  status?: 'pending' | 'used' | 'dismissed';
  limit?: number;
}) {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['suggestion-history', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('ai_lead_suggestions')
        .select('*')
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.type) {
        query = query.eq('suggestion_type', filters.type);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading suggestion history:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!tenantId,
  });
}
