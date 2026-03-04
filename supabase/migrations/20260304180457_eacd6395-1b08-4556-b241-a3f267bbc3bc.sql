
-- Trigger: when leads.name is updated, sync to whatsapp_conversations.contact_name
CREATE OR REPLACE FUNCTION public.sync_lead_name_to_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.whatsapp_conversations
    SET contact_name = NEW.name
    WHERE lead_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_name_to_conversations ON public.leads;

CREATE TRIGGER trg_sync_lead_name_to_conversations
AFTER UPDATE OF name ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_lead_name_to_conversations();
