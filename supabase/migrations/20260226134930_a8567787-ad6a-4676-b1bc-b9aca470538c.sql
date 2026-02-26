
CREATE TABLE public.quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message_text TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'audio', 'document')),
  media_url TEXT,
  media_filename TEXT,
  category TEXT,
  position INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org quick messages"
  ON public.quick_messages FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert quick messages"
  ON public.quick_messages FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_current_user_org_admin()
  );

CREATE POLICY "Admins can update quick messages"
  ON public.quick_messages FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_current_user_org_admin()
  );

CREATE POLICY "Admins can delete quick messages"
  ON public.quick_messages FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
    )
    AND public.is_current_user_org_admin()
  );

CREATE INDEX idx_quick_messages_org ON public.quick_messages(organization_id, is_active, position);
