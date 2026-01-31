-- 🛠️ Safe Fix: Alter existing table instead of dropping it
-- This preserves your foreign key connections in 'conversation_history' etc.

-- 1. Add the missing columns
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS quote_id TEXT, -- The PF Number
ADD COLUMN IF NOT EXISTS customer_details JSONB,
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS totals JSONB,
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- 2. Add Index for fast lookup (if not exists)
CREATE INDEX IF NOT EXISTS idx_quotes_quote_id ON quotes(quote_id);

-- 3. Enable RLS (just in case)
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- 4. Add policies if they don't exist (using DO block to avoid errors if they exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'Allow anon insert quotes'
    ) THEN
        CREATE POLICY "Allow anon insert quotes" ON quotes FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'quotes' AND policyname = 'Allow anon select quotes'
    ) THEN
        CREATE POLICY "Allow anon select quotes" ON quotes FOR SELECT USING (true);
    END IF;
END
$$;
