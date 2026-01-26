-- Adicionar roles de parceiro ao enum org_role
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'partner_affiliate';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'partner_coproducer';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'partner_industry';
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'partner_factory';