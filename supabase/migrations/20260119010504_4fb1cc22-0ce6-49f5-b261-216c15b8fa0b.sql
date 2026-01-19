-- Add 'pending' status to sac_ticket_status enum for untreated tickets
ALTER TYPE sac_ticket_status ADD VALUE IF NOT EXISTS 'pending' BEFORE 'open';

-- Add source tracking columns to sac_tickets
ALTER TABLE sac_tickets 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_integration_id UUID REFERENCES integrations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS external_reference VARCHAR(255);

-- Add SAC configuration columns to integrations table
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS sac_category VARCHAR(50),
ADD COLUMN IF NOT EXISTS sac_subcategory VARCHAR(100),
ADD COLUMN IF NOT EXISTS sac_priority VARCHAR(20) DEFAULT 'normal';

-- Create index for faster filtering by source
CREATE INDEX IF NOT EXISTS idx_sac_tickets_source ON sac_tickets(source);
CREATE INDEX IF NOT EXISTS idx_sac_tickets_status ON sac_tickets(status);