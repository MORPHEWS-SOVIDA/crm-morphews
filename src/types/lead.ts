import type { Database } from '@/integrations/supabase/types';

export type FunnelStage = Database['public']['Enums']['funnel_stage'];

export interface Lead {
  id: string;
  name: string;
  specialty: string;
  instagram: string;
  followers: number | null;
  whatsapp: string;
  email: string | null;
  stage: FunnelStage;
  /** Direct link to organization_funnel_stages.id for stable multi-tenant mapping */
  funnel_stage_id: string | null;
  stars: number;
  assigned_to: string;
  whatsapp_group: string | null;
  desired_products: string | null;
  negotiated_value: number | null;
  paid_value: number | null;
  observations: string | null;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_link: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * All available funnel stage behaviors with their labels.
 * These are the enum_values that can be assigned to custom stages.
 */
export const FUNNEL_STAGE_BEHAVIORS: Record<FunnelStage, { label: string; description: string }> = {
  // Entrada / Inicial
  new_lead: { label: 'Lead Novo', description: 'Lead recém-chegado, ainda não processado' },
  no_contact: { label: 'Sem Contato', description: 'Ainda não houve tentativa de contato' },
  unclassified: { label: 'Não Classificado', description: 'Lead sem classificação definida' },
  needs_contact: { label: 'Cliente sem Contato', description: 'Precisa de contato urgente' },
  cloud: { label: 'Nuvem (Cloud)', description: 'Leads não classificados acima do funil' },
  
  // Prospecção
  prospect: { label: 'Prospecção Ativa', description: 'Em processo de prospecção' },
  active_prospecting: { label: 'Prospecção Intensa', description: 'Prospecção com follow-ups frequentes' },
  internet_lead: { label: 'Lead da Internet', description: 'Veio de campanhas online' },
  
  // Contato
  contact_failed: { label: 'Contato Sem Sucesso', description: 'Tentativas de contato falharam' },
  contact_success: { label: 'Contato Com Sucesso', description: 'Conseguiu falar com o lead' },
  contacted: { label: 'Contatado', description: 'Primeiro contato realizado' },
  
  // Convencimento / Agendamento
  convincing: { label: 'Convencendo', description: 'Em processo de convencimento' },
  scheduling: { label: 'Agendando', description: 'Negociando data/hora da reunião' },
  scheduled: { label: 'Agendado', description: 'Reunião/call agendada' },
  no_show: { label: 'No-Show', description: 'Faltou à reunião agendada' },
  
  // Reunião / Proposta
  positive: { label: 'Reunião Positiva (legado)', description: 'Reunião foi positiva' },
  positive_meeting: { label: 'Reunião Positiva', description: 'Reunião realizada com interesse' },
  formulating_proposal: { label: 'Formulando Proposta', description: 'Elaborando proposta comercial' },
  proposal_sent: { label: 'Proposta Enviada', description: 'Proposta foi enviada ao cliente' },
  
  // Pagamento / Contrato
  waiting_payment: { label: 'Aguardando Pagamento', description: 'Esperando confirmação de pagamento' },
  paid: { label: 'Pago', description: 'Pagamento confirmado' },
  awaiting_contract: { label: 'Aguardando Contrato', description: 'Esperando assinatura do contrato' },
  contract_signed: { label: 'Contrato Assinado', description: 'Contrato foi assinado' },
  
  // Sucesso / Conclusão
  sale_completed: { label: 'Venda Concluída', description: 'Processo de venda finalizado' },
  success: { label: 'Sucesso', description: 'Lead convertido com sucesso' },
  
  // Pós-Venda
  post_sale: { label: 'Pós-Venda', description: 'Em acompanhamento pós-venda' },
  awaiting_repurchase: { label: 'Aguardando Recompra', description: 'Esperando próxima compra' },
  nurturing: { label: 'Nutrição', description: 'Em nutrição de relacionamento' },
  
  // Negativo
  gave_up: { label: 'Desistiu', description: 'Cliente desistiu do processo' },
  trash: { label: 'Sem Interesse', description: 'Lead sem interesse/descartado' },
};

/**
 * Legacy mapping for backwards compatibility with existing UI components.
 * @deprecated Use FUNNEL_STAGE_BEHAVIORS for new code
 */
export const FUNNEL_STAGES: Record<FunnelStage, { label: string; color: string; textColor: string }> = {
  prospect: { 
    label: 'Prospectando / Aguardando resposta', 
    color: 'bg-funnel-prospect', 
    textColor: 'text-funnel-prospect-foreground' 
  },
  contacted: { 
    label: 'Cliente nos chamou', 
    color: 'bg-funnel-contacted', 
    textColor: 'text-funnel-contacted-foreground' 
  },
  convincing: { 
    label: 'Convencendo a marcar call', 
    color: 'bg-funnel-convincing', 
    textColor: 'text-funnel-convincing-foreground' 
  },
  scheduled: { 
    label: 'Call agendada', 
    color: 'bg-funnel-scheduled', 
    textColor: 'text-funnel-scheduled-foreground' 
  },
  positive: { 
    label: 'Call feita positiva', 
    color: 'bg-funnel-positive', 
    textColor: 'text-funnel-positive-foreground' 
  },
  waiting_payment: { 
    label: 'Aguardando pagamento', 
    color: 'bg-funnel-waiting-payment', 
    textColor: 'text-funnel-waiting-payment-foreground' 
  },
  success: { 
    label: 'PAGO - SUCESSO!', 
    color: 'bg-funnel-success', 
    textColor: 'text-funnel-success-foreground' 
  },
  trash: { 
    label: 'Não tem interesse', 
    color: 'bg-funnel-trash', 
    textColor: 'text-funnel-trash-foreground' 
  },
  cloud: { 
    label: 'Não classificado', 
    color: 'bg-funnel-cloud', 
    textColor: 'text-funnel-cloud-foreground' 
  },
  // New stages with default colors
  new_lead: { label: 'Lead Novo', color: 'bg-blue-200', textColor: 'text-blue-900' },
  no_contact: { label: 'Sem Contato', color: 'bg-gray-200', textColor: 'text-gray-900' },
  unclassified: { label: 'Não Classificado', color: 'bg-slate-200', textColor: 'text-slate-900' },
  needs_contact: { label: 'Cliente sem Contato', color: 'bg-orange-200', textColor: 'text-orange-900' },
  active_prospecting: { label: 'Prospecção Intensa', color: 'bg-amber-200', textColor: 'text-amber-900' },
  internet_lead: { label: 'Lead da Internet', color: 'bg-cyan-200', textColor: 'text-cyan-900' },
  contact_failed: { label: 'Contato Sem Sucesso', color: 'bg-red-200', textColor: 'text-red-900' },
  contact_success: { label: 'Contato Com Sucesso', color: 'bg-green-200', textColor: 'text-green-900' },
  scheduling: { label: 'Agendando', color: 'bg-indigo-200', textColor: 'text-indigo-900' },
  no_show: { label: 'No-Show', color: 'bg-rose-200', textColor: 'text-rose-900' },
  positive_meeting: { label: 'Reunião Positiva', color: 'bg-emerald-200', textColor: 'text-emerald-900' },
  formulating_proposal: { label: 'Formulando Proposta', color: 'bg-violet-200', textColor: 'text-violet-900' },
  proposal_sent: { label: 'Proposta Enviada', color: 'bg-purple-200', textColor: 'text-purple-900' },
  paid: { label: 'Pago', color: 'bg-green-400', textColor: 'text-white' },
  awaiting_contract: { label: 'Aguardando Contrato', color: 'bg-teal-200', textColor: 'text-teal-900' },
  contract_signed: { label: 'Contrato Assinado', color: 'bg-teal-400', textColor: 'text-white' },
  sale_completed: { label: 'Venda Concluída', color: 'bg-green-500', textColor: 'text-white' },
  post_sale: { label: 'Pós-Venda', color: 'bg-sky-200', textColor: 'text-sky-900' },
  awaiting_repurchase: { label: 'Aguardando Recompra', color: 'bg-lime-200', textColor: 'text-lime-900' },
  nurturing: { label: 'Nutrição', color: 'bg-pink-200', textColor: 'text-pink-900' },
  gave_up: { label: 'Desistiu', color: 'bg-gray-400', textColor: 'text-white' },
};
