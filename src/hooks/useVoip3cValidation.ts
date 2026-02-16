import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface Voip3cConfig {
  id: string;
  organization_id: string;
  blacklist_numbers: string[];
  cnpj_numbers: string[];
  created_at: string;
  updated_at: string;
}

export interface Call3cData {
  number: string;
  queue_name: string;
  source_queue_name: string;
  created_at: string;
  readable_status_text: string;
  product_interest: string;
  loss_reason: string;
  agent_name: string;
  speaking_time_seconds: number;
}

export interface MatchedAttendance {
  receptive_id: string;
  lead_id: string | null;
  user_name: string;
  conversation_mode: string;
  lead_name: string;
  lead_stage: string;
  product_name: string;
  sale_id: string | null;
  sale_total_cents: number | null;
  sale_status: string | null;
  reason_name: string;
  completed: boolean;
  attendance_created_at: string;
}

export interface LeadOnlyMatch {
  lead_id: string;
  lead_name: string;
  lead_stage: string;
  lead_whatsapp: string;
  followup_reason: string | null;
  followup_scheduled_at: string | null;
  responsible_name: string | null;
}

export interface ValidationResult {
  callsWithoutRecord: Call3cData[];
  callsWithRecordNoSale: Array<Call3cData & MatchedAttendance>;
  callsWithRecordAndSale: Array<Call3cData & MatchedAttendance>;
  callsWithLeadOnly: Array<Call3cData & LeadOnlyMatch>;
}

export interface Voip3cValidation {
  id: string;
  organization_id: string;
  uploaded_by: string;
  file_name: string;
  total_calls: number;
  calls_without_record: number;
  calls_with_record_no_sale: number;
  validation_data: ValidationResult;
  created_at: string;
}

export function useVoip3cConfig() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['voip-3c-config', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      
      const { data, error } = await supabase
        .from('voip_3c_config')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .maybeSingle();
      
      if (error) throw error;
      return data as Voip3cConfig | null;
    },
    enabled: !!profile?.organization_id,
  });
}

export function useSaveVoip3cConfig() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  
  return useMutation({
    mutationFn: async (config: { blacklist_numbers: string[]; cnpj_numbers: string[] }) => {
      if (!profile?.organization_id) throw new Error('Organização não encontrada');
      
      const { error } = await supabase
        .from('voip_3c_config')
        .upsert({
          organization_id: profile.organization_id,
          blacklist_numbers: config.blacklist_numbers,
          cnpj_numbers: config.cnpj_numbers,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-3c-config'] });
      toast.success('Configuração salva!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar configuração');
    },
  });
}

export function useVoip3cValidations() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['voip-3c-validations', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('voip_3c_validations')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        validation_data: item.validation_data as unknown as ValidationResult,
      })) as Voip3cValidation[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useSaveVoip3cValidation() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async (validation: {
      file_name: string;
      total_calls: number;
      calls_without_record: number;
      calls_with_record_no_sale: number;
      validation_data: ValidationResult;
    }) => {
      if (!profile?.organization_id || !user?.id) throw new Error('Autenticação necessária');
      
      const insertData = {
        organization_id: profile.organization_id,
        uploaded_by: user.id,
        file_name: validation.file_name,
        total_calls: validation.total_calls,
        calls_without_record: validation.calls_without_record,
        calls_with_record_no_sale: validation.calls_with_record_no_sale,
        validation_data: JSON.parse(JSON.stringify(validation.validation_data)),
      };
      
      const { error } = await supabase
        .from('voip_3c_validations')
        .insert([insertData]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voip-3c-validations'] });
      toast.success('Validação salva!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar validação');
    },
  });
}

/**
 * Fuzzy phone matching: compares last N digits (at least 8).
 * Handles cases where CSV has "51989423022" and DB has "5551989423022".
 */
export function phonesMatch(csvPhone: string, dbPhone: string): boolean {
  const a = csvPhone.replace(/\D/g, '');
  const b = dbPhone.replace(/\D/g, '');
  if (!a || !b) return false;
  
  // Exact match
  if (a === b) return true;
  
  // One contains the other
  if (a.endsWith(b) || b.endsWith(a)) return true;
  
  // Compare last 10 digits (area code + number)
  const minLen = Math.min(a.length, b.length, 10);
  if (minLen >= 8) {
    return a.slice(-minLen) === b.slice(-minLen);
  }
  
  return false;
}

// Parse CSV with semicolon separator
export function parseCsv3c(csvContent: string): Call3cData[] {
  const lines = csvContent.split('\n');
  if (lines.length < 2) return [];
  
  const header = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
  
  // Find column indices
  const numberIdx = header.indexOf('number');
  const queueNameIdx = header.indexOf('queue_name');
  const createdAtIdx = header.indexOf('created_at');
  const statusIdx = header.indexOf('readable_status_text');
  const agentNameIdx = header.indexOf('agent_name');
  const speakingTimeIdx = header.indexOf('speaking_with_agent_time');
  
  // Find source queue name (in mailing_data.data.queue_name)
  const sourceQueueIdx = header.findIndex(h => h.includes('mailing_data.data.queue_name'));
  // Find product interest
  const productIdx = header.findIndex(h => h.includes('interesse no produto'));
  // Find loss reason
  const lossReasonIdx = header.findIndex(h => h.includes('motivo da perda'));
  
  const calls: Call3cData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line respecting quotes
    const values = parseCsvLine(line);
    
    if (values.length <= numberIdx) continue;
    
    const number = values[numberIdx]?.replace(/"/g, '').trim();
    if (!number) continue;
    
    const speakingRaw = speakingTimeIdx >= 0 ? values[speakingTimeIdx]?.replace(/"/g, '').trim() || '0' : '0';
    calls.push({
      number: normalizePhone(number),
      queue_name: values[queueNameIdx]?.replace(/"/g, '').trim() || '',
      source_queue_name: sourceQueueIdx >= 0 ? values[sourceQueueIdx]?.replace(/"/g, '').trim() || '' : '',
      created_at: values[createdAtIdx]?.replace(/"/g, '').trim() || '',
      readable_status_text: values[statusIdx]?.replace(/"/g, '').trim() || '',
      product_interest: productIdx >= 0 ? values[productIdx]?.replace(/"/g, '').trim() || '' : '',
      loss_reason: lossReasonIdx >= 0 ? values[lossReasonIdx]?.replace(/"/g, '').trim() || '' : '',
      agent_name: values[agentNameIdx]?.replace(/"/g, '').trim() || '',
      speaking_time_seconds: parseSpeakingTime(speakingRaw),
    });
  }
  
  return calls;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ';' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  
  return values;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Parse speaking time from various formats: seconds number, "HH:MM:SS", "MM:SS" */
function parseSpeakingTime(raw: string): number {
  if (!raw || raw === '0') return 0;
  // If it contains ":", parse as time
  if (raw.includes(':')) {
    const parts = raw.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }
  return parseInt(raw) || 0;
}

/** Format seconds to readable MM:SS or HH:MM:SS */
export function formatSpeakingTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function parseDate3c(dateStr: string): Date | null {
  // Format: "31/01/2026 09:59:31"
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  
  const [, day, month, year, hour, minute, second] = match;
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

export const CONVERSATION_MODE_LABELS: Record<string, string> = {
  receptive_call: 'Ligação Receptiva',
  active_call: 'Ligação Ativa',
  receptive_whatsapp: 'WhatsApp Receptivo',
  active_whatsapp: 'WhatsApp Ativo',
  receptive_instagram: 'Instagram Receptivo',
  active_instagram: 'Instagram Ativo',
  counter: 'Balcão',
  email: 'E-mail',
};
