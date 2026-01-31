-- Migration 005: Consultation Requests Table
-- Purpose: Store complex project escalation requests for specialist review
-- Related: CHAT_QUOTE_PLAN_X7 - AI Triage & Specialist Escalation System

-- Main table for consultation requests
CREATE TABLE IF NOT EXISTS consultation_requests (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,  -- "CQ-20250126-001" format
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Customer Information
  customer_name TEXT,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  company_name TEXT,

  -- Project Details
  project_type TEXT NOT NULL CHECK (project_type IN (
    'residential_multi_zone',
    'commercial',
    'home_cinema_premium',
    'whole_home_audio',
    'other'
  )),
  budget_total NUMERIC NOT NULL,
  timeline TEXT,
  zones JSONB NOT NULL DEFAULT '[]',  -- Array of zone objects

  -- Requirements
  requirements_summary TEXT NOT NULL,
  technical_notes TEXT,
  existing_equipment TEXT,

  -- Metrics (from complexity detection)
  complexity_score INTEGER,
  zone_count INTEGER,

  -- Status & Assignment
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'in_progress',
    'completed',
    'cancelled'
  )),
  assigned_to TEXT,  -- Email or name of assigned specialist
  assigned_at TIMESTAMPTZ,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  notes TEXT,  -- Internal notes for specialists
  priority TEXT DEFAULT 'normal' CHECK (priority IN (
    'low',
    'normal',
    'high',
    'urgent'
  ))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_consultation_requests_session
  ON consultation_requests(session_id);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_reference
  ON consultation_requests(reference_code);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_status
  ON consultation_requests(status);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_created
  ON consultation_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_requests_assigned
  ON consultation_requests(assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consultation_requests_priority
  ON consultation_requests(priority, status);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_consultation_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before each update
DROP TRIGGER IF EXISTS set_consultation_requests_updated_at ON consultation_requests;
CREATE TRIGGER set_consultation_requests_updated_at
  BEFORE UPDATE ON consultation_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_consultation_requests_updated_at();

-- Add helpful comments
COMMENT ON TABLE consultation_requests IS 'Complex audio project escalation requests requiring specialist review';
COMMENT ON COLUMN consultation_requests.reference_code IS 'Unique human-readable reference code (CQ-YYYYMMDD-NNN)';
COMMENT ON COLUMN consultation_requests.zones IS 'Array of zone objects with room details, dimensions, use cases';
COMMENT ON COLUMN consultation_requests.complexity_score IS 'AI-calculated complexity score (0-100) that triggered escalation';
COMMENT ON COLUMN consultation_requests.zone_count IS 'Number of zones in the project for quick filtering';

-- Verification query
SELECT
  'consultation_requests table created successfully' as status,
  COUNT(*) as row_count
FROM consultation_requests;
