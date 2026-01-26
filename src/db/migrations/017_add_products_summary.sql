-- Add order_products column for summary string
ALTER TABLE orders_tracker 
ADD COLUMN IF NOT EXISTS order_products text;
