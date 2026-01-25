-- Add opencart_status column to orders_tracker table
ALTER TABLE orders_tracker 
ADD COLUMN IF NOT EXISTS opencart_status text;

-- Optional: Add index for faster filtering if needed
-- CREATE INDEX IF NOT EXISTS idx_orders_tracker_opencart_status ON orders_tracker(opencart_status);
