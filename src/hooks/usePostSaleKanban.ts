import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export type PostSaleContactStatus = 
  | 'pending'
  | 'attempted_1'
  | 'attempted_2'
  | 'attempted_3'
  | 'sent_whatsapp'
  | 'callback_later'
  | 'completed_call'
  | 'completed_whatsapp'
  | 'refused'
  | 'not_needed';

export interface PostSaleSale {
  id: string;
  lead_id: string;
  total_cents: number;
  delivered_at: string | null;
  created_at: string;
  seller_user_id: string | null;
  post_sale_contact_status: PostSaleContactStatus | null;
  romaneio_number: number | null;
  lead?: {
    id: string;
    name: string;
    whatsapp: string;
    specialty: string | null;
  };
  seller?: {
    first_name: string;
    last_name: string;
  };
}

export const POST_SALE_COLUMNS: { 
  id: PostSaleContactStatus; 
  label: string; 
  color: string; 
  bgColor: string;
}[] = [
  { 
    id: 'pending', 
    label: 'Prontas p/ Pós-Venda', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-50 dark:bg-blue-900/20' 
  },
  { 
    id: 'attempted_1', 
    label: 'Tentei 1º contato', 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-50 dark:bg-orange-900/20' 
  },
  { 
    id: 'attempted_2', 
    label: 'Tentei 2º contato', 
    color: 'text-orange-700', 
    bgColor: 'bg-orange-50 dark:bg-orange-900/20' 
  },
  { 
    id: 'attempted_3', 
    label: 'Tentei 3º contato', 
    color: 'text-red-700', 
    bgColor: 'bg-red-50 dark:bg-red-900/20' 
  },
  { 
    id: 'sent_whatsapp', 
    label: 'Enviei WhatsApp', 
    color: 'text-green-700', 
    bgColor: 'bg-green-50 dark:bg-green-900/20' 
  },
  { 
    id: 'callback_later', 
    label: 'Retornar mais tarde', 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20' 
  },
  { 
    id: 'completed_call', 
    label: 'Pós-venda por ligação ✓', 
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' 
  },
  { 
    id: 'completed_whatsapp', 
    label: 'Pós-venda por WhatsApp ✓', 
    color: 'text-emerald-700', 
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' 
  },
  { 
    id: 'refused', 
    label: 'Cliente recusou', 
    color: 'text-gray-700', 
    bgColor: 'bg-gray-50 dark:bg-gray-900/20' 
  },
  { 
    id: 'not_needed', 
    label: 'Sem necessidade', 
    color: 'text-slate-700', 
    bgColor: 'bg-slate-50 dark:bg-slate-900/20' 
  },
];

export function usePostSaleSales() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['post-sale-sales', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Fetch sales that are delivered OR payment_confirmed
      const { data, error } = await supabase
        .from('sales')
        .select(`
          id,
          lead_id,
          total_cents,
          delivered_at,
          created_at,
          seller_user_id,
          post_sale_contact_status,
          romaneio_number,
          lead:leads!lead_id(
            id,
            name,
            whatsapp,
            specialty
          )
        `)
        .eq('organization_id', tenantId)
        .in('status', ['delivered', 'payment_confirmed'])
        .order('delivered_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      
      // Get seller profiles
      const sellerIds = [...new Set((data || []).map(s => s.seller_user_id).filter(Boolean))];
      let sellerProfiles: Record<string, { first_name: string; last_name: string }> = {};
      
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', sellerIds);
        
        if (profiles) {
          sellerProfiles = profiles.reduce((acc, p) => {
            acc[p.user_id] = { first_name: p.first_name, last_name: p.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }
      
      // Map sales with seller info
      return (data || []).map(sale => ({
        ...sale,
        post_sale_contact_status: sale.post_sale_contact_status || 'pending',
        seller: sale.seller_user_id ? sellerProfiles[sale.seller_user_id] : undefined
      })) as PostSaleSale[];
    },
    enabled: !!tenantId,
  });
}

export function useUpdatePostSaleStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ saleId, status }: { saleId: string; status: PostSaleContactStatus }) => {
      const { error } = await supabase
        .from('sales')
        .update({ post_sale_contact_status: status })
        .eq('id', saleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post-sale-sales'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar status', { description: error.message });
    },
  });
}

export function getPostSaleStatusLabel(status: PostSaleContactStatus): string {
  const column = POST_SALE_COLUMNS.find(c => c.id === status);
  return column?.label || status;
}
