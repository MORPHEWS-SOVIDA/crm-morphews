
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage org config" ON public.voip_3c_config;
DROP POLICY IF EXISTS "Users can view org config" ON public.voip_3c_config;

-- Recreate with proper WITH CHECK
CREATE POLICY "Users can view org config"
ON public.voip_3c_config FOR SELECT
USING (organization_id IN (
  SELECT profiles.organization_id FROM profiles WHERE profiles.user_id = auth.uid()
));

CREATE POLICY "Admins can insert org config"
ON public.voip_3c_config FOR INSERT
WITH CHECK (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));

CREATE POLICY "Admins can update org config"
ON public.voip_3c_config FOR UPDATE
USING (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
))
WITH CHECK (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));

CREATE POLICY "Admins can delete org config"
ON public.voip_3c_config FOR DELETE
USING (organization_id IN (
  SELECT om.organization_id FROM organization_members om
  WHERE om.user_id = auth.uid() AND om.role IN ('admin', 'manager', 'owner')
));
