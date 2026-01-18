-- 1. Identify duplicates
WITH dupe_products AS (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY supplier_id, supplier_sku 
                   ORDER BY updated_at DESC, id DESC
               ) as row_num
        FROM products
    ) t
    WHERE t.row_num > 1
)

-- 2. Delete deals associated with duplicate products FIRST (to satisfy Foreign Key)
, deleted_deals AS (
    DELETE FROM dynamic_deals
    WHERE product_id IN (SELECT id FROM dupe_products)
)

-- 3. Now safely delete the duplicate products
DELETE FROM products
WHERE id IN (SELECT id FROM dupe_products);

-- 4. Add the constraint
ALTER TABLE products
ADD CONSTRAINT products_supplier_id_sku_unique UNIQUE (supplier_id, supplier_sku);
