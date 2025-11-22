-- Update RLS policy for supplier_addresses to allow anonymous read access
-- This is safe since supplier addresses are not sensitive data

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON supplier_addresses;
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON supplier_addresses;

-- Create new policies that allow anonymous read access
CREATE POLICY "Allow read access to all users" ON supplier_addresses
    FOR SELECT USING (true);

-- Keep write access restricted to authenticated users
CREATE POLICY "Allow insert/update access to authenticated users" ON supplier_addresses
    FOR ALL TO authenticated USING (true);
