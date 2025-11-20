-- Migration: Add supplier columns to orders_tracker
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ajdehycoypilsegmxbto

-- Add supplier columns
ALTER TABLE orders_tracker
ADD COLUMN IF NOT EXISTS supplier_invoice_no text,
ADD COLUMN IF NOT EXISTS supplier_quote_no text,
ADD COLUMN IF NOT EXISTS supplier_amount numeric,
ADD COLUMN IF NOT EXISTS supplier_status text DEFAULT 'Pending';

-- Add comments for documentation
COMMENT ON COLUMN orders_tracker.supplier_invoice_no IS 'Invoice number extracted from supplier email';
COMMENT ON COLUMN orders_tracker.supplier_quote_no IS 'Quote number extracted from supplier email';
COMMENT ON COLUMN orders_tracker.supplier_amount IS 'Total amount extracted from supplier invoice/quote';
COMMENT ON COLUMN orders_tracker.supplier_status IS 'Status of the supplier payment flow (Pending/Invoiced/Paid)';

-- Verify columns were added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'orders_tracker'
AND column_name LIKE 'supplier%'
ORDER BY column_name;
