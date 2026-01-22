-- Create RPC function for fetching payment reminder logs (for master admin only)
CREATE OR REPLACE FUNCTION public.get_payment_reminder_logs()
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  reminder_type TEXT,
  sent_to TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow master admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND email = 'thiago.morphews@gmail.com'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    prl.id,
    prl.organization_id,
    prl.reminder_type,
    prl.sent_to,
    prl.sent_at,
    prl.created_at
  FROM payment_reminder_log prl
  ORDER BY prl.sent_at DESC;
END;
$$;