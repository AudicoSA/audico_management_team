-- Fix permissions for orders_tracker_history table
-- This table is used by triggers to track changes to orders

-- Check if the history table exists, create if needed
CREATE TABLE IF NOT EXISTS orders_tracker_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_no TEXT NOT NULL,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT,
    field_name TEXT,
    old_value TEXT,
    new_value TEXT,
    action TEXT
);

-- Disable RLS on history table
ALTER TABLE IF EXISTS orders_tracker_history DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_tracker_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_tracker_history TO authenticated;

-- Ensure proper ownership
ALTER TABLE IF EXISTS orders_tracker_history OWNER TO postgres;

-- Grant all privileges
GRANT ALL PRIVILEGES ON public.orders_tracker_history TO anon;
GRANT ALL PRIVILEGES ON public.orders_tracker_history TO authenticated;

-- If there's a sequence for the ID, grant usage on it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_tracker_history_id_seq') THEN
        GRANT USAGE, SELECT ON SEQUENCE orders_tracker_history_id_seq TO anon;
        GRANT USAGE, SELECT ON SEQUENCE orders_tracker_history_id_seq TO authenticated;
    END IF;
END $$;

-- Verify permissions
SELECT
    table_name,
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('orders_tracker', 'orders_tracker_history')
ORDER BY table_name, grantee, privilege_type;
