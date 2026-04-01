CREATE TABLE IF NOT EXISTS public.serial_label_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  serial_code text,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  user_id uuid,
  sale_id uuid,
  success boolean DEFAULT true,
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_serial_label_logs_org ON public.serial_label_logs(organization_id);
CREATE INDEX idx_serial_label_logs_code ON public.serial_label_logs(serial_code);
CREATE INDEX idx_serial_label_logs_action ON public.serial_label_logs(action);
CREATE INDEX idx_serial_label_logs_created ON public.serial_label_logs(created_at DESC);

ALTER TABLE public.serial_label_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org logs"
  ON public.serial_label_logs FOR SELECT
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert logs for their org"
  ON public.serial_label_logs FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));