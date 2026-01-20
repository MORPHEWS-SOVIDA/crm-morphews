-- Add column to store the storage path separately from the signed URL
-- This allows us to regenerate signed URLs when they expire
ALTER TABLE receptive_attendances 
ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;