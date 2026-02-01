-- Migration: Create supplier_specials table

CREATE TABLE IF NOT EXISTS supplier_specials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    title TEXT NOT NULL,
    deals JSONB DEFAULT '[]'::jsonb, -- List of {product: str, price: str, sku: str}
    source_url TEXT, -- URL to flyer image/PDF
    valid_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for searching deals content (simple text search on jsonb)
CREATE INDEX IF NOT EXISTS idx_supplier_specials_deals ON supplier_specials USING GIN (deals);
CREATE INDEX IF NOT EXISTS idx_supplier_specials_created_at ON supplier_specials (created_at DESC);

COMMENT ON TABLE supplier_specials IS 'Stores extracted deals from supplier flyers/emails';
