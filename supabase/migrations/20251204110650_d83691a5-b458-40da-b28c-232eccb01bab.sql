-- Allow organization members to view profiles of other members in their org
CREATE POLICY "Org members can view profiles of same org"
ON public.profiles
FOR SELECT
USING (
  organization_id = get_user_organization_id()
);