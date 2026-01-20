-- Adicionar novos valores ao enum funnel_stage para suportar mais classificações de etapas
-- Valores atuais: prospect, contacted, convincing, scheduled, positive, waiting_payment, success, trash, cloud

-- Novos valores para cobrir todo o funil expandido
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'new_lead';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'no_contact';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'unclassified';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'needs_contact';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'active_prospecting';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'internet_lead';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'contact_failed';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'contact_success';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'scheduling';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'positive_meeting';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'formulating_proposal';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'paid';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'awaiting_contract';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'contract_signed';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'sale_completed';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'post_sale';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'awaiting_repurchase';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'nurturing';
ALTER TYPE funnel_stage ADD VALUE IF NOT EXISTS 'gave_up';