-- Fix Supabase permissions for orders_tracker table
-- This grants full CRUD permissions to the anon role for the dashboard

-- Disable Row Level Security (RLS) for development
ALTER TABLE IF EXISTS orders_tracker DISABLE ROW LEVEL SECURITY;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant full permissions to anon role (for dashboard access)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_tracker TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders_tracker TO authenticated;

-- Ensure the table owner is postgres
ALTER TABLE IF EXISTS orders_tracker OWNER TO postgres;

-- Grant all privileges on the table
GRANT ALL PRIVILEGES ON public.orders_tracker TO anon;
GRANT ALL PRIVILEGES ON public.orders_tracker TO authenticated;

-- If there's a sequence for the ID, grant usage on it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'orders_tracker_id_seq') THEN
        GRANT USAGE, SELECT ON SEQUENCE orders_tracker_id_seq TO anon;
        GRANT USAGE, SELECT ON SEQUENCE orders_tracker_id_seq TO authenticated;
    END IF;
END $$;

-- Verify permissions (this will show in the SQL editor output)
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'orders_tracker'
ORDER BY grantee, privilege_type;
