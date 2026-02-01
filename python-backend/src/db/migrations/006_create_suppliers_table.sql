-- Create supplier_addresses table for address book
-- (Renamed from suppliers to avoid conflict with existing table)
CREATE TABLE IF NOT EXISTS supplier_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    company TEXT NOT NULL,
    street_address TEXT NOT NULL,
    local_area TEXT NOT NULL,
    city TEXT NOT NULL,
    code TEXT NOT NULL,
    country_code TEXT NOT NULL DEFAULT 'ZA',
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE supplier_addresses ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to authenticated users" ON supplier_addresses
    FOR SELECT TO authenticated USING (true);

-- Allow insert/update access to authenticated users
CREATE POLICY "Allow insert/update access to authenticated users" ON supplier_addresses
    FOR ALL TO authenticated USING (true);
