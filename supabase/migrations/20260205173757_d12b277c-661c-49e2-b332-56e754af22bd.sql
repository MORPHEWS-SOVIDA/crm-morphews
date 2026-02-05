-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Org admins can create SMS purchases" ON sms_credits_purchases;

-- Create new INSERT policy that allows owners, admins, and managers
CREATE POLICY "Org members can create SMS purchases" ON sms_credits_purchases
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT om.organization_id
    FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin', 'manager')
  )
);