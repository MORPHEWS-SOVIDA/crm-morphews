/**
 * Tipos para as tabelas do projeto atomic-agents (Supabase externo)
 */

export interface LeadSaleInterest {
  id: string;
  conversation_id: string | null;
  phone_number: string;
  organization_id: string;
  product_id: string | null;
  product_name: string;
  estimated_value: number;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AgentNotification {
  id: string;
  conversation_id: string | null;
  instance_id: string | null;
  type: string;
  urgency: string;
  reason: string | null;
  summary: string | null;
  read: boolean;
  read_by: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ConversationNote {
  id: string;
  conversation_id: string | null;
  note_type: string;
  content: string;
  created_at: string;
}

export interface AgentExecutionLog {
  id: string;
  conversation_id: string | null;
  bot_id: string | null;
  organization_id: string | null;
  tools_used: Record<string, unknown>[];
  iterations: number;
  total_tokens: number;
  execution_time_ms: number | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}
