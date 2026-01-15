-- 1. Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- 2. Grant table permissions (CRUD)
GRANT ALL ON TABLE price_list_uploads TO anon;
GRANT ALL ON TABLE price_list_uploads TO authenticated;

-- 3. Ensure RLS is enabled
ALTER TABLE price_list_uploads ENABLE ROW LEVEL SECURITY;

-- 4. Re-apply Policies (Drop first to avoid errors if they exist)
DROP POLICY IF EXISTS "Allow all for anon users" ON price_list_uploads;
CREATE POLICY "Allow all for anon users" ON price_list_uploads
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for authenticated users" ON price_list_uploads;
CREATE POLICY "Allow all for authenticated users" ON price_list_uploads
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
