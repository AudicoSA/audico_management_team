-- Migration: Add supplier columns to orders_tracker
-- Date: 2025-11-19

ALTER TABLE orders_tracker
ADD COLUMN IF NOT EXISTS supplier_invoice_no text,
ADD COLUMN IF NOT EXISTS supplier_quote_no text,
ADD COLUMN IF NOT EXISTS supplier_amount numeric,
ADD COLUMN IF NOT EXISTS supplier_status text DEFAULT 'Pending'; -- Pending, Invoiced, Paid

-- Add comment for documentation
COMMENT ON COLUMN orders_tracker.supplier_invoice_no IS 'Invoice number extracted from supplier email';
COMMENT ON COLUMN orders_tracker.supplier_quote_no IS 'Quote number extracted from supplier email';
COMMENT ON COLUMN orders_tracker.supplier_amount IS 'Total amount extracted from supplier invoice/quote';
COMMENT ON COLUMN orders_tracker.supplier_status IS 'Status of the supplier payment flow';
