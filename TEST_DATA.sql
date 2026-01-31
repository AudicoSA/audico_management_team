-- ============================================================
-- TEST DATA FOR CONSULTATION REQUESTS
-- Run this in Supabase SQL Editor to create test data
-- ============================================================

-- First, verify the table exists
SELECT COUNT(*) as table_exists
FROM information_schema.tables
WHERE table_name = 'consultation_requests';

-- ============================================================
-- TEST SCENARIO 1: Simple Whole Home Audio (Pending)
-- ============================================================
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
);

-- ============================================================
-- TEST SCENARIO 2: Commercial Restaurant (In Progress, Assigned)
-- ============================================================
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
  complexity_score,
  status,
  priority,
  assigned_to,
  assigned_at,
  notes,
  created_at,
  updated_at
) VALUES (
  'CQ-20260125-047',
  'test-session-002',
  'Sarah Johnson',
  'sarah.johnson@restaurantgroup.co.za',
  '+27 11 555 1234',
  'The Vine Restaurant',
  'commercial',
  180000,
  '6 weeks',
  '[
    {
      "name": "Main Dining Area",
      "location": "Ground Floor",
      "useCase": "Background music - upscale ambiance",
      "dimensions": {"length": 15, "width": 10, "height": 3.5},
      "ceilingType": "Exposed concrete with acoustic panels",
      "budgetAllocation": 60000,
      "notes": "High noise environment during peak hours"
    },
    {
      "name": "Private Dining Room",
      "location": "Ground Floor",
      "useCase": "Intimate dining with music control",
      "dimensions": {"length": 6, "width": 5, "height": 3},
      "ceilingType": "Drywall",
      "budgetAllocation": 35000,
      "notes": "Needs separate volume control"
    },
    {
      "name": "Bar Area",
      "location": "Ground Floor",
      "useCase": "Lively atmosphere with higher volume",
      "dimensions": {"length": 8, "width": 4, "height": 3.5},
      "ceilingType": "Exposed concrete",
      "budgetAllocation": 45000,
      "notes": "Speakers need to be stylish and visible"
    },
    {
      "name": "Outdoor Terrace",
      "location": "Ground Floor - Outdoor",
      "useCase": "Al fresco dining with music",
      "dimensions": {"length": 12, "width": 6},
      "ceilingType": "Outdoor",
      "budgetAllocation": 40000,
      "notes": "Weatherproof required, aesthetic design important"
    }
  ]'::jsonb,
  4,
  'Upscale restaurant needs professional audio system for 4 zones. Must integrate with existing iPad-based POS system. Need different playlists for lunch (relaxed jazz) vs dinner (upbeat contemporary). Volume must auto-adjust based on time of day.',
  'Building has high ceilings (3.5m) in main areas. Acoustics challenging due to hard surfaces. May need acoustic treatment in addition to speakers. 3-phase power available. Network infrastructure being installed by separate contractor.',
  85,
  'in_progress',
  'high',
  'john@audico.co.za',
  NOW() - INTERVAL '1 day',
  '[2026-01-25 14:30] Initial call with customer - very specific about audio quality and aesthetics. Budget approved, waiting for architect''s final drawings.
[2026-01-25 16:45] Site visit scheduled for next Tuesday. Will bring acoustic measurement equipment.',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '4 hours'
);

-- ============================================================
-- TEST SCENARIO 3: Premium Home Cinema (Completed)
-- ============================================================
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
  assigned_to,
  assigned_at,
  quote_id,
  notes,
  created_at,
  updated_at
) VALUES (
  'CQ-20260120-012',
  'test-session-003',
  'Michael Chen',
  'michael.chen@techcorp.com',
  '+27 82 999 8888',
  'Chen Residence',
  'home_cinema_premium',
  450000,
  '2 months',
  '[
    {
      "name": "Home Cinema",
      "location": "Basement",
      "useCase": "Dedicated cinema room - 9.2.4 Atmos",
      "dimensions": {"length": 8, "width": 6, "height": 2.8},
      "ceilingType": "Acoustic drop ceiling (planned)",
      "budgetAllocation": 350000,
      "notes": "Dedicated room, full acoustic treatment planned. Customer is audiophile."
    },
    {
      "name": "Equipment Room",
      "location": "Basement - Adjacent",
      "useCase": "Rack for all AV equipment",
      "dimensions": {"length": 3, "width": 2, "height": 2.8},
      "budgetAllocation": 50000,
      "notes": "Climate controlled, separate HVAC"
    },
    {
      "name": "Cinema Bar Area",
      "location": "Basement",
      "useCase": "Pre-movie entertainment area",
      "dimensions": {"length": 5, "width": 4, "height": 2.8},
      "budgetAllocation": 50000,
      "notes": "Casual listening, integrate with cinema system"
    }
  ]'::jsonb,
  3,
  'High-end dedicated home cinema with 9.2.4 Dolby Atmos configuration. Customer wants best possible audio quality within budget. Prefers high-end brands (Trinnov, JBL Synthesis, or equivalent). Must integrate with Control4 automation system. Dedicated equipment rack room with proper cooling.',
  'Room is purpose-built basement space with no windows. Acoustic treatment by separate contractor (acoustic panels, bass traps, diffusers). Electrical: Dedicated 20A circuits for power amps, separate circuit for rack equipment. Network: 10Gb fiber backbone to main house. Customer has experience with high-end audio, wants technical discussions.',
  'Customer upgrading from 7.1 setup with Marantz SR8012 and KEF speakers. Keeping projector (Sony VPL-VW790ES 4K). Has extensive Blu-ray collection and Plex server with 200TB NAS.',
  92,
  'completed',
  'urgent',
  'john@audico.co.za',
  NOW() - INTERVAL '6 days',
  'quote-uuid-placeholder',
  '[2026-01-20 09:00] Initial consultation - very knowledgeable customer, clear requirements
[2026-01-20 14:30] Site visit completed - excellent room for cinema
[2026-01-21 10:00] Proposed JBL Synthesis system with Trinnov processor
[2026-01-22 11:30] Customer approved quote, requested minor changes to subwoofer placement
[2026-01-23 09:00] Final quote sent and approved
[2026-01-23 15:00] Deposit received, project handed to installation team
[2026-01-26 09:00] Marked as completed - installation scheduled for March',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '1 hour'
);

-- ============================================================
-- TEST SCENARIO 4: Multi-Zone Commercial BGM (High Priority, Pending)
-- ============================================================
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
  complexity_score,
  status,
  priority,
  created_at,
  updated_at
) VALUES (
  'CQ-20260126-018',
  'test-session-004',
  'David Naidoo',
  'david@luxhotel.co.za',
  '+27 31 555 7890',
  'The Grand Hotel - Durban',
  'commercial',
  850000,
  'URGENT - 8 weeks (before summer season)',
  '[
    {
      "name": "Main Lobby",
      "location": "Ground Floor",
      "useCase": "Elegant background music",
      "dimensions": {"length": 20, "width": 15, "height": 6},
      "ceilingType": "High ceiling with chandeliers",
      "budgetAllocation": 120000,
      "notes": "Very high ceiling, acoustic challenges"
    },
    {
      "name": "Restaurant - Breakfast Area",
      "location": "Ground Floor",
      "useCase": "Morning ambiance",
      "dimensions": {"length": 18, "width": 12, "height": 4},
      "budgetAllocation": 100000
    },
    {
      "name": "Restaurant - Fine Dining",
      "location": "Ground Floor",
      "useCase": "Evening sophisticated dining",
      "dimensions": {"length": 16, "width": 14, "height": 4},
      "budgetAllocation": 110000,
      "notes": "Separate zone from breakfast, different playlists"
    },
    {
      "name": "Rooftop Bar",
      "location": "8th Floor - Outdoor",
      "useCase": "Upbeat lounge music",
      "dimensions": {"length": 25, "width": 12},
      "budgetAllocation": 150000,
      "notes": "Partial outdoor, ocean views, wind considerations"
    },
    {
      "name": "Spa Reception",
      "location": "Ground Floor",
      "useCase": "Calm, relaxing music",
      "dimensions": {"length": 8, "width": 6, "height": 3},
      "budgetAllocation": 60000
    },
    {
      "name": "Gym",
      "location": "1st Floor",
      "useCase": "Energetic workout music",
      "dimensions": {"length": 15, "width": 10, "height": 3.5},
      "budgetAllocation": 80000,
      "notes": "High volume, different music style from rest of hotel"
    },
    {
      "name": "Pool Deck",
      "location": "2nd Floor - Outdoor",
      "useCase": "Resort atmosphere",
      "dimensions": {"length": 30, "width": 15},
      "budgetAllocation": 130000,
      "notes": "Full outdoor, high humidity environment"
    },
    {
      "name": "Conference Room A",
      "location": "1st Floor",
      "useCase": "Presentations and background",
      "dimensions": {"length": 12, "width": 10, "height": 3.5},
      "budgetAllocation": 100000,
      "notes": "Needs mic inputs for presentations"
    }
  ]'::jsonb,
  8,
  '4-star hotel needs complete audio solution for 8 zones. Each zone needs independent control but centralized management. Must integrate with hotel management system for scheduling (different music breakfast vs dinner). Licensing for commercial music streaming required (SAMRO compliant). High reliability essential - no downtime acceptable.',
  'Existing network: Enterprise Cisco infrastructure, VLANs available. Power: 3-phase throughout, UPS backup for critical systems. Building: Coastal location, high humidity, salt air considerations. Integration: Must work with Protel hotel management system. Failover: Need redundant audio sources for uninterrupted service.',
  95,
  'pending',
  'urgent',
  NOW() - INTERVAL '3 hours',
  NOW() - INTERVAL '3 hours'
);

-- ============================================================
-- TEST SCENARIO 5: Residential Multi-Zone (Low Priority, Pending)
-- ============================================================
INSERT INTO consultation_requests (
  reference_code,
  session_id,
  customer_name,
  customer_email,
  customer_phone,
  project_type,
  budget_total,
  timeline,
  zones,
  zone_count,
  requirements_summary,
  complexity_score,
  status,
  priority,
  created_at,
  updated_at
) VALUES (
  'CQ-20260126-025',
  'test-session-005',
  'Emily Williams',
  'emily.williams@gmail.com',
  '+27 82 456 7890',
  'residential_multi_zone',
  120000,
  'Flexible - next 3-6 months',
  '[
    {
      "name": "Living Room",
      "location": "Ground Floor",
      "useCase": "Entertainment and background",
      "dimensions": {"length": 7, "width": 5, "height": 3},
      "budgetAllocation": 50000
    },
    {
      "name": "Kitchen/Dining",
      "location": "Ground Floor",
      "useCase": "Background music",
      "dimensions": {"length": 8, "width": 4, "height": 3},
      "budgetAllocation": 35000
    },
    {
      "name": "Outdoor Deck",
      "location": "Ground Floor - Outdoor",
      "useCase": "Casual outdoor listening",
      "dimensions": {"length": 6, "width": 4},
      "budgetAllocation": 35000
    }
  ]'::jsonb,
  3,
  'Looking for multi-room audio for main living areas. Would like to stream from Spotify and Apple Music. Budget conscious but want good quality. Not in a rush, happy to wait for good price.',
  65,
  'pending',
  'low',
  NOW() - INTERVAL '5 hours',
  NOW() - INTERVAL '5 hours'
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check all test consultations were created
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

-- Count by status
SELECT
  status,
  COUNT(*) as count,
  SUM(budget_total) as total_budget
FROM consultation_requests
WHERE reference_code LIKE 'CQ-202601%'
GROUP BY status
ORDER BY status;

-- Count by priority
SELECT
  priority,
  COUNT(*) as count
FROM consultation_requests
WHERE reference_code LIKE 'CQ-202601%'
GROUP BY priority
ORDER BY
  CASE priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END;

-- Show assigned consultations
SELECT
  reference_code,
  customer_name,
  status,
  assigned_to,
  TO_CHAR(assigned_at, 'YYYY-MM-DD HH24:MI') as assigned
FROM consultation_requests
WHERE assigned_to IS NOT NULL
  AND reference_code LIKE 'CQ-202601%'
ORDER BY assigned_at DESC;

-- ============================================================
-- CLEANUP (Run this to remove test data)
-- ============================================================

-- Uncomment to delete test data:
-- DELETE FROM consultation_requests
-- WHERE reference_code IN (
--   'CQ-20260126-001',
--   'CQ-20260125-047',
--   'CQ-20260120-012',
--   'CQ-20260126-018',
--   'CQ-20260126-025'
-- );

-- ============================================================
-- ADDITIONAL TESTS
-- ============================================================

-- Test search by email
SELECT reference_code, customer_name, customer_email
FROM consultation_requests
WHERE customer_email ILIKE '%johnson%';

-- Test filter by budget range
SELECT reference_code, customer_name, budget_total
FROM consultation_requests
WHERE budget_total BETWEEN 200000 AND 500000
ORDER BY budget_total DESC;

-- Test zone count filter
SELECT reference_code, customer_name, zone_count, project_type
FROM consultation_requests
WHERE zone_count >= 7
ORDER BY zone_count DESC;

-- Test JSONB zone queries (verify zones are stored correctly)
SELECT
  reference_code,
  jsonb_array_length(zones) as zone_count_from_json,
  zone_count as zone_count_column
FROM consultation_requests
WHERE reference_code LIKE 'CQ-202601%';

-- Extract specific zone data
SELECT
  reference_code,
  jsonb_array_elements(zones)->>'name' as zone_name,
  jsonb_array_elements(zones)->>'useCase' as use_case
FROM consultation_requests
WHERE reference_code = 'CQ-20260126-001';
