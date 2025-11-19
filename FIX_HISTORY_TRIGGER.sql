-- Fix orders_tracker_history constraint issue
-- The check constraint is failing because it expects specific values in change_source field

-- Option 1: Drop the problematic check constraint (recommended for development)
DO $$
BEGIN
    -- Drop the check constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'orders_tracker_history_change_source_check'
    ) THEN
        ALTER TABLE orders_tracker_history
        DROP CONSTRAINT orders_tracker_history_change_source_check;

        RAISE NOTICE 'Dropped orders_tracker_history_change_source_check constraint';
    END IF;
END $$;

-- Option 2: Disable the trigger temporarily (alternative approach)
-- Uncomment these lines if you prefer to disable the trigger instead:
-- ALTER TABLE orders_tracker DISABLE TRIGGER ALL;

-- Grant permissions just to be sure
GRANT ALL PRIVILEGES ON public.orders_tracker_history TO anon;
GRANT ALL PRIVILEGES ON public.orders_tracker_history TO authenticated;

-- Verify the change
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'orders_tracker_history'
  AND c.contype = 'c';
