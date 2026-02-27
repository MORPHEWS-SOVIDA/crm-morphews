
CREATE OR REPLACE FUNCTION public.delete_lead_cascade(p_lead_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from all tables that reference leads.id
  DELETE FROM public.ai_lead_suggestions WHERE lead_id = p_lead_id;
  DELETE FROM public.conversation_lead_links WHERE lead_id = p_lead_id;
  DELETE FROM public.conversation_satisfaction_ratings WHERE lead_id = p_lead_id;
  DELETE FROM public.conversion_events WHERE lead_id = p_lead_id;
  DELETE FROM public.demands WHERE lead_id = p_lead_id;
  DELETE FROM public.ecommerce_carts WHERE lead_id = p_lead_id;
  DELETE FROM public.ecommerce_orders WHERE lead_id = p_lead_id;
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
  
  -- Handle sales - set lead_id to null instead of deleting
  UPDATE public.sales SET lead_id = NULL WHERE lead_id = p_lead_id;
  
  -- Finally delete the lead itself
  DELETE FROM public.leads WHERE id = p_lead_id;
END;
$$;
