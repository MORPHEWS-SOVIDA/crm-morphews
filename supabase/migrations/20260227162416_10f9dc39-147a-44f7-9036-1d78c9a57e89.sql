CREATE OR REPLACE FUNCTION public.delete_lead_cascade(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  SELECT organization_id
  INTO v_org_id
  FROM public.leads
  WHERE id = p_lead_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Lead não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_tenant_member(v_user_id, v_org_id) THEN
    RAISE EXCEPTION 'Sem permissão para excluir este lead.' USING ERRCODE = '42501';
  END IF;

  -- Tabelas sem ON DELETE CASCADE/SET NULL
  DELETE FROM public.conversation_lead_links WHERE lead_id = p_lead_id;
  DELETE FROM public.saved_payment_methods WHERE lead_id = p_lead_id;

  UPDATE public.ecommerce_orders SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.payment_link_transactions SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.payment_links SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.sms_usage SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.social_selling_activities SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.traczap_link_clicks SET lead_id = NULL WHERE lead_id = p_lead_id;
  UPDATE public.sales SET lead_id = NULL WHERE lead_id = p_lead_id;

  -- Deleções auxiliares (idempotentes)
  DELETE FROM public.ai_lead_suggestions WHERE lead_id = p_lead_id;
  DELETE FROM public.ecommerce_carts WHERE lead_id = p_lead_id;
  DELETE FROM public.email_sends WHERE lead_id = p_lead_id;
  DELETE FROM public.email_sequence_enrollments WHERE lead_id = p_lead_id;
  DELETE FROM public.integration_logs WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_addresses WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_ai_preferences WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_conversation_summaries WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_custom_field_values WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_events WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_followups WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_kit_rejections WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_ownership_transfers WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_product_answers WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_product_question_answers WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_responsibles WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_scheduled_messages WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_source_history WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_stage_history WHERE lead_id = p_lead_id;
  DELETE FROM public.lead_standard_question_answers WHERE lead_id = p_lead_id;
  DELETE FROM public.conversation_satisfaction_ratings WHERE lead_id = p_lead_id;
  DELETE FROM public.conversion_events WHERE lead_id = p_lead_id;
  DELETE FROM public.demands WHERE lead_id = p_lead_id;
  DELETE FROM public.post_sale_surveys WHERE lead_id = p_lead_id;
  DELETE FROM public.quiz_sessions WHERE lead_id = p_lead_id;
  DELETE FROM public.receptive_attendances WHERE lead_id = p_lead_id;
  DELETE FROM public.sac_tickets WHERE lead_id = p_lead_id;
  DELETE FROM public.voice_ai_call_logs WHERE lead_id = p_lead_id;
  DELETE FROM public.voice_ai_calls WHERE lead_id = p_lead_id;
  DELETE FROM public.voice_ai_campaign_contacts WHERE lead_id = p_lead_id;
  DELETE FROM public.voice_call_logs WHERE lead_id = p_lead_id;
  DELETE FROM public.whatsapp_call_logs WHERE lead_id = p_lead_id;
  DELETE FROM public.whatsapp_conversations WHERE lead_id = p_lead_id;
  DELETE FROM public.whatsapp_document_readings WHERE lead_id = p_lead_id;
  DELETE FROM public.whatsapp_v2_chats WHERE lead_id = p_lead_id;

  DELETE FROM public.leads
  WHERE id = p_lead_id
    AND organization_id = v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_lead_cascade(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_lead_cascade(UUID) TO authenticated;