-- Enable RLS
ALTER TABLE kait_workflows ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors on rerun (if safe) or use IF NOT EXISTS logic
-- Postgres doesn't support generic CREATE ROLE IF NOT EXISTS easily in blocks without DO.
-- Standard idempotent way:

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_policies 
        WHERE tablename = 'kait_workflows' AND policyname = 'Enable read access for all'
    ) THEN
        CREATE POLICY "Enable read access for all" ON "public"."kait_workflows"
        AS PERMISSIVE FOR SELECT
        TO public
        USING (true);
    END IF;
END
$$;

-- Also allow insert/update for service role (implicit, but just in case policies are restrictive)
-- Actually, service_role bypasses RLS.
