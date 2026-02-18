
-- Fix voip_3c_validations: add owner role and proper WITH CHECK
DROP POLICY IF EXISTS "Admins can manage validations" ON public.voip_3c_validations;

CREATE POLICY "Admins can insert validations"
ON public.voip_3c_validations FOR INSERT
WITH CHECK (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));

CREATE POLICY "Admins can update validations"
ON public.voip_3c_validations FOR UPDATE
USING (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
))
WITH CHECK (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));

CREATE POLICY "Admins can delete validations"
ON public.voip_3c_validations FOR DELETE
USING (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));
