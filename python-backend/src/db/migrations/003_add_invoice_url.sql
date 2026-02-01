-- Migration: Add supplier_invoice_url to orders_tracker
-- Date: 2025-11-20

ALTER TABLE orders_tracker
ADD COLUMN IF NOT EXISTS supplier_invoice_url text;

COMMENT ON COLUMN orders_tracker.supplier_invoice_url IS 'Public URL of the uploaded PDF invoice in Supabase Storage';
