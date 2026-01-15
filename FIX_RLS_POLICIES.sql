-- Enable RLS on price_list_uploads
ALTER TABLE price_list_uploads ENABLE ROW LEVEL SECURITY;

-- Allow ALL operations for authenticated users on price_list_uploads
CREATE POLICY "Allow all for authenticated users" ON price_list_uploads
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow ALL operations for anon users (if dashboard is not fully authed yet)
CREATE POLICY "Allow all for anon users" ON price_list_uploads
FOR ALL
TO anon
USING (true)
WITH CHECK (true);

-- Storage Policies for 'invoices' bucket
-- Note: Storage policies are on storage.objects

-- Allow uploads to 'invoices' bucket
CREATE POLICY "Allow uploads to invoices bucket" ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'invoices');

-- Allow reading from 'invoices' bucket
CREATE POLICY "Allow reading from invoices bucket" ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'invoices');
