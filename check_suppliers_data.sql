-- Check what's in the suppliers table
SELECT id, name, type, supplier_type, is_active, notes
FROM suppliers
ORDER BY name;

-- Check supplier_addresses table
SELECT id, name
FROM supplier_addresses
ORDER BY name
LIMIT 5;
