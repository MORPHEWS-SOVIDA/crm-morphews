import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export type SacTicketStatus = 'pending' | 'open' | 'in_progress' | 'resolved' | 'closed';
export type SacTicketPriority = 'low' | 'normal' | 'high';
export type SacCategory = 'complaint' | 'question' | 'request' | 'financial';
export type SacTicketSource = 'manual' | 'integration' | 'whatsapp';

export interface SacTicket {
  id: string;
  organization_id: string;
  lead_id: string;
  sale_id: string | null;
  created_by: string;
  status: SacTicketStatus;
  priority: SacTicketPriority;
  category: SacCategory;
  subcategory: string;
  description: string;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  lead?: {
    id: string;
    name: string;
    whatsapp: string;
  };
  sale?: {
    id: string;
    created_at: string;
    total_cents: number;
  };
  creator?: {
    first_name: string;
    last_name: string;
  };
  involved_users?: {
    user_id: string;
    profile?: {
      first_name: string;
      last_name: string;
    };
  }[];
}

export interface SacTicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  organization_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

// Categories and subcategories mapping
export const SAC_CATEGORIES: Record<SacCategory, { label: string; icon: string; subcategories: string[] }> = {
  complaint: {
    label: 'Reclamação',
    icon: '!',
    subcategories: [
      'Produto não entregue',
      'Produto divergente',
      'Cobrança indevida',
      'Promessa não cumprida',
      'Mal atendimento',
    ],
  },
  question: {
    label: 'Dúvida',
    icon: '?',
    subcategories: [
      'Como usar o produto',
      'Como rastrear',
      'Como pagar',
    ],
  },
  request: {
    label: 'Solicitação',
    icon: '↻',
    subcategories: [
      '2ª via boleto',
      'Troca',
      'Reenvio',
      'Ajuste de cadastro',
    ],
  },
  financial: {
    label: 'Financeiro',
    icon: '$',
    subcategories: [
      'Renegociação',
      'Cancelamento',
      'Estorno',
      'Chargeback',
    ],
  },
};

export const SAC_STATUS_LABELS: Record<SacTicketStatus, { label: string; color: string }> = {
  pending: { label: 'Não Tratados', color: 'bg-purple-500' },
  open: { label: 'Aberto', color: 'bg-blue-500' },
  in_progress: { label: 'Em Atendimento', color: 'bg-yellow-500' },
  resolved: { label: 'Resolvido', color: 'bg-green-500' },
  closed: { label: 'Fechado', color: 'bg-gray-500' },
};

export const SAC_PRIORITY_LABELS: Record<SacTicketPriority, { label: string; color: string }> = {
  low: { label: 'Baixa', color: 'bg-gray-400' },
  normal: { label: 'Normal', color: 'bg-blue-400' },
  high: { label: 'Alta', color: 'bg-red-500' },
};

// Fetch all tickets for the organization
export function useSacTickets(filters?: { status?: SacTicketStatus; leadId?: string }) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['sac-tickets', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('sac_tickets')
        .select(`
          *,
          lead:leads!sac_tickets_lead_id_fkey(id, name, whatsapp),
          sale:sales!sac_tickets_sale_id_fkey(id, created_at, total_cents)
        `)
        .eq('organization_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters?.leadId) {
        query = query.eq('lead_id', filters.leadId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Fetch involved users and creators for each ticket
      const ticketIds = data.map(t => t.id);
      const creatorIds = [...new Set(data.map(t => t.created_by))];
      
      // Fetch involved users
      const { data: ticketUsers } = await supabase
        .from('sac_ticket_users')
        .select('ticket_id, user_id')
        .in('ticket_id', ticketIds);
      
      // Fetch profiles for creators and involved users
      const allUserIds = [...new Set([
        ...creatorIds,
        ...(ticketUsers?.map(u => u.user_id) || []),
      ])];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', allUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(ticket => ({
        ...ticket,
        creator: profileMap.get(ticket.created_by),
        involved_users: ticketUsers
          ?.filter(u => u.ticket_id === ticket.id)
          .map(u => ({
            user_id: u.user_id,
            profile: profileMap.get(u.user_id),
          })),
      })) as SacTicket[];
    },
    enabled: !!tenantId,
  });
}

// Fetch single ticket with details
export function useSacTicket(ticketId: string | undefined) {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['sac-ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      
      const { data, error } = await supabase
        .from('sac_tickets')
        .select(`
          *,
          lead:leads!sac_tickets_lead_id_fkey(id, name, whatsapp),
          sale:sales!sac_tickets_sale_id_fkey(id, created_at, total_cents)
        `)
        .eq('id', ticketId)
        .single();
      
      if (error) throw error;
      
      // Fetch involved users
      const { data: ticketUsers } = await supabase
        .from('sac_ticket_users')
        .select('user_id')
        .eq('ticket_id', ticketId);
      
      // Fetch profiles
      const userIds = [data.created_by, ...(ticketUsers?.map(u => u.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return {
        ...data,
        creator: profileMap.get(data.created_by),
        involved_users: ticketUsers?.map(u => ({
          user_id: u.user_id,
          profile: profileMap.get(u.user_id),
        })),
      } as SacTicket;
    },
    enabled: !!ticketId && !!tenantId,
  });
}

// Fetch comments for a ticket
export function useSacTicketComments(ticketId: string | undefined) {
  return useQuery({
    queryKey: ['sac-ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from('sac_ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      // Fetch profiles
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      
      return data.map(comment => ({
        ...comment,
        user: profileMap.get(comment.user_id),
      })) as SacTicketComment[];
    },
    enabled: !!ticketId,
  });
}

// Create ticket
export function useCreateSacTicket() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data: {
      lead_id: string;
      sale_id?: string;
      category: SacCategory;
      subcategory: string;
      priority: SacTicketPriority;
      description: string;
      involved_user_ids?: string[];
    }) => {
      if (!tenantId || !user) throw new Error('Não autenticado');
      
      // Create ticket
      const { data: ticket, error } = await supabase
        .from('sac_tickets')
        .insert({
          organization_id: tenantId,
          lead_id: data.lead_id,
          sale_id: data.sale_id || null,
          created_by: user.id,
          category: data.category,
          subcategory: data.subcategory,
          priority: data.priority,
          description: data.description,
          status: 'open',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Add involved users
      if (data.involved_user_ids && data.involved_user_ids.length > 0) {
        const { error: usersError } = await supabase
          .from('sac_ticket_users')
          .insert(
            data.involved_user_ids.map(userId => ({
              ticket_id: ticket.id,
              user_id: userId,
              organization_id: tenantId,
            }))
          );
        
        if (usersError) throw usersError;
      }
      
      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sac-tickets'] });
      toast.success('Chamado aberto com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao abrir chamado', { description: error.message });
    },
  });
}

// Update ticket status
export function useUpdateSacTicketStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ ticketId, status, resolution_notes }: { 
      ticketId: string; 
      status: SacTicketStatus;
      resolution_notes?: string;
    }) => {
      const updateData: any = { status };
      
      if (status === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = user?.id;
        if (resolution_notes) {
          updateData.resolution_notes = resolution_notes;
        }
      } else if (status === 'closed') {
        updateData.closed_at = new Date().toISOString();
        updateData.closed_by = user?.id;
      }
      
      const { error } = await supabase
        .from('sac_tickets')
        .update(updateData)
        .eq('id', ticketId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sac-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['sac-ticket'] });
      toast.success('Status atualizado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar status', { description: error.message });
    },
  });
}

// Add comment
export function useAddSacTicketComment() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal }: { 
      ticketId: string; 
      content: string;
      isInternal?: boolean;
    }) => {
      if (!tenantId || !user) throw new Error('Não autenticado');
      
      const { error } = await supabase
        .from('sac_ticket_comments')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          organization_id: tenantId,
          content,
          is_internal: isInternal || false,
        });
      
      if (error) throw error;
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['sac-ticket-comments', ticketId] });
      toast.success('Comentário adicionado!');
    },
    onError: (error: any) => {
      toast.error('Erro ao adicionar comentário', { description: error.message });
    },
  });
}

// Tickets count by status (for Kanban)
export function useSacTicketsCounts() {
  const { tenantId } = useTenant();
  
  return useQuery({
    queryKey: ['sac-tickets-counts', tenantId],
    queryFn: async () => {
      if (!tenantId) return { open: 0, in_progress: 0, resolved: 0, closed: 0 };
      
      const { data, error } = await supabase
        .from('sac_tickets')
        .select('status')
        .eq('organization_id', tenantId);
      
      if (error) throw error;
      
      const counts = {
        open: 0,
        in_progress: 0,
        resolved: 0,
        closed: 0,
      };
      
      data.forEach(ticket => {
        counts[ticket.status as SacTicketStatus]++;
      });
      
      return counts;
    },
    enabled: !!tenantId,
  });
}
