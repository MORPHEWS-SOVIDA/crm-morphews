import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';
import { toast } from 'sonner';

export interface DeliveryRegionUser {
  id: string;
  region_id: string;
  user_id: string;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
  };
}

export interface DeliveryRegion {
  id: string;
  organization_id: string;
  name: string;
  assigned_user_id: string | null; // Legacy - kept for backwards compatibility
  is_active: boolean;
  created_at: string;
  updated_at: string;
  schedules?: DeliveryRegionSchedule[];
  assigned_users?: DeliveryRegionUser[];
  assigned_user?: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface DeliveryRegionSchedule {
  id: string;
  region_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  shift: 'morning' | 'afternoon' | 'full_day';
  created_at: string;
}

export interface ShippingCarrier {
  id: string;
  organization_id: string;
  name: string;
  cost_cents: number;
  estimated_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryType = 'pickup' | 'motoboy' | 'carrier';

export const DELIVERY_TYPES: Record<DeliveryType, string> = {
  pickup: 'Retirada no Balcão',
  motoboy: 'Motoboy',
  carrier: 'Transportadora',
};

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo', short: 'Dom' },
  { value: 1, label: 'Segunda', short: 'Seg' },
  { value: 2, label: 'Terça', short: 'Ter' },
  { value: 3, label: 'Quarta', short: 'Qua' },
  { value: 4, label: 'Quinta', short: 'Qui' },
  { value: 5, label: 'Sexta', short: 'Sex' },
  { value: 6, label: 'Sábado', short: 'Sáb' },
];

export const SHIFTS = [
  { value: 'morning', label: 'Manhã' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'full_day', label: 'Dia Inteiro' },
];

// ============ DELIVERY REGIONS ============

export function useDeliveryRegions() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['delivery-regions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data: regions, error: regionsError } = await supabase
        .from('delivery_regions')
        .select('*')
        .eq('organization_id', tenantId)
        .order('name');

      if (regionsError) throw regionsError;

      // Fetch schedules for all regions
      const regionIds = regions.map(r => r.id);
      if (regionIds.length === 0) return regions;

      const { data: schedules, error: schedulesError } = await supabase
        .from('delivery_region_schedules')
        .select('*')
        .in('region_id', regionIds);

      if (schedulesError) throw schedulesError;

      // Fetch assigned users from the new junction table
      const { data: regionUsers, error: regionUsersError } = await supabase
        .from('delivery_region_users')
        .select('*')
        .in('region_id', regionIds);

      if (regionUsersError) throw regionUsersError;

      // Fetch user profiles for all assigned users
      const userIds = [...new Set(regionUsers?.map(ru => ru.user_id) || [])];
      let usersMap: Record<string, { first_name: string; last_name: string }> = {};
      
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', userIds);

        if (users) {
          usersMap = users.reduce((acc, u) => {
            acc[u.user_id] = { first_name: u.first_name, last_name: u.last_name };
            return acc;
          }, {} as Record<string, { first_name: string; last_name: string }>);
        }
      }

      // Combine data
      return regions.map(region => {
        const assignedUsersForRegion = (regionUsers?.filter(ru => ru.region_id === region.id) || []).map(ru => ({
          ...ru,
          user: usersMap[ru.user_id] || null,
        }));
        
        return {
          ...region,
          schedules: schedules?.filter(s => s.region_id === region.id) || [],
          assigned_users: assignedUsersForRegion,
          // Legacy support - use first user if exists
          assigned_user: assignedUsersForRegion.length > 0 ? assignedUsersForRegion[0].user : null,
        };
      }) as DeliveryRegion[];
    },
    enabled: !!tenantId,
  });
}

export function useActiveDeliveryRegions() {
  const { data: regions = [] } = useDeliveryRegions();
  return regions.filter(r => r.is_active);
}

export function useCreateDeliveryRegion() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      assigned_user_ids?: string[];
      schedules: { day_of_week: number; shift: 'morning' | 'afternoon' | 'full_day' }[];
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Create region
      const { data: region, error: regionError } = await supabase
        .from('delivery_regions')
        .insert({
          organization_id: tenantId,
          name: data.name,
        })
        .select()
        .single();

      if (regionError) throw regionError;

      // Create schedules
      if (data.schedules.length > 0) {
        const { error: schedulesError } = await supabase
          .from('delivery_region_schedules')
          .insert(
            data.schedules.map(s => ({
              region_id: region.id,
              day_of_week: s.day_of_week,
              shift: s.shift,
            }))
          );

        if (schedulesError) throw schedulesError;
      }

      // Create assigned users
      if (data.assigned_user_ids && data.assigned_user_ids.length > 0) {
        const { error: usersError } = await supabase
          .from('delivery_region_users')
          .insert(
            data.assigned_user_ids.map(userId => ({
              region_id: region.id,
              user_id: userId,
            }))
          );

        if (usersError) throw usersError;
      }

      return region;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-regions'] });
      toast.success('Região criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar região', { description: error.message });
    },
  });
}

export function useUpdateDeliveryRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      is_active?: boolean;
      assigned_user_ids?: string[];
      schedules?: { day_of_week: number; shift: 'morning' | 'afternoon' | 'full_day' }[];
    }) => {
      const { id, schedules, assigned_user_ids, ...updateData } = data;

      // Update region
      const { error: regionError } = await supabase
        .from('delivery_regions')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (regionError) throw regionError;

      // Update schedules if provided
      if (schedules !== undefined) {
        // Delete existing schedules
        await supabase
          .from('delivery_region_schedules')
          .delete()
          .eq('region_id', id);

        // Insert new schedules
        if (schedules.length > 0) {
          const { error: schedulesError } = await supabase
            .from('delivery_region_schedules')
            .insert(
              schedules.map(s => ({
                region_id: id,
                day_of_week: s.day_of_week,
                shift: s.shift,
              }))
            );

          if (schedulesError) throw schedulesError;
        }
      }

      // Update assigned users if provided
      if (assigned_user_ids !== undefined) {
        // Delete existing assigned users
        await supabase
          .from('delivery_region_users')
          .delete()
          .eq('region_id', id);

        // Insert new assigned users
        if (assigned_user_ids.length > 0) {
          const { error: usersError } = await supabase
            .from('delivery_region_users')
            .insert(
              assigned_user_ids.map(userId => ({
                region_id: id,
                user_id: userId,
              }))
            );

          if (usersError) throw usersError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-regions'] });
      toast.success('Região atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar região', { description: error.message });
    },
  });
}

export function useDeleteDeliveryRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('delivery_regions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-regions'] });
      toast.success('Região removida com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover região', { description: error.message });
    },
  });
}

// ============ DELIVERY RETURN REASONS ============

export interface DeliveryReturnReason {
  id: string;
  organization_id: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export function useDeliveryReturnReasons() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['delivery-return-reasons', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('delivery_return_reasons')
        .select('*')
        .eq('organization_id', tenantId)
        .eq('is_active', true)
        .order('position');

      if (error) throw error;
      return data as DeliveryReturnReason[];
    },
    enabled: !!tenantId,
  });
}

// ============ SHIPPING CARRIERS ============

export function useShippingCarriers() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['shipping-carriers', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('organization_id', tenantId)
        .order('name');

      if (error) throw error;
      return data as ShippingCarrier[];
    },
    enabled: !!tenantId,
  });
}

export function useActiveShippingCarriers() {
  const { data: carriers = [] } = useShippingCarriers();
  return carriers.filter(c => c.is_active);
}

export function useCreateShippingCarrier() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      cost_cents: number;
      estimated_days: number;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data: carrier, error } = await supabase
        .from('shipping_carriers')
        .insert({
          organization_id: tenantId,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return carrier;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-carriers'] });
      toast.success('Transportadora criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar transportadora', { description: error.message });
    },
  });
}

export function useUpdateShippingCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      name?: string;
      cost_cents?: number;
      estimated_days?: number;
      is_active?: boolean;
    }) => {
      const { id, ...updateData } = data;

      const { error } = await supabase
        .from('shipping_carriers')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-carriers'] });
      toast.success('Transportadora atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar transportadora', { description: error.message });
    },
  });
}

export function useDeleteShippingCarrier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shipping_carriers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-carriers'] });
      toast.success('Transportadora removida com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover transportadora', { description: error.message });
    },
  });
}

// ============ UTILITIES ============

export function getAvailableDeliveryDates(
  regionId: string,
  regions: DeliveryRegion[],
  daysAhead: number = 14
): { date: Date; shift: 'morning' | 'afternoon' | 'full_day' }[] {
  const region = regions.find(r => r.id === regionId);
  if (!region || !region.schedules || region.schedules.length === 0) return [];

  const availableDates: { date: Date; shift: 'morning' | 'afternoon' | 'full_day' }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= daysAhead; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dayOfWeek = date.getDay();

    const matchingSchedules = region.schedules.filter(s => s.day_of_week === dayOfWeek);
    for (const schedule of matchingSchedules) {
      availableDates.push({ date, shift: schedule.shift });
    }
  }

  return availableDates;
}

export function formatShift(shift: 'morning' | 'afternoon' | 'full_day'): string {
  const shiftLabels = {
    morning: 'Manhã',
    afternoon: 'Tarde',
    full_day: 'Dia Inteiro',
  };
  return shiftLabels[shift];
}
