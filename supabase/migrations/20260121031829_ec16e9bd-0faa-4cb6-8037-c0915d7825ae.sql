-- Fix RLS policies for lead_custom_field_values to properly handle organization access
-- The issue is that the policy uses profiles.organization_id which may not match

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage custom field values for their org" ON lead_custom_field_values;
DROP POLICY IF EXISTS "Users can view custom field values for their org" ON lead_custom_field_values;

-- Create proper policies that check organization_members
CREATE POLICY "Users can view custom field values for their org" 
ON lead_custom_field_values 
FOR SELECT 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert custom field values for their org" 
ON lead_custom_field_values 
FOR INSERT 
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update custom field values for their org" 
ON lead_custom_field_values 
FOR UPDATE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete custom field values for their org" 
ON lead_custom_field_values 
FOR DELETE 
USING (
  organization_id IN (
    SELECT om.organization_id 
    FROM organization_members om 
    WHERE om.user_id = auth.uid()
  )
);