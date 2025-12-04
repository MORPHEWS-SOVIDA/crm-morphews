-- Add unique constraint on whatsapp field in profiles table
-- This ensures each WhatsApp number can only be associated with one user account
-- which is required for Z-API integration where each user interacts via their WhatsApp

ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_whatsapp_unique UNIQUE (whatsapp);

-- Note: NULL values are allowed and won't conflict with each other (PostgreSQL behavior)
-- This allows users to not have a WhatsApp set yet, but once set, it must be unique