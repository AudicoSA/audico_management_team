-- Add missing columns to existing suppliers table and populate MCP suppliers
-- Valid type values: 'scrape', 'feed', 'manual'

-- Add supplier_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='suppliers' AND column_name='supplier_type') THEN
        ALTER TABLE suppliers ADD COLUMN supplier_type TEXT CHECK (supplier_type IN ('api', 'scraper', 'feed', 'manual'));
    END IF;
END $$;

-- Add is_active column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='suppliers' AND column_name='is_active') THEN
        ALTER TABLE suppliers ADD COLUMN is_active BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='suppliers' AND column_name='notes') THEN
        ALTER TABLE suppliers ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Insert MCP suppliers with correct type values
INSERT INTO suppliers (name, type, supplier_type, is_active, notes) VALUES
    ('Nology', 'feed', 'api', true, 'Nology API integration - 1,177 products'),
    ('Stock2Shop', 'feed', 'feed', true, 'Stock2Shop Elasticsearch feed'),
    ('Solution Technologies', 'feed', 'feed', true, 'Solution Tech feed'),
    ('Esquire', 'feed', 'feed', true, 'Esquire feed system'),
    ('Planet World', 'scrape', 'scraper', true, 'Planet World web scraper'),
    ('Connoisseur', 'feed', 'feed', true, 'Connoisseur feed'),
    ('Homemation', 'scrape', 'scraper', true, 'Homemation scraper'),
    ('Google Merchant', 'feed', 'feed', true, 'Google Merchant feed')
ON CONFLICT (name) DO UPDATE SET
    type = EXCLUDED.type,
    supplier_type = EXCLUDED.supplier_type,
    is_active = EXCLUDED.is_active,
    notes = EXCLUDED.notes;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_suppliers_active ON suppliers(is_active);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON suppliers TO anon;
