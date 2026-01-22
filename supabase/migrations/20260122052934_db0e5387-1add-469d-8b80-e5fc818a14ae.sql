-- Create payment reminder log table for tracking sent reminders
CREATE TABLE public.payment_reminder_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- day_3, day_7, day_14
  sent_to TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_reminder_log ENABLE ROW LEVEL SECURITY;

-- Only master admin (thiago.morphews@gmail.com) can view
CREATE POLICY "Master admin can view all reminder logs"
  ON public.payment_reminder_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.email = 'thiago.morphews@gmail.com'
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_payment_reminder_org ON public.payment_reminder_log(organization_id);
CREATE INDEX idx_payment_reminder_sent_at ON public.payment_reminder_log(sent_at DESC);