import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface CrossInstanceConversation {
  id: string;
  phone_number: string;
  instance_id: string;
  instance_name: string;
  instance_display_name: string | null;
  last_message_at: string | null;
  status: string | null;
  unread_count: number;
}

interface CrossInstanceMap {
  [phoneNumber: string]: CrossInstanceConversation[];
}

/**
 * Hook para detectar conversas do mesmo contato (phone_number) em múltiplas instâncias
 * Retorna um mapa de phone_number -> lista de conversas em outras instâncias
 */
export function useCrossInstanceConversations() {
  const { profile } = useAuth();

  return useQuery({
    queryKey: ["cross-instance-conversations", profile?.organization_id],
    queryFn: async (): Promise<CrossInstanceMap> => {
      if (!profile?.organization_id) return {};

      // Buscar todas as conversas com informações da instância
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select(`
          id,
          phone_number,
          instance_id,
          last_message_at,
          status,
          unread_count,
          whatsapp_instances!inner (
            id,
            name,
            display_name_for_team,
            organization_id
          )
        `)
        .eq("whatsapp_instances.organization_id", profile.organization_id);

      if (error) {
        console.error("Error fetching cross-instance conversations:", error);
        return {};
      }

      // Agrupar por phone_number
      const phoneMap: CrossInstanceMap = {};
      
      data?.forEach((conv: any) => {
        const phone = conv.phone_number;
        if (!phone) return;

        if (!phoneMap[phone]) {
          phoneMap[phone] = [];
        }

        phoneMap[phone].push({
          id: conv.id,
          phone_number: phone,
          instance_id: conv.instance_id,
          instance_name: conv.whatsapp_instances?.name || "Instância",
          instance_display_name: conv.whatsapp_instances?.display_name_for_team,
          last_message_at: conv.last_message_at,
          status: conv.status,
          unread_count: conv.unread_count || 0,
        });
      });

      // Filtrar apenas phone_numbers que aparecem em mais de uma instância
      const result: CrossInstanceMap = {};
      Object.entries(phoneMap).forEach(([phone, convs]) => {
        // Verificar se tem conversas em instâncias diferentes
        const uniqueInstances = new Set(convs.map(c => c.instance_id));
        if (uniqueInstances.size > 1) {
          result[phone] = convs;
        }
      });

      return result;
    },
    enabled: !!profile?.organization_id,
    staleTime: 30000, // Cache por 30 segundos
    refetchInterval: 60000, // Atualizar a cada 1 minuto
  });
}

/**
 * Helper para obter conversas de outras instâncias para um dado phone_number
 */
export function getOtherInstanceConversations(
  crossInstanceMap: CrossInstanceMap | undefined,
  phoneNumber: string,
  currentInstanceId: string
): CrossInstanceConversation[] {
  if (!crossInstanceMap || !phoneNumber) return [];
  
  const conversations = crossInstanceMap[phoneNumber] || [];
  return conversations.filter(c => c.instance_id !== currentInstanceId);
}
