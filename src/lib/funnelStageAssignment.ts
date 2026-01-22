import type { Lead, FunnelStage } from '@/types/lead';
import { getStageEnumValue, type FunnelStageCustom } from '@/hooks/useFunnelStages';

/**
 * When multiple custom stages share the same enum_value (or fall back to the same enum),
 * the same lead can appear in multiple columns.
 *
 * This helper enforces a single “primary stage” per enum by picking the first stage
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
