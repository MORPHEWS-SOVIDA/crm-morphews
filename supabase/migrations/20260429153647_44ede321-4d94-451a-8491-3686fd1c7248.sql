UPDATE leads
SET funnel_stage_id = 'b310203e-7ad6-449f-ad6e-fa333fe95902',
    stage = 'nurturing'::funnel_stage,
    updated_at = now()
WHERE funnel_stage_id = '47f01307-f02c-4210-9ee0-ee68feab671c'
  AND id IN (
    SELECT DISTINCT lead_id
    FROM lead_webhook_history
    WHERE integration_id = '2badf779-29ba-4f32-b0a3-fd804e858a21'
      AND lead_id IS NOT NULL
  );