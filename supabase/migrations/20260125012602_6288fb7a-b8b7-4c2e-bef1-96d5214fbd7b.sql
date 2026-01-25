-- Add default seller and trigger rules to integrations table
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS default_seller_id uuid REFERENCES public.profiles(user_id),
ADD COLUMN IF NOT EXISTS trigger_rules jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS trigger_rules_logic text DEFAULT 'AND' CHECK (trigger_rules_logic IN ('AND', 'OR'));

-- Add comments for documentation
COMMENT ON COLUMN public.integrations.default_seller_id IS 'Default seller assigned to sales created via this integration';
COMMENT ON COLUMN public.integrations.trigger_rules IS 'Array of rules to conditionally trigger actions: [{type, operator, value}]';
COMMENT ON COLUMN public.integrations.trigger_rules_logic IS 'How to combine rules: AND (all must match) or OR (any must match)';