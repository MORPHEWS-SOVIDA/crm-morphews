import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';
import { toast } from '@/hooks/use-toast';

// =============================================================================
// TIPOS
// =============================================================================

export interface Contact {
  id: string;
  organization_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_activity_at: string | null;
  // Joined data
  identities?: ContactIdentity[];
  primary_phone?: string;
  threads_count?: number;
}

export interface ContactIdentity {
  id: string;
  contact_id: string;
  type: 'phone' | 'email' | 'instagram' | 'linkedin' | 'other';
  value: string;
  value_normalized: string;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
}

export interface ContactWithThreads extends Contact {
  threads: Array<{
    id: string;
    channel_id: string;
    status: string;
    last_message_at: string | null;
    unread_count: number;
  }>;
}

// =============================================================================
// HOOKS - CONTACTS
// =============================================================================

/**
 * Hook para listar contatos do tenant
 */
export function useContacts(options?: { 
  search?: string;
  limit?: number;
  orderBy?: 'last_activity_at' | 'created_at' | 'full_name';
}) {
  const { data: tenantId } = useCurrentTenantId();
  const { search, limit = 50, orderBy = 'last_activity_at' } = options || {};

  return useQuery({
    queryKey: ['contacts', tenantId, search, limit, orderBy],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('contacts')
        .select(`
          *,
          identities:contact_identities(*)
        `)
        .eq('organization_id', tenantId)
        .limit(limit);

      // Ordenação
      if (orderBy === 'last_activity_at') {
        query = query.order('last_activity_at', { ascending: false, nullsFirst: false });
      } else if (orderBy === 'created_at') {
        query = query.order('created_at', { ascending: false });
      } else {
        query = query.order('full_name', { ascending: true, nullsFirst: false });
      }

      // Busca por nome
      if (search) {
        query = query.ilike('full_name', `%${search}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching contacts:', error);
        throw error;
      }

      return (data || []).map((contact: any) => ({
        ...contact,
        identities: contact.identities || [],
        primary_phone: contact.identities?.find((i: any) => i.type === 'phone' && i.is_primary)?.value ||
                       contact.identities?.find((i: any) => i.type === 'phone')?.value,
      })) as Contact[];
    },
    enabled: !!tenantId,
  });
}

/**
 * Hook para obter um contato específico
 */
export function useContact(contactId: string | null) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          identities:contact_identities(*)
        `)
        .eq('id', contactId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching contact:', error);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        identities: data.identities || [],
        primary_phone: data.identities?.find((i: any) => i.type === 'phone' && i.is_primary)?.value ||
                       data.identities?.find((i: any) => i.type === 'phone')?.value,
      } as Contact;
    },
    enabled: !!contactId,
  });
}

/**
 * Hook para buscar contato por telefone
 */
export function useSearchContactByPhone(phone: string | null) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['contact-by-phone', tenantId, phone],
    queryFn: async () => {
      if (!tenantId || !phone) return null;

      const { data, error } = await supabase.rpc('find_contact_by_phone', {
        _organization_id: tenantId,
        _phone: phone,
      });

      if (error) {
        console.error('Error finding contact by phone:', error);
        return null;
      }

      if (!data) return null;

      // Buscar o contato completo
      const { data: contact } = await supabase
        .from('contacts')
        .select(`*, identities:contact_identities(*)`)
        .eq('id', data)
        .maybeSingle();

      return contact as Contact | null;
    },
    enabled: !!tenantId && !!phone,
  });
}

/**
 * Hook para obter contato com todas as threads
 */
export function useContactWithThreads(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-with-threads', contactId],
    queryFn: async () => {
      if (!contactId) return null;

      // Buscar contato
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select(`*, identities:contact_identities(*)`)
        .eq('id', contactId)
        .maybeSingle();

      if (contactError || !contact) {
        console.error('Error fetching contact:', contactError);
        return null;
      }

      // Buscar threads do contato
      const { data: threads, error: threadsError } = await supabase
        .from('whatsapp_conversations')
        .select(`
          id,
          instance_id,
          status,
          last_message_at,
          unread_count,
          contact_name,
          channel:whatsapp_instances!instance_id (
            name,
            provider,
            phone_number
          )
        `)
        .eq('contact_id', contactId)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (threadsError) {
        console.error('Error fetching contact threads:', threadsError);
      }

      return {
        ...contact,
        identities: contact.identities || [],
        primary_phone: contact.identities?.find((i: any) => i.type === 'phone' && i.is_primary)?.value ||
                       contact.identities?.find((i: any) => i.type === 'phone')?.value,
        threads: (threads || []).map((t: any) => ({
          id: t.id,
          channel_id: t.instance_id,
          status: t.status || 'open',
          last_message_at: t.last_message_at,
          unread_count: t.unread_count,
          channel: t.channel,
        })),
      } as ContactWithThreads;
    },
    enabled: !!contactId,
  });
}

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Hook para criar contato
 */
export function useCreateContact() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      fullName,
      email,
      phone,
    }: {
      fullName?: string;
      email?: string;
      phone?: string;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Se temos telefone, usar a função RPC que já cria a identidade
      if (phone) {
        const { data: contactId, error } = await supabase.rpc('get_or_create_contact_by_phone', {
          _organization_id: tenantId,
          _phone: phone,
          _name: fullName || null,
        });

        if (error) throw error;

        // Atualizar email se fornecido
        if (email && contactId) {
          await supabase
            .from('contacts')
            .update({ email })
            .eq('id', contactId);
        }

        return { id: contactId };
      }

      // Criar contato sem telefone
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          organization_id: tenantId,
          full_name: fullName,
          email,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: 'Contato criado',
        description: 'O contato foi adicionado com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar contato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para atualizar contato
 */
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      fullName,
      email,
      avatarUrl,
      metadata,
    }: {
      contactId: string;
      fullName?: string;
      email?: string;
      avatarUrl?: string;
      metadata?: Record<string, any>;
    }) => {
      const updates: any = {};
      if (fullName !== undefined) updates.full_name = fullName;
      if (email !== undefined) updates.email = email;
      if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
      if (metadata !== undefined) updates.metadata = metadata;

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contactId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact', variables.contactId] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: 'Contato atualizado',
        description: 'As alterações foram salvas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar contato',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para adicionar identidade a um contato
 */
export function useAddContactIdentity() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      contactId,
      type,
      value,
      isPrimary = false,
    }: {
      contactId: string;
      type: 'phone' | 'email' | 'instagram' | 'linkedin' | 'other';
      value: string;
      isPrimary?: boolean;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Normalizar valor
      let valueNormalized = value;
      if (type === 'phone') {
        valueNormalized = value.replace(/\D/g, '');
        if (valueNormalized.length <= 11 && !valueNormalized.startsWith('55')) {
          valueNormalized = '55' + valueNormalized;
        }
      } else if (type === 'email') {
        valueNormalized = value.toLowerCase().trim();
      }

      const { data, error } = await supabase
        .from('contact_identities')
        .insert({
          organization_id: tenantId,
          contact_id: contactId,
          type,
          value,
          value_normalized: valueNormalized,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact', variables.contactId] });
      toast({
        title: 'Identidade adicionada',
        description: 'A nova identidade foi adicionada ao contato.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao adicionar identidade',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

/**
 * Hook para executar backfill de contatos
 */
export function useBackfillContacts() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async () => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase.rpc('backfill_contacts_from_existing_conversations', {
        _organization_id: tenantId,
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast({
        title: 'Migração concluída',
        description: `${count} conversas foram vinculadas a contatos.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro na migração',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
