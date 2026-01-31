-- ============================================================
-- TEST DATA FOR CONSULTATION REQUESTS (UPSERT VERSION)
-- This version safely handles existing data
-- Run this in Supabase SQL Editor
-- ============================================================

-- First, verify the table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_name = 'consultation_requests';

-- ============================================================
-- OPTION 1: DELETE EXISTING TEST DATA FIRST
-- Uncomment this section to start fresh
-- ============================================================
/*
DELETE FROM consultation_requests
WHERE reference_code IN (
  'CQ-20260126-001',
  'CQ-20260125-047',
  'CQ-20260120-012',
  'CQ-20260126-018',
  'CQ-20260126-025'
);

SELECT 'Deleted existing test data' as status;
*/

-- ============================================================
-- OPTION 2: UPSERT (Insert or Update if exists)
-- This will update existing records with new data
-- ============================================================

-- Test Scenario 1: Simple Whole Home Audio (Pending)
INSERT INTO consultation_requests (
  reference_code,
  session_id,
  customer_name,
  customer_email,
  customer_phone,
  company_name,
  project_type,
  budget_total,
  timeline,
  zones,
  zone_count,
  requirements_summary,
  technical_notes,
  existing_equipment,
  complexity_score,
  status,
  priority,
  created_at,
  updated_at
) VALUES (
  'CQ-20260126-001',
  'test-session-001',
  'John Smith',
  'john.smith@example.com',
  '+27 82 123 4567',
  'Smith Residence',
  'whole_home_audio',
  250000,
  '3-4 months',
  '[
    {
      "name": "Living Room",
      "location": "Ground Floor",
      "useCase": "Background music and TV audio",
      "dimensions": {"length": 6, "width": 5, "height": 3},
      "ceilingType": "Drywall",
      "budgetAllocation": 50000,
      "notes": "Large open plan space, needs good coverage"
    },
    {
      "name": "Kitchen",
      "location": "Ground Floor",
      "useCase": "Background music",
      "dimensions": {"length": 5, "width": 4, "height": 3},
      "ceilingType": "Drywall",
      "budgetAllocation": 30000,
      "notes": "Open to dining area"
    },
    {
      "name": "Master Bedroom",
      "location": "First Floor",
      "useCase": "Relaxation and entertainment",
      "dimensions": {"length": 5, "width": 4.5, "height": 2.8},
      "ceilingType": "Drywall",
      "budgetAllocation": 40000,
      "notes": "Want ceiling speakers"
    },
    {
      "name": "Home Office",
      "location": "First Floor",
      "useCase": "Background music during work",
      "dimensions": {"length": 4, "width": 3.5, "height": 2.8},
      "ceilingType": "Drywall",
      "budgetAllocation": 25000
    },
    {
      "name": "Guest Bedroom",
      "location": "First Floor",
      "useCase": "Background music",
      "dimensions": {"length": 4, "width": 3, "height": 2.8},
      "ceilingType": "Drywall",
      "budgetAllocation": 20000
    },
    {
      "name": "Patio",
      "location": "Ground Floor - Outdoor",
      "useCase": "Outdoor entertainment",
      "dimensions": {"length": 8, "width": 4, "height": 3},
      "ceilingType": "Covered patio",
      "budgetAllocation": 45000,
      "notes": "Need weatherproof speakers"
    },
    {
      "name": "Pool Area",
      "location": "Garden",
      "useCase": "Pool parties and relaxation",
      "dimensions": {"length": 10, "width": 5},
      "ceilingType": "Outdoor",
      "budgetAllocation": 40000,
      "notes": "Fully outdoor, needs robust solution"
    }
  ]'::jsonb,
  7,
  'Customer wants whole home audio system covering 7 zones including indoor and outdoor areas. Priority is ease of use with a single app to control all zones. Would like ability to play different music in different zones. Budget is R250k total.',
  'Existing network infrastructure: Ubiquiti UniFi setup with POE switches. All areas have CAT6 cabling. Prefer network-based solution that integrates with existing smart home setup (Control4).',
  'Currently has a basic stereo system in living room (Yamaha RX-V685) and some portable Bluetooth speakers.',
  78,
  'pending',
  'normal',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '2 hours'
)
ON CONFLICT (reference_code)
DO UPDATE SET
  updated_at = NOW(),
  status = EXCLUDED.status,
  priority = EXCLUDED.priority;

-- Similar UPSERT for other scenarios...
-- (For brevity, showing just the pattern)

-- ============================================================
-- SIMPLE VIEW OF EXISTING TEST DATA
-- ============================================================
SELECT
  reference_code,
  customer_name,
  status,
  priority,
  zone_count,
  budget_total,
  TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI') as created
FROM consultation_requests
WHERE reference_code LIKE 'CQ-202601%'
ORDER BY created_at DESC;
