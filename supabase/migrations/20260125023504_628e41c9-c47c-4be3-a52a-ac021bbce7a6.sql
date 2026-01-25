-- Função RPC para debitar energia (segura, atômica)
CREATE OR REPLACE FUNCTION public.debit_organization_energy(
  org_id UUID,
  amount INT,
  description TEXT DEFAULT 'Energia consumida'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Debitar energia
  UPDATE public.organizations
  SET energy_balance = COALESCE(energy_balance, 0) - amount
  WHERE id = org_id;

  -- Registrar transação
  INSERT INTO public.energy_transactions (
    organization_id,
    amount,
    type,
    description
  ) VALUES (
    org_id,
    -amount,
    'debit',
    description
  );
END;
$$;