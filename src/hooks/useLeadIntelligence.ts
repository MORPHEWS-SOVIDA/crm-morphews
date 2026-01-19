import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface LeadSuggestion {
  lead_id: string;
  lead_name: string;
  lead_whatsapp: string;
  reason: string;
  suggested_action: 'ligar' | 'whatsapp' | 'agendar';
  suggested_script: string;
  recommended_products?: string[];
  priority: 'high' | 'medium' | 'low';
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
  const [followupSuggestions, setFollowupSuggestions] = useState<LeadSuggestion[]>([]);
  const [productSuggestions, setProductSuggestions] = useState<LeadSuggestion[]>([]);
  const [shownFollowupIds, setShownFollowupIds] = useState<string[]>([]);
  const [shownProductIds, setShownProductIds] = useState<string[]>([]);

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

  const generateFollowupSuggestions = async () => {
    const result = await generateMutation.mutateAsync({
      type: 'followup',
      excludeLeadIds: shownFollowupIds,
      limit: 3,
    });

    if (result.suggestions.length > 0) {
      setFollowupSuggestions(prev => [...prev, ...result.suggestions]);
      setShownFollowupIds(prev => [...prev, ...result.suggestions.map(s => s.lead_id)]);
      toast.success(`${result.suggestions.length} sugestões geradas!`, {
        description: `Energia consumida: ${result.energyConsumed} pontos`,
      });
    } else {
      toast.info('Nenhuma nova sugestão disponível');
    }

    return result;
  };

  const generateProductSuggestions = async () => {
    const result = await generateMutation.mutateAsync({
      type: 'products',
      excludeLeadIds: shownProductIds,
      limit: 3,
    });

    if (result.suggestions.length > 0) {
      setProductSuggestions(prev => [...prev, ...result.suggestions]);
      setShownProductIds(prev => [...prev, ...result.suggestions.map(s => s.lead_id)]);
      toast.success(`${result.suggestions.length} recomendações geradas!`, {
        description: `Energia consumida: ${result.energyConsumed} pontos`,
      });
    } else {
      toast.info('Nenhuma nova recomendação disponível');
    }

    return result;
  };

  const dismissFollowupSuggestion = (leadId: string) => {
    setFollowupSuggestions(prev => prev.filter(s => s.lead_id !== leadId));
  };

  const dismissProductSuggestion = (leadId: string) => {
    setProductSuggestions(prev => prev.filter(s => s.lead_id !== leadId));
  };

  const resetSuggestions = () => {
    setFollowupSuggestions([]);
    setProductSuggestions([]);
    setShownFollowupIds([]);
    setShownProductIds([]);
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
    resetSuggestions,
  };
}
