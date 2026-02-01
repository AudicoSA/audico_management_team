-- Add selling_price to new_products_queue to support distinction between Cost and Retail
ALTER TABLE new_products_queue 
ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2);
