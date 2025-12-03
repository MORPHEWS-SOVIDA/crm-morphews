import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Types
export interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  organization_id: string | null;
}

export interface LeadProduct {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  organization_id: string | null;
}

// Lead Sources hooks - filtered by organization
export function useLeadSources() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['lead_sources', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      return data as LeadSource[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateLeadSource() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }
      
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({ 
          name,
          organization_id: profile.organization_id 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_sources'] });
    },
  });
}

export function useDeleteLeadSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_sources')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_sources'] });
    },
  });
}

// Lead Products hooks - filtered by organization
export function useLeadProducts() {
  const { profile } = useAuth();
  
  return useQuery({
    queryKey: ['lead_products', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      
      const { data, error } = await supabase
        .from('lead_products')
        .select('*')
        .eq('is_active', true)
        .eq('organization_id', profile.organization_id)
        .order('name');

      if (error) throw error;
      return data as LeadProduct[];
    },
    enabled: !!profile?.organization_id,
  });
}

export function useCreateLeadProduct() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!profile?.organization_id) {
        throw new Error('Organização não encontrada');
      }
      
      const { data, error } = await supabase
        .from('lead_products')
        .insert({ 
          name,
          organization_id: profile.organization_id 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_products'] });
    },
  });
}

export function useDeleteLeadProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_products')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_products'] });
    },
  });
}
