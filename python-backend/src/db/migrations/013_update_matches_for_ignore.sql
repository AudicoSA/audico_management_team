-- Allow opencart_product_id to be NULL for 'ignored' matches
ALTER TABLE product_matches ALTER COLUMN opencart_product_id DROP NOT NULL;
