-- Fix RLS on virtual_account_bank_data so tenant admins and partners can manage bank data
DROP POLICY IF EXISTS "Dono vê seus dados bancários" ON public.virtual_account_bank_data;

-- Helper: a user "owns" a virtual account if any of:
--   - va.user_id = auth.uid()
--   - va is referenced by their profile.partner_virtual_account_id
--   - va.organization_id matches their profile.organization_id AND they are admin/owner
CREATE POLICY "Owners can view bank data"
ON public.virtual_account_bank_data
FOR SELECT
USING (
  virtual_account_id IN (
    SELECT va.id FROM public.virtual_accounts va
    WHERE va.user_id = auth.uid()
       OR va.id = (SELECT partner_virtual_account_id FROM public.profiles WHERE user_id = auth.uid())
       OR (
         va.organization_id IS NOT NULL
         AND va.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
       )
  )
);

CREATE POLICY "Owners can insert bank data"
ON public.virtual_account_bank_data
FOR INSERT
WITH CHECK (
  virtual_account_id IN (
    SELECT va.id FROM public.virtual_accounts va
    WHERE va.user_id = auth.uid()
       OR va.id = (SELECT partner_virtual_account_id FROM public.profiles WHERE user_id = auth.uid())
       OR (
         va.organization_id IS NOT NULL
         AND va.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
       )
  )
);

CREATE POLICY "Owners can update bank data"
ON public.virtual_account_bank_data
FOR UPDATE
USING (
  virtual_account_id IN (
    SELECT va.id FROM public.virtual_accounts va
    WHERE va.user_id = auth.uid()
       OR va.id = (SELECT partner_virtual_account_id FROM public.profiles WHERE user_id = auth.uid())
       OR (
         va.organization_id IS NOT NULL
         AND va.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
       )
  )
)
WITH CHECK (
  virtual_account_id IN (
    SELECT va.id FROM public.virtual_accounts va
    WHERE va.user_id = auth.uid()
       OR va.id = (SELECT partner_virtual_account_id FROM public.profiles WHERE user_id = auth.uid())
       OR (
         va.organization_id IS NOT NULL
         AND va.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
       )
  )
);

CREATE POLICY "Owners can delete bank data"
ON public.virtual_account_bank_data
FOR DELETE
USING (
  virtual_account_id IN (
    SELECT va.id FROM public.virtual_accounts va
    WHERE va.user_id = auth.uid()
       OR va.id = (SELECT partner_virtual_account_id FROM public.profiles WHERE user_id = auth.uid())
       OR (
         va.organization_id IS NOT NULL
         AND va.organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
       )
  )
);