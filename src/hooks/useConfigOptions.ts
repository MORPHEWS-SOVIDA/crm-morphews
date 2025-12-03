import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types
export interface LeadSource {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface LeadProduct {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

// Lead Sources hooks
export function useLeadSources() {
  return useQuery({
    queryKey: ['lead_sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_sources')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as LeadSource[];
    },
  });
}

export function useCreateLeadSource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('lead_sources')
        .insert({ name })
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

// Lead Products hooks
export function useLeadProducts() {
  return useQuery({
    queryKey: ['lead_products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_products')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as LeadProduct[];
    },
  });
}

export function useCreateLeadProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('lead_products')
        .insert({ name })
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
