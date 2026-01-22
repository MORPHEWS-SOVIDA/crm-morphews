import type { Lead, FunnelStage } from '@/types/lead';
import { getStageEnumValue, type FunnelStageCustom } from '@/hooks/useFunnelStages';

/**
 * PRIMARY GROUPING METHOD (stable, UUID-based)
 * 
 * Groups leads by their `funnel_stage_id` (direct link to custom stage).
 * Falls back to enum-based matching only for leads without funnel_stage_id (legacy data).
 * 
 * This ensures that:
 * - Each lead appears in exactly ONE column
 * - Reordering or renaming stages doesn't break the mapping
 * - Works correctly across all tenants
 */
export function groupLeadsByFunnelStageId(
  leads: Lead[],
  stages: FunnelStageCustom[]
): Record<string, Lead[]> {
  const grouped: Record<string, Lead[]> = {};
  
  // Initialize empty arrays for all stages
  for (const stage of stages) {
    grouped[stage.id] = [];
  }

  // Build a fallback map for legacy leads (enum_value -> first matching stage)
  const enumToStageId = new Map<FunnelStage, string>();
  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  for (const stage of sortedStages) {
    const enumValue = getStageEnumValue(stage);
    if (!enumToStageId.has(enumValue)) {
      enumToStageId.set(enumValue, stage.id);
    }
  }

  for (const lead of leads) {
    let targetStageId: string | null = null;

    // Prefer direct funnel_stage_id (stable, multi-tenant safe)
    if (lead.funnel_stage_id && grouped[lead.funnel_stage_id] !== undefined) {
      targetStageId = lead.funnel_stage_id;
    } else {
      // Fallback: use enum_value mapping (for legacy data)
      targetStageId = enumToStageId.get(lead.stage) || null;
    }

    if (targetStageId && grouped[targetStageId]) {
      grouped[targetStageId].push(lead);
    }
    // If no match found, lead is orphaned (should be rare after backfill)
  }

  return grouped;
}

/**
 * Finds the custom stage for a lead, preferring funnel_stage_id over enum matching.
 */
export function findLeadStage(
  lead: Lead,
  stages: FunnelStageCustom[]
): FunnelStageCustom | undefined {
  // Prefer direct UUID link
  if (lead.funnel_stage_id) {
    const directMatch = stages.find(s => s.id === lead.funnel_stage_id);
    if (directMatch) return directMatch;
  }
  
  // Fallback to enum_value matching (legacy)
  return stages.find(s => s.enum_value === lead.stage);
}

// ============== LEGACY FUNCTIONS (kept for backward compatibility) ==============

/**
 * @deprecated Use groupLeadsByFunnelStageId instead.
 * 
 * When multiple custom stages share the same enum_value (or fall back to the same enum),
 * the same lead can appear in multiple columns.
 *
 * This helper enforces a single "primary stage" per enum by picking the first stage
 * in ascending position order.
 */
export function computePrimaryStages(stages: FunnelStageCustom[]) {
  const sorted = [...stages].sort((a, b) => a.position - b.position);

  const primaryStageByEnum = new Map<FunnelStage, FunnelStageCustom>();
  for (const stage of sorted) {
    const enumValue = getStageEnumValue(stage);
    if (!primaryStageByEnum.has(enumValue)) {
      primaryStageByEnum.set(enumValue, stage);
    }
  }

  const primaryStages = Array.from(primaryStageByEnum.values());
  return { primaryStages, primaryStageByEnum };
}

/**
 * @deprecated Use groupLeadsByFunnelStageId instead.
 */
export function groupLeadsByPrimaryStage(
  leads: Lead[],
  primaryStages: FunnelStageCustom[],
  primaryStageByEnum: Map<FunnelStage, FunnelStageCustom>
) {
  const grouped: Record<string, Lead[]> = {};
  for (const stage of primaryStages) grouped[stage.id] = [];

  for (const lead of leads) {
    const stage = primaryStageByEnum.get(lead.stage);
    if (!stage) continue;
    grouped[stage.id]?.push(lead);
  }

  return grouped;
}
