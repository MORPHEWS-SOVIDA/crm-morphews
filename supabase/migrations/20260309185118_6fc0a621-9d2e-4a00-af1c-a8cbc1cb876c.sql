
-- Backfill reply_received for leads that are in "Respondeu Prospecção Ativa" or later stages
-- but don't have reply_received logged in social_selling_activities
INSERT INTO social_selling_activities (organization_id, lead_id, activity_type, seller_id, profile_id, instagram_username, created_at)
SELECT 
  ssa.organization_id,
  l.id,
  'reply_received',
  ssa.seller_id,
  ssa.profile_id,
  ssa.instagram_username,
  -- Use the time the lead entered "Respondeu" stage, or fallback to now
  COALESCE(
    (SELECT lsh.created_at FROM lead_stage_history lsh 
     JOIN organization_funnel_stages ofs2 ON ofs2.id = lsh.funnel_stage_id
     WHERE lsh.lead_id = l.id AND ofs2.name = 'Respondeu Prospecção Ativa'
     ORDER BY lsh.created_at ASC LIMIT 1),
    now()
  )
FROM leads l
JOIN organization_funnel_stages ofs ON ofs.id = l.funnel_stage_id
CROSS JOIN LATERAL (
  SELECT organization_id, seller_id, profile_id, instagram_username
  FROM social_selling_activities
  WHERE lead_id = l.id AND activity_type = 'message_sent'
  ORDER BY created_at ASC LIMIT 1
) ssa
WHERE ofs.name IN (
  'Respondeu Prospecção Ativa',
  'Lead não entrou no grupo',
  'Lead não passou Whatsapp',
  'Grupo de Whatsapp Criado (AGENDAR CALL)',
  '[TONY] Call Agendada',
  '[Lincoln] Call agendada',
  '[TONY] Call Feita - Agendar com Lincoln',
  '[LINCOLN] Call Feita - Agendar com Thiago',
  '[THIAGO] Call feita - Proposta enviada',
  '[THIAGO] Não Comprou',
  'Venda Realizada'
)
AND NOT EXISTS (
  SELECT 1 FROM social_selling_activities 
  WHERE lead_id = l.id AND activity_type = 'reply_received'
)
