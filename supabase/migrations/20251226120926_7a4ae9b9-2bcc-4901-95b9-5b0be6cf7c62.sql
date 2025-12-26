-- Fix linter: ensure public views use invoker rights
ALTER VIEW public.whatsapp_conversations_view SET (security_invoker = true);