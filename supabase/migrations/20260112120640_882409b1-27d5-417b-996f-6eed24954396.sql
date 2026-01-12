
-- Fix function search paths to prevent search_path mutation vulnerabilities
-- All functions will have explicit search_path = public

-- 1. Fix add_bonus_energy function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.add_bonus_energy(org_id uuid, amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 2. Fix generate_bot_system_prompt function
CREATE OR REPLACE FUNCTION public.generate_bot_system_prompt(
  p_gender text, 
  p_state text, 
  p_age_range text, 
  p_service_type text, 
  p_response_length text, 
  p_company_differential text, 
  p_personality_description text, 
  p_regional_expressions text[]
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  v_prompt text;
  v_gender_text text;
  v_age_text text;
  v_service_text text;
  v_length_text text;
BEGIN
  v_gender_text := CASE p_gender 
    WHEN 'male' THEN 'Você é um atendente masculino.' 
    WHEN 'female' THEN 'Você é uma atendente feminina.' 
    ELSE 'Você é um assistente virtual neutro.' 
  END;
  
  v_age_text := CASE p_age_range 
    WHEN '18-25' THEN 'Use linguagem jovem, informal, moderna. Pode usar emojis com moderação.' 
    WHEN '26-35' THEN 'Use linguagem profissional mas acessível.' 
    WHEN '36-50' THEN 'Use linguagem formal e objetiva.' 
    WHEN '50+' THEN 'Use linguagem muito formal e tradicional.' 
    ELSE 'Use linguagem profissional.' 
  END;
  
  v_service_text := CASE p_service_type 
    WHEN 'sales' THEN 'Seu objetivo é ajudar o cliente a conhecer produtos e realizar vendas.' 
    WHEN 'support' THEN 'Seu objetivo é fornecer suporte técnico.' 
    WHEN 'sac' THEN 'Seu objetivo é atender reclamações.' 
    WHEN 'social_selling' THEN 'Seu objetivo é criar relacionamento.' 
    WHEN 'qualification' THEN 'Seu objetivo é qualificar leads.' 
    ELSE 'Seu objetivo é ajudar o cliente.' 
  END;
  
  v_length_text := CASE p_response_length 
    WHEN 'short' THEN 'Dê respostas curtas, máximo 50 palavras.' 
    WHEN 'medium' THEN 'Dê respostas de 50-100 palavras.' 
    WHEN 'detailed' THEN 'Dê respostas detalhadas.' 
    ELSE 'Dê respostas apropriadas ao contexto.' 
  END;
  
  v_prompt := v_gender_text || ' ' || v_age_text || ' ' || v_service_text || ' ' || v_length_text;
  
  IF p_state IS NOT NULL THEN 
    v_prompt := v_prompt || ' Você atende clientes do estado ' || p_state || '.'; 
  END IF;
  
  IF p_regional_expressions IS NOT NULL AND array_length(p_regional_expressions, 1) > 0 THEN 
    v_prompt := v_prompt || ' Use expressões: ' || array_to_string(p_regional_expressions, ', ') || '.'; 
  END IF;
  
  IF p_company_differential IS NOT NULL THEN 
    v_prompt := v_prompt || ' Diferencial: ' || p_company_differential || '.'; 
  END IF;
  
  IF p_personality_description IS NOT NULL THEN 
    v_prompt := v_prompt || ' Personalidade: ' || p_personality_description || '.'; 
  END IF;
  
  v_prompt := v_prompt || ' Sempre seja educado e prestativo. Se não souber, ofereça transferir para humano.';
  
  RETURN v_prompt;
END;
$function$;

-- 3. Fix initialize_organization_energy function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.initialize_organization_energy(org_id uuid, plan_energy integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 4. Fix normalize_phone_digits function (IMMUTABLE)
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
  SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g');
$function$;

-- 5. Fix sync_subscription_energy trigger function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_subscription_energy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
$function$;

-- 6. Fix trigger_generate_bot_prompt trigger function
CREATE OR REPLACE FUNCTION public.trigger_generate_bot_prompt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.system_prompt := public.generate_bot_system_prompt(
    NEW.gender, 
    NEW.brazilian_state, 
    NEW.age_range, 
    NEW.service_type, 
    NEW.response_length, 
    NEW.company_differential, 
    NEW.personality_description, 
    NEW.regional_expressions
  );
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- 7. Fix the permissive RLS policy on energy_usage_log
-- The "System can insert energy log" policy allows any authenticated user to insert
-- This should be restricted to only allow inserts for the user's own organization

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "System can insert energy log" ON public.energy_usage_log;

-- Create a more restrictive insert policy that validates organization membership
CREATE POLICY "Org members can insert energy log" ON public.energy_usage_log
FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM public.organization_members om 
    WHERE om.user_id = auth.uid()
  )
);
