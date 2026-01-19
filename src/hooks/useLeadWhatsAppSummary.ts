import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface WhatsAppMessage {
  content: string | null;
  direction: string;
  created_at: string;
}

interface LeadWhatsAppSummary {
  hasConversation: boolean;
  conversationId: string | null;
  messages: WhatsAppMessage[];
}

/**
 * Retrieves the latest WhatsApp messages for a given lead (by lead_id or phone number).
 */
export function useLeadWhatsAppSummary(leadId: string | null | undefined, phoneNumber?: string | null) {
  return useQuery({
    queryKey: ['lead-whatsapp-summary', leadId, phoneNumber],
    queryFn: async (): Promise<LeadWhatsAppSummary> => {
      // Try to find conversations by lead_id first
      let conversationIds: string[] = [];

      if (leadId) {
        const { data: byLead } = await supabase
          .from('whatsapp_conversations')
          .select('id')
          .eq('lead_id', leadId)
          .order('last_message_at', { ascending: false })
          .limit(3);

        if (byLead && byLead.length > 0) {
          conversationIds = byLead.map((c) => c.id);
        }
      }

      // If no conversations found by lead_id, try by phone number
      if (conversationIds.length === 0 && phoneNumber) {
        // Normalize phone number (remove non-digits, ensure 55 prefix)
        let normalized = phoneNumber.replace(/\D/g, '');
        if (!normalized.startsWith('55')) normalized = '55' + normalized;

        // also try with nono digito added/removed (brasileiros)
        const variants = [normalized];
        if (normalized.length === 13) {
          // Remove nono digito: 5511912345678 -> 551112345678
          variants.push(normalized.slice(0, 4) + normalized.slice(5));
        } else if (normalized.length === 12) {
          // Add nono digito: 551112345678 -> 5511912345678
          variants.push(normalized.slice(0, 4) + '9' + normalized.slice(4));
        }

        const { data: byPhone } = await supabase
          .from('whatsapp_conversations')
          .select('id')
          .or(variants.map((v) => `phone_number.eq.${v}`).join(','))
          .order('last_message_at', { ascending: false })
          .limit(3);

        if (byPhone && byPhone.length > 0) {
          conversationIds = byPhone.map((c) => c.id);
        }
      }

      if (conversationIds.length === 0) {
        return { hasConversation: false, conversationId: null, messages: [] };
      }

      // Get last 10 messages
      const { data: messages, error } = await supabase
        .from('whatsapp_messages')
        .select('content, direction, created_at')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return {
        hasConversation: true,
        conversationId: conversationIds[0],
        messages: (messages || []).reverse() as WhatsAppMessage[],
      };
    },
    enabled: !!(leadId || phoneNumber),
    staleTime: 60_000,
  });
}
