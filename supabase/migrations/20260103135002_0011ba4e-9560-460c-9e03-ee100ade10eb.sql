-- Add sales goals fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_goal_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS weekly_goal_cents integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_goal_cents integer DEFAULT 0;