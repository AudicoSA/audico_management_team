-- Migration: Add invoice_number to quotes table
-- Purpose: Persist invoice numbers for EFT payment tracking
-- Date: 2026-02-04

-- Add invoice_number column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'invoice_number'
  ) THEN
    ALTER TABLE quotes ADD COLUMN invoice_number TEXT UNIQUE;
  END IF;
END $$;

-- Create index for fast invoice lookups
CREATE INDEX IF NOT EXISTS idx_quotes_invoice_number ON quotes(invoice_number);

-- Create sequence for invoice numbers (ensures uniqueness across concurrent requests)
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Function to generate next invoice number
-- Format: PF{YYMMDD}-{SEQ} e.g. PF260204-001
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  date_part TEXT;
  seq_num INT;
  invoice TEXT;
BEGIN
  date_part := TO_CHAR(NOW(), 'YYMMDD');
  seq_num := nextval('invoice_number_seq');
  invoice := 'PF' || date_part || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN invoice;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON COLUMN quotes.invoice_number IS 'Pro-forma invoice number for EFT payment tracking (format: PF{YYMMDD}-{SEQ})';
