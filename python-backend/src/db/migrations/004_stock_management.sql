-- Migration: Stock Management Tables
-- Date: 2025-11-20

-- 1. PRICE_LIST_UPLOADS
-- Tracks the history of file uploads from suppliers
CREATE TABLE IF NOT EXISTS price_list_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    supplier_name TEXT NOT NULL,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL, -- Path in Supabase Storage
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    error_message TEXT
);

-- 2. SUPPLIER_CATALOGS
-- Stores the raw/normalized data from the latest price list for each supplier
CREATE TABLE IF NOT EXISTS supplier_catalogs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    upload_id UUID REFERENCES price_list_uploads(id),
    supplier_name TEXT NOT NULL,
    sku TEXT NOT NULL,
    name TEXT,
    cost_price NUMERIC(10,2),
    stock_level INT,
    category TEXT,
    raw_data JSONB, -- Store original row data for debugging
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    UNIQUE(supplier_name, sku)
);

CREATE INDEX idx_supplier_catalogs_sku ON supplier_catalogs(sku);
CREATE INDEX idx_supplier_catalogs_supplier ON supplier_catalogs(supplier_name);

-- 3. STOCK_UPDATES
-- Tracks pending and applied updates to OpenCart
CREATE TABLE IF NOT EXISTS stock_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Product identification
    sku TEXT NOT NULL,
    opencart_product_id INT, -- Null if new product
    
    -- Change details
    field_name TEXT NOT NULL, -- 'price', 'stock', 'status'
    old_value TEXT,
    new_value TEXT,
    
    -- Source
    upload_id UUID REFERENCES price_list_uploads(id),
    supplier_name TEXT,
    
    -- Approval workflow
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'failed')),
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    rejection_reason TEXT
);

CREATE INDEX idx_stock_updates_status ON stock_updates(status);
CREATE INDEX idx_stock_updates_sku ON stock_updates(sku);

-- Trigger to update updated_at
CREATE TRIGGER update_supplier_catalogs_updated_at
    BEFORE UPDATE ON supplier_catalogs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
