-- Adicionar coluna de energia mensal nos planos
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS monthly_energy integer DEFAULT 1000;

-- Atualizar energia dos planos existentes
UPDATE public.subscription_plans SET monthly_energy = 500 WHERE name = 'Grátis';
UPDATE public.subscription_plans SET monthly_energy = 2000 WHERE name = 'Starter';
UPDATE public.subscription_plans SET monthly_energy = 5000 WHERE name = 'Growth';
UPDATE public.subscription_plans SET monthly_energy = 15000 WHERE name = 'Pro';
UPDATE public.subscription_plans SET monthly_energy = 50000 WHERE name = 'Influencer';

-- Função para inicializar/resetar energia da organização
CREATE OR REPLACE FUNCTION public.initialize_organization_energy(org_id uuid, plan_energy integer)
RETURNS void AS $$
BEGIN
  INSERT INTO public.organization_energy (
    organization_id,
    included_energy,
    bonus_energy,
    used_energy,
    reset_at
  ) VALUES (
    org_id,
    plan_energy,
    0,
    0,
    (date_trunc('month', now()) + interval '1 month')::timestamptz
  )
  ON CONFLICT (organization_id) DO UPDATE SET
    included_energy = plan_energy,
    used_energy = 0,
    reset_at = (date_trunc('month', now()) + interval '1 month')::timestamptz,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para adicionar energia bonus
CREATE OR REPLACE FUNCTION public.add_bonus_energy(org_id uuid, amount integer)
RETURNS void AS $$
BEGIN
  UPDATE public.organization_energy 
  SET bonus_energy = bonus_energy + amount,
      updated_at = now()
  WHERE organization_id = org_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.organization_energy (
      organization_id,
      included_energy,
      bonus_energy,
      used_energy,
      reset_at
    ) VALUES (
      org_id,
      0,
      amount,
      0,
      (date_trunc('month', now()) + interval '1 month')::timestamptz
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar energia quando assinatura é criada/atualizada
CREATE OR REPLACE FUNCTION public.sync_subscription_energy()
RETURNS TRIGGER AS $$
DECLARE
  plan_energy integer;
BEGIN
  -- Buscar energia do plano
  SELECT monthly_energy INTO plan_energy
  FROM public.subscription_plans
  WHERE id = NEW.plan_id;
  
  -- Inicializar energia se for nova assinatura ou mudança de plano
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.plan_id != NEW.plan_id) THEN
    PERFORM public.initialize_organization_energy(NEW.organization_id, COALESCE(plan_energy, 1000));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sync_subscription_energy ON public.subscriptions;
CREATE TRIGGER trigger_sync_subscription_energy
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_subscription_energy();

-- RLS para organization_energy (master admin pode ver tudo)
DROP POLICY IF EXISTS "Users can view their org energy" ON public.organization_energy;
CREATE POLICY "Users can view their org energy" ON public.organization_energy
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND email = 'thiago.morphews@gmail.com'
    )
  );

-- Master admin pode modificar energia
DROP POLICY IF EXISTS "Master admin can manage energy" ON public.organization_energy;
CREATE POLICY "Master admin can manage energy" ON public.organization_energy
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND email = 'thiago.morphews@gmail.com'
    )
  );

-- Habilitar RLS
ALTER TABLE public.organization_energy ENABLE ROW LEVEL SECURITY;

-- RLS para energy_usage_log (visualização)
DROP POLICY IF EXISTS "Users can view their org usage" ON public.energy_usage_log;
CREATE POLICY "Users can view their org usage" ON public.energy_usage_log
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND email = 'thiago.morphews@gmail.com'
    )
  );

ALTER TABLE public.energy_usage_log ENABLE ROW LEVEL SECURITY;