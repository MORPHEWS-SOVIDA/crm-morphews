import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from './useTenant';

export interface ContinuousMedication {
  id: string;
  organization_id: string;
  name: string;
  normalized_name: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export function useContinuousMedications() {
  const { tenantId } = useTenant();

  return useQuery({
    queryKey: ['continuous-medications', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('continuous_medications')
        .select('*')
        .eq('organization_id', tenantId)
        .order('usage_count', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as ContinuousMedication[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateContinuousMedication() {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!tenantId) throw new Error('Organization ID is required');

      const normalizedName = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

      // Try to find existing medication first
      const { data: existing } = await supabase
        .from('continuous_medications')
        .select('id, name, usage_count')
        .eq('organization_id', tenantId)
        .eq('normalized_name', normalizedName)
        .maybeSingle();

      if (existing) {
        // Increment usage count
        await supabase
          .from('continuous_medications')
          .update({ usage_count: existing.usage_count + 1 })
          .eq('id', existing.id);
        return existing;
      }

      // Create new medication
      const { data, error } = await supabase
        .from('continuous_medications')
        .insert({
          organization_id: tenantId,
          name: name.trim(),
          normalized_name: normalizedName,
          usage_count: 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContinuousMedication;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['continuous-medications', tenantId] });
    },
  });
}

export function normalizeMedicationName(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function findMatchingMedication(
  medications: ContinuousMedication[],
  input: string
): ContinuousMedication | null {
  if (!input.trim()) return null;
  const normalizedInput = normalizeMedicationName(input);
  return medications.find(m => m.normalized_name === normalizedInput) || null;
}

export function filterMedicationSuggestions(
  medications: ContinuousMedication[],
  input: string
): ContinuousMedication[] {
  if (!input.trim()) return medications.slice(0, 10);
  const normalizedInput = normalizeMedicationName(input);
  return medications
    .filter(m => m.normalized_name.includes(normalizedInput) || m.name.toLowerCase().includes(input.toLowerCase()))
    .slice(0, 10);
}
