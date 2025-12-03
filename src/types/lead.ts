export type FunnelStage = 
  | 'prospect'
  | 'contacted'
  | 'convincing'
  | 'scheduled'
  | 'positive'
  | 'waiting_payment'
  | 'success'
  | 'trash'
  | 'cloud';

export interface Lead {
  id: string;
  name: string;
  specialty: string;
  instagram: string;
  followers: number;
  whatsapp: string;
  email: string;
  stage: FunnelStage;
  stars: 1 | 2 | 3 | 4 | 5;
  assignedTo: string;
  whatsappGroup?: string;
  desiredProducts?: string;
  negotiatedValue?: number;
  paidValue?: number;
  observations?: string;
  createdAt: Date;
  updatedAt: Date;
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
    label: 'Não está na hora ainda', 
    color: 'bg-funnel-cloud', 
    textColor: 'text-funnel-cloud-foreground' 
  },
};
