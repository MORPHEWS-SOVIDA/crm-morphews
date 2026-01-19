import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CallQualityScore } from './useLeadReceptiveHistory';
import { toast } from 'sonner';

export interface ReceptiveAttendanceWithDetails {
  id: string;
  organization_id: string;
  user_id: string;
  lead_id: string | null;
  phone_searched: string;
  conversation_mode: string;
  product_id: string | null;
  sale_id: string | null;
  non_purchase_reason_id: string | null;
  completed: boolean;
  purchase_potential_cents: number | null;
  created_at: string;
  call_recording_url: string | null;
  transcription: string | null;
  transcription_status: string | null;
  call_quality_score: CallQualityScore | null;
  notes: string | null;
  // Joined data
  user_name?: string;
  lead_name?: string;
  product_name?: string;
  reason_name?: string;
}

export interface ReceptiveFilters {
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  hasRecording?: 'all' | 'yes' | 'no';
  hasTranscription?: 'all' | 'yes' | 'no';
  outcome?: 'all' | 'sale' | 'no_purchase';
  nonPurchaseReasonId?: string;
  conversationMode?: string;
}

export function useReceptiveManagement(filters: ReceptiveFilters) {
  return useQuery({
    queryKey: ['receptive-management', filters],
    queryFn: async () => {
      let query = supabase
        .from('receptive_attendances')
        .select(`
          id,
          organization_id,
          user_id,
          lead_id,
          phone_searched,
          conversation_mode,
          product_id,
          sale_id,
          non_purchase_reason_id,
          completed,
          purchase_potential_cents,
          created_at,
          call_recording_url,
          transcription,
          transcription_status,
          call_quality_score,
          notes
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        // Add 1 day to include the end date
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.hasRecording === 'yes') {
        query = query.not('call_recording_url', 'is', null);
      } else if (filters.hasRecording === 'no') {
        query = query.is('call_recording_url', null);
      }
      if (filters.hasTranscription === 'yes') {
        query = query.not('transcription', 'is', null);
      } else if (filters.hasTranscription === 'no') {
        query = query.is('transcription', null);
      }
      if (filters.outcome === 'sale') {
        query = query.not('sale_id', 'is', null);
      } else if (filters.outcome === 'no_purchase') {
        query = query.is('sale_id', null);
      }
      if (filters.nonPurchaseReasonId) {
        query = query.eq('non_purchase_reason_id', filters.nonPurchaseReasonId);
      }
      if (filters.conversationMode) {
        query = query.eq('conversation_mode', filters.conversationMode);
      }

      // Limit to prevent too many results
      query = query.limit(500);

      const { data, error } = await query;

      if (error) throw error;

      // Fetch related data
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const leadIds = [...new Set((data || []).map(d => d.lead_id).filter(Boolean))];
      const productIds = [...new Set((data || []).map(d => d.product_id).filter(Boolean))];
      const reasonIds = [...new Set((data || []).map(d => d.non_purchase_reason_id).filter(Boolean))];

      // Fetch users
      const { data: users } = userIds.length > 0
        ? await supabase
            .from('profiles')
            .select('user_id, first_name, last_name')
            .in('user_id', userIds)
        : { data: [] };

      // Fetch leads
      const { data: leads } = leadIds.length > 0
        ? await supabase
            .from('leads')
            .select('id, name')
            .in('id', leadIds as string[])
        : { data: [] };

      // Fetch products
      const { data: products } = productIds.length > 0
        ? await supabase
            .from('lead_products')
            .select('id, name')
            .in('id', productIds as string[])
        : { data: [] };

      // Fetch reasons
      const { data: reasons } = reasonIds.length > 0
        ? await supabase
            .from('non_purchase_reasons')
            .select('id, name')
            .in('id', reasonIds as string[])
        : { data: [] };

      const userMap = new Map((users || []).map(u => [u.user_id, `${u.first_name} ${u.last_name}`]));
      const leadMap = new Map((leads || []).map(l => [l.id, l.name]));
      const productMap = new Map((products || []).map(p => [p.id, p.name]));
      const reasonMap = new Map((reasons || []).map(r => [r.id, r.name]));

      return (data || []).map(item => ({
        ...item,
        call_quality_score: item.call_quality_score as unknown as CallQualityScore | null,
        user_name: userMap.get(item.user_id) || 'Desconhecido',
        lead_name: item.lead_id ? leadMap.get(item.lead_id) : undefined,
        product_name: item.product_id ? productMap.get(item.product_id) : undefined,
        reason_name: item.non_purchase_reason_id ? reasonMap.get(item.non_purchase_reason_id) : undefined,
      })) as ReceptiveAttendanceWithDetails[];
    },
  });
}

export function useUpdateReceptiveAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { call_recording_url?: string; notes?: string } }) => {
      const { error } = await supabase
        .from('receptive_attendances')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptive-management'] });
      queryClient.invalidateQueries({ queryKey: ['lead-receptive-history'] });
      toast.success('Atendimento atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar atendimento');
    },
  });
}

export function useReceptiveStats(filters: ReceptiveFilters) {
  return useQuery({
    queryKey: ['receptive-stats', filters],
    queryFn: async () => {
      let query = supabase
        .from('receptive_attendances')
        .select('id, sale_id, call_recording_url, transcription, call_quality_score');

      // Apply date filters
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        const endDate = new Date(filters.dateTo);
        endDate.setDate(endDate.getDate() + 1);
        query = query.lt('created_at', endDate.toISOString());
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const total = data?.length || 0;
      const withSale = data?.filter(d => d.sale_id).length || 0;
      const withRecording = data?.filter(d => d.call_recording_url).length || 0;
      const withTranscription = data?.filter(d => d.transcription).length || 0;
      const withQualityScore = data?.filter(d => d.call_quality_score).length || 0;
      
      const avgScore = data?.filter(d => d.call_quality_score)
        .reduce((sum, d) => sum + ((d.call_quality_score as unknown as CallQualityScore)?.overall_score || 0), 0) / (withQualityScore || 1);

      return {
        total,
        withSale,
        withRecording,
        withTranscription,
        withQualityScore,
        conversionRate: total > 0 ? (withSale / total * 100).toFixed(1) : '0',
        recordingRate: total > 0 ? (withRecording / total * 100).toFixed(1) : '0',
        avgQualityScore: avgScore.toFixed(1),
      };
    },
  });
}
