-- Add 'agent' as a valid distribution_mode value
-- The column is text type so no enum migration needed, just update TypeScript types
-- We only need to ensure the column accepts 'agent' which it does since it's text/varchar

-- No schema change needed - distribution_mode is already a text column that accepts any string value
SELECT 'distribution_mode already supports agent value' as info;