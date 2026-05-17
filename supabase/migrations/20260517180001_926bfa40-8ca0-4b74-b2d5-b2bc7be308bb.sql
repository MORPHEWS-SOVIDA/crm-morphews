DROP TABLE IF EXISTS public.sms_usage CASCADE;
DROP TABLE IF EXISTS public.sms_credits_purchases CASCADE;
DROP TABLE IF EXISTS public.sms_credits_balance CASCADE;
DROP TABLE IF EXISTS public.sms_packages CASCADE;
DROP TABLE IF EXISTS public.sms_provider_config CASCADE;

DROP FUNCTION IF EXISTS public.add_sms_credits(uuid, integer);
DROP FUNCTION IF EXISTS public.deduct_sms_credits(uuid, integer);