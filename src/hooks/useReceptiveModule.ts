import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/error-message';

export interface ReceptiveAttendance {
  id: string;
  organization_id: string;
  user_id: string;
  lead_id: string | null;
  phone_searched: string;
  lead_existed: boolean;
  conversation_mode: string;
  product_id: string | null;
  product_answers: Record<string, string> | null;
  sale_id: string | null;
  non_purchase_reason_id: string | null;
  purchase_potential_cents: number | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export const CONVERSATION_MODES = [
  { value: 'receptive_call', label: 'Ligação Receptiva' },
  { value: 'active_call', label: 'Ligação Ativa' },
  { value: 'receptive_whatsapp', label: 'WhatsApp Receptivo' },
  { value: 'active_whatsapp', label: 'WhatsApp Ativo' },
  { value: 'receptive_instagram', label: 'Instagram Receptivo' },
  { value: 'active_instagram', label: 'Instagram Ativo' },
  { value: 'counter', label: 'Balcão' },
  { value: 'email', label: 'E-mail' },
] as const;

export function useReceptiveModuleAccess() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receptive-module-access', user?.id],
    queryFn: async () => {
      if (!user) return { hasAccess: false, orgEnabled: false, userEnabled: false };

      // Check if organization has the module enabled
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('receptive_module_enabled')
        .single();

      if (orgError) {
        console.error('Error checking org receptive module:', orgError);
        return { hasAccess: false, orgEnabled: false, userEnabled: false };
      }

      const orgEnabled = orgData?.receptive_module_enabled ?? false;
      if (!orgEnabled) {
        return { hasAccess: false, orgEnabled: false, userEnabled: false };
      }

      // Check if user has access
      const { data: permData, error: permError } = await supabase
        .from('user_permissions')
        .select('receptive_module_access')
        .eq('user_id', user.id)
        .single();

      if (permError && permError.code !== 'PGRST116') {
        console.error('Error checking user receptive permission:', permError);
      }

      const userEnabled = permData?.receptive_module_access ?? false;

      return {
        hasAccess: orgEnabled && userEnabled,
        orgEnabled,
        userEnabled,
      };
    },
    enabled: !!user,
  });
}

export function useSearchLeadByPhone() {
  return useMutation({
    mutationFn: async (phone: string) => {
      // Normalize phone: ensure it starts with 55
      let normalizedPhone = phone.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55')) {
        normalizedPhone = '55' + normalizedPhone;
      }

      // Search for lead by whatsapp or secondary_phone
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, whatsapp, email, instagram, specialty, 
          lead_source, stage, stars, observations,
          cep, street, street_number, complement, neighborhood, city, state,
          secondary_phone, cpf_cnpj, created_at
        `)
        .or(`whatsapp.eq.${normalizedPhone},secondary_phone.eq.${normalizedPhone}`)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return { lead: data, phoneSearched: normalizedPhone };
    },
  });
}

export function useCreateReceptiveAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (attendance: Omit<ReceptiveAttendance, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('receptive_attendances')
        .insert(attendance)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptive-attendances'] });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Erro ao criar atendimento',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateReceptiveAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ReceptiveAttendance> }) => {
      const { data, error } = await supabase
        .from('receptive_attendances')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receptive-attendances'] });
    },
  });
}

export function useMyReceptiveAttendances() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['receptive-attendances', 'my', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('receptive_attendances')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as ReceptiveAttendance[];
    },
    enabled: !!user,
  });
}
