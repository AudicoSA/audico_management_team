-- Stage 3: Stock & Listings Agent Database Schema
-- Creates tables for price change approval queue and stock sync audit log

-- Price change queue for manual approval
CREATE TABLE IF NOT EXISTS price_change_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    product_name TEXT,
    current_price NUMERIC(10,2),
    new_price NUMERIC(10,2),
    price_change_pct NUMERIC(5,2),
    supplier_id UUID REFERENCES suppliers(id),
    supplier_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_change_queue_status ON price_change_queue(status);
CREATE INDEX IF NOT EXISTS idx_price_change_queue_created ON price_change_queue(created_at DESC);

-- Stock sync audit log
CREATE TABLE IF NOT EXISTS stock_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL,
    sku TEXT NOT NULL,
    field_name TEXT NOT NULL CHECK (field_name IN ('price', 'quantity')),
    old_value NUMERIC(10,2),
    new_value NUMERIC(10,2),
    changed_by TEXT NOT NULL,
    change_source TEXT CHECK (change_source IN ('agent', 'dashboard', 'mcp_sync')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_sync_log_product ON stock_sync_log(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_sync_log_sku ON stock_sync_log(sku);
CREATE INDEX IF NOT EXISTS idx_stock_sync_log_created ON stock_sync_log(created_at DESC);

-- Stock sync sessions (track each sync run)
CREATE TABLE IF NOT EXISTS stock_sync_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT CHECK (status IN ('running', 'completed', 'failed')),
    products_checked INTEGER DEFAULT 0,
    price_changes_queued INTEGER DEFAULT 0,
    stock_updates_applied INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    error_details JSONB,
    triggered_by TEXT,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_stock_sync_sessions_started ON stock_sync_sessions(started_at DESC);

-- Update trigger for price_change_queue
CREATE OR REPLACE FUNCTION update_price_change_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_change_queue_updated
    BEFORE UPDATE ON price_change_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_price_change_queue_timestamp();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON price_change_queue TO authenticated;
GRANT SELECT, INSERT ON stock_sync_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stock_sync_sessions TO authenticated;

GRANT SELECT, INSERT, UPDATE ON price_change_queue TO anon;
GRANT SELECT, INSERT ON stock_sync_log TO anon;
GRANT SELECT, INSERT, UPDATE ON stock_sync_sessions TO anon;
