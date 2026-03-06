import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AutoMoveRotationTarget {
  id: string;
  source_stage_id: string;
  target_stage_id: string;
  social_selling_profile_id: string | null;
  organization_id: string;
  position: number;
  created_at: string;
}

export interface SocialSellingProfile {
  id: string;
  instagram_username: string;
  display_name: string | null;
  is_active: boolean;
  organization_id: string;
}

export function useAutoMoveRotationTargets(sourceStageId: string | undefined) {
  return useQuery({
    queryKey: ['auto-move-rotation-targets', sourceStageId],
    queryFn: async () => {
      if (!sourceStageId) return [];
      const { data, error } = await (supabase as any)
        .from('auto_move_rotation_targets')
        .select('*')
        .eq('source_stage_id', sourceStageId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []) as AutoMoveRotationTarget[];
    },
    enabled: !!sourceStageId,
  });
}

export function useSocialSellingProfiles(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['social-selling-profiles', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await (supabase as any)
        .from('social_selling_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []) as SocialSellingProfile[];
    },
    enabled: !!organizationId,
  });
}

export function useSaveRotationTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sourceStageId,
      organizationId,
      targets,
    }: {
      sourceStageId: string;
      organizationId: string;
      targets: { target_stage_id: string; social_selling_profile_id: string | null; position: number }[];
    }) => {
      // Delete existing targets for this source stage
      await (supabase as any)
        .from('auto_move_rotation_targets')
        .delete()
        .eq('source_stage_id', sourceStageId);

      if (targets.length === 0) return [];

      // Insert new targets
      const rows = targets.map((t) => ({
        source_stage_id: sourceStageId,
        target_stage_id: t.target_stage_id,
        social_selling_profile_id: t.social_selling_profile_id,
        organization_id: organizationId,
        position: t.position,
      }));

      const { data, error } = await (supabase as any)
        .from('auto_move_rotation_targets')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['auto-move-rotation-targets', vars.sourceStageId] });
    },
  });
}
