-- Fix ambiguous RPC call: keep only TEXT version of accept_partner_invitation
-- Older UUID overload causes PostgREST to fail choosing the best candidate.
DROP FUNCTION IF EXISTS public.accept_partner_invitation(uuid, uuid);