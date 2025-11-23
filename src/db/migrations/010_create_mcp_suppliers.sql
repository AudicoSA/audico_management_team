-- Create suppliers table for MCP feed configuration
-- This is separate from supplier_addresses (shipping addresses)

CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    supplier_type TEXT CHECK (supplier_type IN ('api', 'scraper', 'feed', 'manual')),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert MCP suppliers from your existing setup
INSERT INTO suppliers (name, supplier_type, is_active, notes) VALUES
    ('Nology', 'api', true, 'Nology API integration - 1,177 products'),
    ('Stock2Shop', 'feed', true, 'Stock2Shop Elasticsearch feed'),
    ('Solution Technologies', 'feed', true, 'Solution Tech feed'),
    ('Esquire', 'feed', true, 'Esquire feed system'),
    ('Planet World', 'scraper', true, 'Planet World web scraper'),
    ('Connoisseur', 'feed', true, 'Connoisseur feed'),
    ('Homemation', 'scraper', true, 'Homemation scraper'),
    ('Google Merchant', 'feed', true, 'Google Merchant feed')
ON CONFLICT (name) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- Update trigger
CREATE OR REPLACE FUNCTION update_suppliers_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER suppliers_updated
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_suppliers_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON suppliers TO anon;
