import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CallQualityScore {
  // Individual scores 1-10
  proper_greeting_score: number;
  asked_needs_score: number;
  followed_script_score: number;
  offered_kits_score: number;
  handled_objections_score: number;
  clear_next_steps_score: number;
  // Legacy boolean fields (for backward compatibility)
  followed_script?: boolean;
  offered_kits?: boolean;
  proper_greeting?: boolean;
  asked_needs?: boolean;
  handled_objections?: boolean;
  clear_next_steps?: boolean;
  // Overall
  overall_score: number;
  summary: string;
  improvements: string[];
}

export interface ReceptiveHistoryItem {
  id: string;
  user_id: string;
  conversation_mode: string;
  product_id: string | null;
  sale_id: string | null;
  non_purchase_reason_id: string | null;
  completed: boolean;
  purchase_potential_cents: number | null;
  created_at: string;
  // Recording fields
  call_recording_url: string | null;
  recording_storage_path: string | null;
  // Transcription fields
  transcription: string | null;
  transcription_status: string | null;
  call_quality_score: CallQualityScore | null;
  notes: string | null;
  // Product answers from the attendance
  product_answers: Record<string, string> | null;
  // Joined data
  user_name?: string;
  product_name?: string;
  reason_name?: string;
  // Source info (from lead_source_history around same time)
  source_name?: string;
}

export function useLeadReceptiveHistory(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-receptive-history', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      
      const { data, error } = await supabase
        .from('receptive_attendances')
        .select(`
          id,
          user_id,
          conversation_mode,
          product_id,
          sale_id,
          non_purchase_reason_id,
          completed,
          purchase_potential_cents,
          created_at,
          call_recording_url,
          recording_storage_path,
          transcription,
          transcription_status,
          call_quality_score,
          notes,
          product_answers
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch related data
      const userIds = [...new Set((data || []).map(d => d.user_id))];
      const productIds = [...new Set((data || []).map(d => d.product_id).filter(Boolean))];
      const reasonIds = [...new Set((data || []).map(d => d.non_purchase_reason_id).filter(Boolean))];

      // Fetch users
      const { data: users } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);

      // Fetch products
      const { data: products } = productIds.length > 0 
        ? await supabase
            .from('lead_products')
            .select('id, name')
            .in('id', productIds)
        : { data: [] };

      // Fetch reasons
      const { data: reasons } = reasonIds.length > 0
        ? await supabase
            .from('non_purchase_reasons')
            .select('id, name')
            .in('id', reasonIds as string[])
        : { data: [] };

      // Fetch source history for this lead to match with attendance timestamps
      const { data: sourceHistory } = await supabase
        .from('lead_source_history')
        .select('source_id, recorded_at')
        .eq('lead_id', leadId)
        .order('recorded_at', { ascending: false });

      // Fetch source names
      const sourceIds = [...new Set((sourceHistory || []).map(s => s.source_id))];
      const { data: sources } = sourceIds.length > 0
        ? await supabase.from('lead_sources').select('id, name').in('id', sourceIds)
        : { data: [] };
      const sourceNameMap = new Map((sources || []).map(s => [s.id, s.name]));

      const userMap = new Map((users || []).map(u => [u.user_id, `${u.first_name} ${u.last_name}`]));
      const productMap = new Map((products || []).map(p => [p.id, p.name]));
      const reasonMap = new Map((reasons || []).map(r => [r.id, r.name]));

      // Match source history entries to attendances by closest timestamp
      const findSourceForAttendance = (attendanceDate: string) => {
        if (!sourceHistory || sourceHistory.length === 0) return undefined;
        const aTime = new Date(attendanceDate).getTime();
        // Find closest source entry within 5 minutes
        let best: typeof sourceHistory[0] | null = null;
        let bestDiff = Infinity;
        for (const sh of sourceHistory) {
          const diff = Math.abs(new Date(sh.recorded_at).getTime() - aTime);
          if (diff < bestDiff && diff < 5 * 60 * 1000) {
            bestDiff = diff;
            best = sh;
          }
        }
        return best ? sourceNameMap.get(best.source_id) : undefined;
      };

      return (data || []).map(item => ({
        ...item,
        call_quality_score: item.call_quality_score as unknown as CallQualityScore | null,
        product_answers: item.product_answers as unknown as Record<string, string> | null,
        user_name: userMap.get(item.user_id) || 'Desconhecido',
        product_name: item.product_id ? productMap.get(item.product_id) : undefined,
        reason_name: item.non_purchase_reason_id ? reasonMap.get(item.non_purchase_reason_id) : undefined,
        source_name: findSourceForAttendance(item.created_at),
      })) as ReceptiveHistoryItem[];
    },
    enabled: !!leadId,
  });
}
