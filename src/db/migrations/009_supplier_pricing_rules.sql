-- Supplier Pricing Rules Configuration
-- Handles different pricing structures (cost vs retail) per supplier

CREATE TABLE IF NOT EXISTS supplier_pricing_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id) UNIQUE NOT NULL,
    
    -- Pricing type: 'cost' (needs markup), 'retail' (use as-is), 'mixed' (varies by product)
    pricing_type TEXT NOT NULL CHECK (pricing_type IN ('cost', 'retail', 'mixed')) DEFAULT 'cost',
    
    -- Default markup percentage for cost-based pricing
    default_markup_pct NUMERIC(5,2) DEFAULT 30.00,
    
    -- Category-specific markups (JSON: {"Speakers": 25.0, "Amplifiers": 35.0})
    category_markups JSONB DEFAULT '{}'::jsonb,
    
    -- Notes for manual reference
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_pricing_rules_supplier ON supplier_pricing_rules(supplier_id);

-- Update trigger
CREATE OR REPLACE FUNCTION update_pricing_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_rules_updated
    BEFORE UPDATE ON supplier_pricing_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_pricing_rules_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_pricing_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_pricing_rules TO anon;

-- Insert default rules for existing suppliers (if any)
-- These can be updated via the dashboard
INSERT INTO supplier_pricing_rules (supplier_id, pricing_type, default_markup_pct, notes)
SELECT 
    id,
    'cost',  -- Default to cost pricing
    30.00,   -- Default 30% markup
    'Default pricing rule - please configure via dashboard'
FROM suppliers
ON CONFLICT (supplier_id) DO NOTHING;
