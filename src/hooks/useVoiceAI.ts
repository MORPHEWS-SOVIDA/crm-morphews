 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useTenant } from '@/hooks/useTenant';
 import { toast } from '@/hooks/use-toast';
 
 export interface VoiceAIAgent {
   id: string;
   name: string;
   description: string | null;
   elevenlabs_agent_id: string | null;
   voice_id: string | null;
   voice_name: string | null;
   welcome_message: string | null;
   system_prompt: string | null;
   first_message: string | null;
   language: string | null;
   is_active: boolean;
   organization_id: string;
   created_at: string;
 }
 
 export interface VoiceAICallLog {
   id: string;
   organization_id: string;
   agent_id: string | null;
   direction: 'inbound' | 'outbound';
   status: string;
   from_number: string;
   to_number: string;
   lead_id: string | null;
   lead_name: string | null;
   twilio_call_sid: string | null;
   started_at: string;
   answered_at: string | null;
   ended_at: string | null;
   duration_seconds: number;
   minutes_consumed: number;
   transcription: string | null;
   transcription_summary: string | null;
   sentiment: 'positive' | 'neutral' | 'negative' | null;
   outcome: string | null;
   outcome_notes: string | null;
   created_at: string;
   // Joined
   agent?: { name: string } | null;
 }
 
 export interface VoiceMinutesBalance {
   minutes_remaining: number;
   minutes_purchased: number;
   minutes_used: number;
   last_purchase_at: string | null;
 }
 
 export interface VoiceAICampaign {
   id: string;
   organization_id: string;
   agent_id: string;
   name: string;
   description: string | null;
   status: string;
   total_contacts: number;
   calls_attempted: number;
   calls_connected: number;
   calls_completed: number;
   appointments_booked: number;
   created_at: string;
   agent?: { name: string } | null;
 }
 
 // Fetch voice minutes balance
 export function useVoiceMinutesBalance() {
   const { tenantId } = useTenant();
 
   return useQuery({
     queryKey: ['voice-minutes-balance', tenantId],
     queryFn: async () => {
       if (!tenantId) return null;
 
       const { data, error } = await supabase
         .from('voice_minutes_balance')
         .select('*')
         .eq('organization_id', tenantId)
         .single();
 
       if (error && error.code !== 'PGRST116') throw error;
       return data as VoiceMinutesBalance | null;
     },
     enabled: !!tenantId,
   });
 }
 
 // Fetch call logs with filters
 export function useVoiceAICallLogs(filters?: {
   direction?: 'inbound' | 'outbound';
   status?: string;
   dateFrom?: string;
   dateTo?: string;
   limit?: number;
 }) {
   const { tenantId } = useTenant();
 
   return useQuery({
     queryKey: ['voice-ai-call-logs', tenantId, filters],
     queryFn: async () => {
       if (!tenantId) return [];
 
       let query = supabase
         .from('voice_ai_call_logs')
         .select(`
           *,
           agent:voice_ai_agents!voice_ai_call_logs_agent_id_fkey(name)
         `)
         .eq('organization_id', tenantId)
         .order('started_at', { ascending: false });
 
       if (filters?.direction) {
         query = query.eq('direction', filters.direction);
       }
       if (filters?.status) {
         query = query.eq('status', filters.status);
       }
       if (filters?.dateFrom) {
         query = query.gte('started_at', filters.dateFrom);
       }
       if (filters?.dateTo) {
         query = query.lte('started_at', filters.dateTo);
       }
       if (filters?.limit) {
         query = query.limit(filters.limit);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return (data || []) as VoiceAICallLog[];
     },
     enabled: !!tenantId,
   });
 }
 
 // Fetch call stats for dashboard
 export function useVoiceAICallStats(period: 'today' | 'week' | 'month' = 'today') {
   const { tenantId } = useTenant();
 
   return useQuery({
     queryKey: ['voice-ai-call-stats', tenantId, period],
     queryFn: async () => {
       if (!tenantId) return null;
 
       const now = new Date();
       let dateFrom: Date;
 
       switch (period) {
         case 'week':
           dateFrom = new Date(now);
           dateFrom.setDate(now.getDate() - 7);
           break;
         case 'month':
           dateFrom = new Date(now);
           dateFrom.setMonth(now.getMonth() - 1);
           break;
         default: // today
           dateFrom = new Date(now);
           dateFrom.setHours(0, 0, 0, 0);
       }
 
       const { data, error } = await supabase
         .from('voice_ai_call_logs')
         .select('direction, status, duration_seconds, minutes_consumed, outcome')
         .eq('organization_id', tenantId)
         .gte('started_at', dateFrom.toISOString());
 
       if (error) throw error;
 
       const calls = data || [];
       const inboundCalls = calls.filter(c => c.direction === 'inbound');
       const outboundCalls = calls.filter(c => c.direction === 'outbound');
       const completedCalls = calls.filter(c => c.status === 'completed');
       const appointmentsBooked = calls.filter(c => c.outcome === 'appointment_booked');
 
       return {
         totalCalls: calls.length,
         inboundCalls: inboundCalls.length,
         outboundCalls: outboundCalls.length,
         completedCalls: completedCalls.length,
         totalMinutes: calls.reduce((sum, c) => sum + (c.minutes_consumed || 0), 0),
         averageDuration: completedCalls.length > 0 
           ? Math.round(completedCalls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedCalls.length)
           : 0,
         appointmentsBooked: appointmentsBooked.length,
         answerRate: calls.length > 0 
           ? Math.round((completedCalls.length / calls.length) * 100)
           : 0,
       };
     },
     enabled: !!tenantId,
   });
 }
 
 // Fetch campaigns
 export function useVoiceAICampaigns() {
   const { tenantId } = useTenant();
 
   return useQuery({
     queryKey: ['voice-ai-campaigns', tenantId],
     queryFn: async () => {
       if (!tenantId) return [];
 
       const { data, error } = await supabase
         .from('voice_ai_outbound_campaigns')
         .select(`
           *,
           agent:voice_ai_agents!voice_ai_outbound_campaigns_agent_id_fkey(name)
         `)
         .eq('organization_id', tenantId)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
       return (data || []) as VoiceAICampaign[];
     },
     enabled: !!tenantId,
   });
 }
 
 // Fetch agents
 export function useVoiceAIAgents() {
   const { tenantId } = useTenant();
 
   return useQuery({
     queryKey: ['voice-ai-agents', tenantId],
     queryFn: async () => {
       if (!tenantId) return [];
 
       const { data, error } = await supabase
         .from('voice_ai_agents')
         .select('*')
         .eq('organization_id', tenantId)
         .order('created_at', { ascending: false });
 
       if (error) throw error;
       return (data || []) as VoiceAIAgent[];
     },
     enabled: !!tenantId,
   });
 }