-- Check the structure and constraints of orders_tracker_history table

-- 1. Get table columns
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders_tracker_history'
ORDER BY ordinal_position;

-- 2. Get check constraints
SELECT
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'orders_tracker_history'
  AND c.contype = 'c';

-- 3. Get triggers on orders_tracker table
SELECT
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders_tracker';
