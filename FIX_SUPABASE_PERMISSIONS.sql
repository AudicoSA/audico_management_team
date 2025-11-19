-- ================================================
-- FIX SUPABASE PERMISSIONS FOR DASHBOARD
-- Run this in Supabase SQL Editor
-- ================================================

-- Step 1: Disable Row Level Security
ALTER TABLE IF EXISTS email_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders_tracker DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS agent_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_shipments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS config DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop any existing policies
DROP POLICY IF EXISTS "Allow public read access on email_logs" ON email_logs;
DROP POLICY IF EXISTS "Allow public read access on orders_tracker" ON orders_tracker;
DROP POLICY IF EXISTS "Allow public read access on agent_logs" ON agent_logs;

-- Step 3: Grant table-level permissions to anon role
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Specific grants for each table
GRANT SELECT ON public.email_logs TO anon;
GRANT SELECT ON public.orders_tracker TO anon;
GRANT SELECT ON public.agent_logs TO anon;
GRANT SELECT ON public.suppliers TO anon;
GRANT SELECT ON public.order_shipments TO anon;
GRANT SELECT ON public.config TO anon;

-- Step 4: Also grant to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Step 5: Verify permissions (optional - just for checking)
SELECT
    schemaname,
    tablename,
    tableowner,
    hasselect
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('email_logs', 'orders_tracker', 'agent_logs');

-- Expected result: All tables should show hasselect = true

-- ================================================
-- If you still get errors, also run this:
-- ================================================

-- Make sure tables are owned by postgres role
ALTER TABLE IF EXISTS email_logs OWNER TO postgres;
ALTER TABLE IF EXISTS orders_tracker OWNER TO postgres;
ALTER TABLE IF EXISTS agent_logs OWNER TO postgres;

-- Grant all privileges to service_role (for backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ================================================
-- Success!
-- After running this, refresh your dashboard
-- ================================================
