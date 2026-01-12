/**
 * Tipos do sistema de Demandas (Kanban)
 */

export type DemandUrgency = 'low' | 'medium' | 'high';

export type DemandAssigneeRole = 'responsible' | 'participant' | 'watcher';

export interface DemandBoard {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  position: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandColumn {
  id: string;
  board_id: string;
  organization_id: string;
  name: string;
  color: string | null;
  position: number;
  is_final: boolean;
  created_at: string;
  updated_at: string;
}

export interface Demand {
  id: string;
  organization_id: string;
  board_id: string;
  column_id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  urgency: DemandUrgency;
  position: number;
  due_at: string | null;
  sla_deadline: string | null;
  estimated_time_seconds: number | null;
  total_time_seconds: number;
  is_archived: boolean;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemandAssignee {
  id: string;
  demand_id: string;
  user_id: string;
  organization_id: string;
  role: DemandAssigneeRole;
  assigned_by: string | null;
  assigned_at: string;
  notified_at: string | null;
}

export interface DemandTimeEntry {
  id: string;
  demand_id: string;
  user_id: string;
  organization_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  created_at: string;
}

export interface DemandComment {
  id: string;
  demand_id: string;
  user_id: string;
  organization_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DemandAttachment {
  id: string;
  demand_id: string;
  user_id: string;
  organization_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export interface DemandHistory {
  id: string;
  demand_id: string;
  user_id: string | null;
  organization_id: string;
  action: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface DemandChecklistItem {
  id: string;
  demand_id: string;
  organization_id: string;
  title: string;
  is_completed: boolean;
  completed_by: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
}

export interface DemandLabel {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface DemandLabelAssignment {
  id: string;
  demand_id: string;
  label_id: string;
  created_at: string;
}

export interface DemandSlaConfig {
  id: string;
  organization_id: string;
  urgency: DemandUrgency;
  hours: number;
  created_at: string;
  updated_at: string;
}

// Extended types with relations - using Partial for flexible joins
export interface DemandWithRelations extends Demand {
  board?: Partial<DemandBoard> | null;
  column?: Partial<DemandColumn> | null;
  assignees?: DemandAssigneeWithUser[];
  comments_count?: number;
  attachments_count?: number;
  checklist_progress?: { completed: number; total: number };
  labels?: Partial<DemandLabel>[];
  lead?: { id: string; name: string; whatsapp?: string | null } | null;
}

export interface DemandAssigneeWithUser {
  id: string;
  user_id: string;
  role: string;
  assigned_at?: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface DemandColumnWithDemands extends DemandColumn {
  demands: DemandWithRelations[];
}

export interface DemandBoardWithColumns extends DemandBoard {
  columns: DemandColumnWithDemands[];
}

// Form types
export interface CreateDemandInput {
  board_id: string;
  column_id: string;
  lead_id?: string | null;
  title: string;
  description?: string | null;
  urgency?: DemandUrgency;
  due_at?: string | null;
  estimated_time_seconds?: number | null;
  assignee_ids?: string[];
}

export interface UpdateDemandInput {
  title?: string;
  description?: string | null;
  urgency?: DemandUrgency;
  column_id?: string;
  position?: number;
  due_at?: string | null;
  estimated_time_seconds?: number | null;
  is_archived?: boolean;
}

// Urgency config
export const URGENCY_CONFIG: Record<DemandUrgency, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Baixa', color: 'text-green-600', bgColor: 'bg-green-100' },
  medium: { label: 'Média', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  high: { label: 'Alta', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const ASSIGNEE_ROLE_CONFIG: Record<DemandAssigneeRole, { label: string }> = {
  responsible: { label: 'Responsável' },
  participant: { label: 'Participante' },
  watcher: { label: 'Observador' },
};
