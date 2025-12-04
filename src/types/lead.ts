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
};
