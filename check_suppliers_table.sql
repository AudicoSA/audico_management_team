-- Query to see the suppliers table structure and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

-- Query to see check constraints
SELECT 
    con.conname as constraint_name,
    pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'suppliers'
AND con.contype = 'c';
