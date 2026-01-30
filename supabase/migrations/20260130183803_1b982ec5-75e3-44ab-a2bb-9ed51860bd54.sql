-- Migração: Adicionar novos status de venda ao ENUM e atualizar vendas existentes

-- 1. Adicionar os novos valores ao ENUM sale_status
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE public.sale_status ADD VALUE IF NOT EXISTS 'finalized';

-- 2. Adicionar colunas para rastrear quando foi baixado/finalizado
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES auth.users(id);