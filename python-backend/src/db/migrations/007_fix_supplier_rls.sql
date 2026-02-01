-- Fix RLS policy for supplier_addresses to allow anonymous read access
-- Run this in Supabase SQL Editor

-- First, drop ALL existing policies
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON supplier_addresses;
DROP POLICY IF EXISTS "Allow insert/update access to authenticated users" ON supplier_addresses;
DROP POLICY IF EXISTS "Allow read access to all users" ON supplier_addresses;

-- Create new policy that allows ANONYMOUS read access
CREATE POLICY "Enable read access for all users" ON supplier_addresses
    FOR SELECT 
    USING (true);

-- Keep write access restricted to authenticated users only
CREATE POLICY "Enable write access for authenticated users" ON supplier_addresses
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
