import type { DemandUrgency } from '@/types/demand';

/**
 * Filtros aplicados na listagem Kanban de Demandas.
 * - assigneeId: auth user id (profiles.user_id)
 */
export type DemandsFilters = {
  assigneeId?: string;
  leadId?: string;
  urgency?: DemandUrgency;
  createdFrom?: string; // YYYY-MM-DD
  createdTo?: string; // YYYY-MM-DD
  labelIds?: string[];
  archived?: boolean;
};
