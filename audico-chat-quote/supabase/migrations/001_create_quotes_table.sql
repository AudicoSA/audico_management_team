-- Migration: Create quotes table with all required columns
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto/sql

-- First, check if the table exists and drop it to recreate with correct schema
-- (Only if you want a fresh start - comment this out if you want to preserve data)
-- DROP TABLE IF EXISTS quotes;

-- Create the quotes table if it doesn't exist
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('system_design', 'simple_quote', 'tender')),
  requirements JSONB NOT NULL DEFAULT '{}',
  steps JSONB NOT NULL DEFAULT '[]',
  current_step_index INT DEFAULT 0,
  selected_products JSONB DEFAULT '[]',
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'complete', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if table already exists (safe to run multiple times)
DO $$
BEGIN
  -- Add current_step_index if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'current_step_index'
  ) THEN
    ALTER TABLE quotes ADD COLUMN current_step_index INT DEFAULT 0;
  END IF;

  -- Add selected_products if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'selected_products'
  ) THEN
    ALTER TABLE quotes ADD COLUMN selected_products JSONB DEFAULT '[]';
  END IF;

  -- Add steps if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'steps'
  ) THEN
    ALTER TABLE quotes ADD COLUMN steps JSONB DEFAULT '[]';
  END IF;

  -- Add requirements if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'requirements'
  ) THEN
    ALTER TABLE quotes ADD COLUMN requirements JSONB DEFAULT '{}';
  END IF;
END $$;

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_quotes_session_id ON quotes(session_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- Enable Row Level Security (optional - uncomment if you want to restrict access)
-- ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users (optional)
-- CREATE POLICY "Users can manage their own quotes" ON quotes
--   FOR ALL USING (true);

-- Verify the table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'quotes'
ORDER BY ordinal_position;
