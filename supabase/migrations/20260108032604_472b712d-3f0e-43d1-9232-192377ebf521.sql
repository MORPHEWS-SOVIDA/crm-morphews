-- Fix RLS policy for lead_standard_question_answers to include WITH CHECK
DROP POLICY IF EXISTS "Users can manage answers" ON public.lead_standard_question_answers;

CREATE POLICY "Users can manage answers" 
ON public.lead_standard_question_answers 
FOR ALL 
USING (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )
);